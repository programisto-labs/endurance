import express, { Request, Response, Router, NextFunction } from 'express';
import { EnduranceSchema } from './schema.js';
import { EnduranceAuthMiddleware } from './auth.js';
import multer from 'multer';
import type { Express } from 'express';
import path from 'path';
import fs from 'fs';
import logger from '../core/logger.js';
import { enduranceEmitter } from './emitter.js';

type SecurityOptions = {
  permissions?: string[];
  checkOwnership?: boolean;
  requireAuth?: boolean;
}

class FileUploadConfig {
  public fieldName: string;
  public options: {
    maxCount?: number;
    allowedMimeTypes?: string[];
    maxFileSize?: number;
    storage?: multer.StorageEngine;
  };

  constructor(fieldName: string, options: {
    maxCount?: number;
    allowedMimeTypes?: string[];
    maxFileSize?: number;
    storage?: multer.StorageEngine;
  } = {}) {
    this.fieldName = fieldName;
    this.options = options;
  }

  static single(fieldName: string, options: {
    allowedMimeTypes?: string[];
    maxFileSize?: number;
    storage?: multer.StorageEngine;
  } = {}) {
    return new FileUploadConfig(fieldName, options);
  }

  static multiple(fieldName: string, maxCount: number, options: {
    allowedMimeTypes?: string[];
    maxFileSize?: number;
    storage?: multer.StorageEngine;
  } = {}) {
    return new FileUploadConfig(fieldName, { ...options, maxCount });
  }
}

type RequestHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

interface EnduranceRequest<T = any> extends Request {
  user?: T;
}

abstract class EnduranceRouter<T = any> {
  protected router: Router;
  protected authMiddleware?: EnduranceAuthMiddleware;
  private upload: multer.Multer;

  constructor(authMiddleware?: EnduranceAuthMiddleware, upload?: multer.Multer) {
    this.router = express.Router();
    // Utiliser l'instance passée ou récupérer l'instance globale
    this.authMiddleware = authMiddleware || EnduranceAuthMiddleware.getInstance();
    this.upload = upload!;
    this.setupRoutes();
  }

  protected abstract setupRoutes(): void;

  protected buildSecurityMiddleware(options: SecurityOptions = {}): Array<RequestHandler> {
    const {
      requireAuth = true,
      checkOwnership = false,
      permissions = []
    } = options;

    const middlewares: Array<RequestHandler> = [];

    // Utiliser l'instance passée au constructeur, ou récupérer l'instance globale
    const authMiddleware = this.authMiddleware || EnduranceAuthMiddleware.getInstance();

    if (!authMiddleware) {
      return middlewares;
    }

    if (requireAuth) {
      middlewares.push(authMiddleware.auth.isAuthenticated());
    }

    if (permissions.length > 0) {
      middlewares.push((req: Request, res: Response, next: NextFunction) => {
        return authMiddleware.accessControl.checkUserPermissions(permissions, req, res, next);
      });
    }

    if (checkOwnership) {
      middlewares.push(authMiddleware.accessControl.restrictToOwner);
    }

    return middlewares;
  }

  private createResponseInterceptor(res: Response) {
    const originalSend = res.send;
    const originalJson = res.json;
    const responseInfo = {
      data: null as any,
      status: 200 as number
    };
    let responseSent = false;

    res.send = function (data: any) {
      if (!responseSent) {
        responseInfo.data = data;
        responseInfo.status = res.statusCode;
        responseSent = true;
      }
      return originalSend.call(this, data);
    };

    res.json = function (data: any) {
      if (!responseSent) {
        responseInfo.data = data;
        responseInfo.status = res.statusCode;
        responseSent = true;
      }
      return originalJson.call(this, data);
    };

    return responseInfo;
  }

  protected buildFileUploadMiddleware(config: FileUploadConfig): any {
    const { fieldName, options } = config;
    const { maxCount, allowedMimeTypes, maxFileSize, storage } = options;

    const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      if (allowedMimeTypes && !allowedMimeTypes.includes(file.mimetype)) {
        cb(new Error(`Type de fichier non autorisé. Types acceptés: ${allowedMimeTypes.join(', ')}`));
        return;
      }
      cb(null, true);
    };

    // Fonction utilitaire pour le nommage des fichiers
    const getDefaultStorage = () => multer.diskStorage({
      destination: (req: Request, file: any, cb: (error: Error | null, destination: string) => void) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
        const originalName = path.parse(file.originalname).name;
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `${originalName}-${uniqueSuffix}${ext}`;
        logger.info('Saving file:', filename);
        cb(null, filename);
      }
    });

    // Si un storage personnalisé est fourni, créer une nouvelle instance de Multer
    if (storage) {
      const customMulter = multer({
        storage,
        limits: {
          fileSize: maxFileSize || parseInt(process.env.MAX_FILE_SIZE || '5242880')
        },
        fileFilter
      });

      if (maxCount && maxCount > 1) {
        return customMulter.array(fieldName, maxCount);
      }
      return customMulter.single(fieldName);
    }

    // Sinon utiliser l'instance par défaut avec le storage par défaut
    const defaultMulter = multer({
      storage: getDefaultStorage(),
      limits: {
        fileSize: maxFileSize || parseInt(process.env.MAX_FILE_SIZE || '5242880')
      },
      fileFilter
    });

    if (maxCount && maxCount > 1) {
      return defaultMulter.array(fieldName, maxCount);
    }
    return defaultMulter.single(fieldName);
  }

  public get(
    path: string,
    securityOptions: SecurityOptions = {},
    ...handlers: Array<(req: EnduranceRequest<T>, res: Response, next: NextFunction) => Promise<void>>
  ) {
    const middlewares = this.buildSecurityMiddleware(securityOptions);
    const wrappedHandlers = handlers.map(handler => async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Intercepter la réponse pour capturer le résultat
        const responseInfo = this.createResponseInterceptor(res);

        await handler(req as EnduranceRequest<T>, res, next);

        // Émettre l'événement de fin de route avec le résultat
        const eventName = `${path}_GET_END`;
        enduranceEmitter.emit(eventName, {
          path,
          method: 'GET',
          req,
          res,
          responseData: responseInfo.data,
          responseStatus: responseInfo.status
        });
      } catch (error) {
        next(error);
      }
    });
    this.router.get(path, ...middlewares, ...wrappedHandlers);
  }

  // Signatures de surcharge et implémentation
  /* eslint-disable no-dupe-class-members */
  public post(
    path: string,
    securityOptions: SecurityOptions,
    ...handlers: Array<(req: EnduranceRequest<T>, res: Response, next: NextFunction) => Promise<void>>
  ): void;

  public post(
    path: string,
    securityOptions: SecurityOptions,
    fileConfig: FileUploadConfig,
    ...handlers: Array<(req: EnduranceRequest<T>, res: Response, next: NextFunction) => Promise<void>>
  ): void;

  // Implémentation
  public post(
    path: string,
    securityOptions: SecurityOptions,
    fileConfigOrHandler: FileUploadConfig | ((req: EnduranceRequest<T>, res: Response, next: NextFunction) => Promise<void>),
    ...restHandlers: Array<(req: EnduranceRequest<T>, res: Response, next: NextFunction) => Promise<void>>
  ) {
    const middlewares = [...this.buildSecurityMiddleware(securityOptions)];
    let handlers: Array<(req: EnduranceRequest<T>, res: Response, next: NextFunction) => Promise<void>>;

    // Vérification du type à l'exécution
    if (fileConfigOrHandler && typeof fileConfigOrHandler === 'object' && 'fieldName' in fileConfigOrHandler) {
      middlewares.push(this.buildFileUploadMiddleware(fileConfigOrHandler as FileUploadConfig));
      handlers = restHandlers;
    } else {
      handlers = [fileConfigOrHandler as (req: EnduranceRequest<T>, res: Response, next: NextFunction) => Promise<void>, ...restHandlers];
    }

    const wrappedHandlers = handlers.map(handler => async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Intercepter la réponse pour capturer le résultat
        const responseInfo = this.createResponseInterceptor(res);

        await handler(req as EnduranceRequest<T>, res, next);

        // Émettre l'événement de fin de route avec le résultat
        const eventName = `${path}_POST_END`;
        enduranceEmitter.emit(eventName, {
          path,
          method: 'POST',
          req,
          res,
          responseData: responseInfo.data,
          responseStatus: responseInfo.status
        });
      } catch (error) {
        next(error);
      }
    });

    this.router.post(path, ...middlewares, ...wrappedHandlers);
  }
  /* eslint-enable no-dupe-class-members */

  public put(
    path: string,
    securityOptions: SecurityOptions = {},
    ...handlers: Array<(req: EnduranceRequest<T>, res: Response, next: NextFunction) => Promise<void>>
  ) {
    const middlewares = this.buildSecurityMiddleware(securityOptions);
    const wrappedHandlers = handlers.map(handler => async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Intercepter la réponse pour capturer le résultat
        const responseInfo = this.createResponseInterceptor(res);

        await handler(req as EnduranceRequest<T>, res, next);

        // Émettre l'événement de fin de route avec le résultat
        const eventName = `${path}_PUT_END`;
        enduranceEmitter.emit(eventName, {
          path,
          method: 'PUT',
          req,
          res,
          responseData: responseInfo.data,
          responseStatus: responseInfo.status
        });
      } catch (error) {
        next(error);
      }
    });
    this.router.put(path, ...middlewares, ...wrappedHandlers);
  }

  public delete(
    path: string,
    securityOptions: SecurityOptions = {},
    ...handlers: Array<(req: EnduranceRequest<T>, res: Response, next: NextFunction) => Promise<void>>
  ) {
    const middlewares = this.buildSecurityMiddleware(securityOptions);
    const wrappedHandlers = handlers.map(handler => async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Intercepter la réponse pour capturer le résultat
        const responseInfo = this.createResponseInterceptor(res);

        await handler(req as EnduranceRequest<T>, res, next);

        // Émettre l'événement de fin de route avec le résultat
        const eventName = `${path}_DELETE_END`;
        enduranceEmitter.emit(eventName, {
          path,
          method: 'DELETE',
          req,
          res,
          responseData: responseInfo.data,
          responseStatus: responseInfo.status
        });
      } catch (error) {
        next(error);
      }
    });
    this.router.delete(path, ...middlewares, ...wrappedHandlers);
  }

  public patch(
    path: string,
    securityOptions: SecurityOptions = {},
    ...handlers: Array<(req: EnduranceRequest<T>, res: Response, next: NextFunction) => Promise<void>>
  ) {
    const middlewares = this.buildSecurityMiddleware(securityOptions);
    const wrappedHandlers = handlers.map(handler => async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Intercepter la réponse pour capturer le résultat
        const responseInfo = this.createResponseInterceptor(res);

        await handler(req as EnduranceRequest<T>, res, next);

        // Émettre l'événement de fin de route avec le résultat
        const eventName = `${path}_PATCH_END`;
        enduranceEmitter.emit(eventName, {
          path,
          method: 'PATCH',
          req,
          res,
          responseData: responseInfo.data,
          responseStatus: responseInfo.status
        });
      } catch (error) {
        next(error);
      }
    });
    this.router.patch(path, ...middlewares, ...wrappedHandlers);
  }

  protected autoWireSecure(
    modelClass: typeof EnduranceSchema,
    modelName: string,
    securityOptions: SecurityOptions = {}
  ) {
    // Utiliser l'instance locale ou globale
    const authMiddleware = this.authMiddleware || EnduranceAuthMiddleware.getInstance();
    if (!authMiddleware) {
      throw new Error('authMiddleware is required for autoWireSecure. Set it via EnduranceAuthMiddleware.setInstance() or pass it to the router constructor.');
    }

    // GET /
    this.get('/', securityOptions, async (req: Request, res: Response) => {
      try {
        const Model = modelClass.getModel();
        const items = await Model.find();
        res.json(items);
      } catch (err) {
        if (authMiddleware) {
          authMiddleware.auth.handleAuthError(err, req, res, () => { });
        } else {
          res.status(500).json({ message: 'Internal server error' });
        }
      }
    });

    // GET /:id
    this.get('/:id', securityOptions, async (req: Request, res: Response) => {
      try {
        const Model = modelClass.getModel();
        const item = await Model.findById(req.params.id);
        if (!item) {
          res.status(404).json({ message: `${modelName} not found` });
          return;
        }
        res.json(item);
      } catch (err) {
        if (authMiddleware) {
          authMiddleware.auth.handleAuthError(err, req, res, () => { });
        } else {
          res.status(500).json({ message: 'Internal server error' });
        }
      }
    });

    // POST /
    this.post('/', securityOptions, async (req: Request, res: Response) => {
      try {
        const Model = modelClass.getModel();
        const item = new Model(req.body);
        const savedItem = await item.save();
        res.status(201).json(savedItem);
      } catch (err) {
        if (authMiddleware) {
          authMiddleware.auth.handleAuthError(err, req, res, () => { });
        } else {
          res.status(500).json({ message: 'Internal server error' });
        }
      }
    });

    // PATCH /:id
    this.patch('/:id', securityOptions, async (req: Request, res: Response) => {
      try {
        const Model = modelClass.getModel();
        const item = await Model.findById(req.params.id);
        if (!item) {
          res.status(404).json({ message: `${modelName} not found` });
          return;
        }
        Object.assign(item, req.body);
        const updatedItem = await item.save();
        res.json(updatedItem);
      } catch (err) {
        if (authMiddleware) {
          authMiddleware.auth.handleAuthError(err, req, res, () => { });
        } else {
          res.status(500).json({ message: 'Internal server error' });
        }
      }
    });

    // DELETE /:id
    this.delete('/:id', securityOptions, async (req: Request, res: Response) => {
      try {
        const Model = modelClass.getModel();
        const item = await Model.findById(req.params.id);
        if (!item) {
          res.status(404).json({ message: `${modelName} not found` });
          return;
        }
        await item.deleteOne();
        res.json({ message: `${modelName} deleted successfully` });
      } catch (err) {
        if (authMiddleware) {
          authMiddleware.auth.handleAuthError(err, req, res, () => { });
        } else {
          res.status(500).json({ message: 'Internal server error' });
        }
      }
    });
  }

  public getRouter(): Router {
    return this.router;
  }
}

export {
  EnduranceRouter,
  EnduranceRequest,
  Response,
  NextFunction,
  type SecurityOptions,
  FileUploadConfig
};
