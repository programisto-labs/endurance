// Import dependencies
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import logger, { morganStream } from '../core/logger.js';
import createError from 'http-errors';
import fs from 'fs';
import compression from 'compression';
import multer from 'multer';
import { enduranceEmitter, enduranceEventTypes } from '../core/emitter.js';
import { enduranceSwagger } from '../infra/swagger.js';
import { fileURLToPath } from 'url';
import { setupDistributedEmitter } from '../core/distributedEmitter.js';

class EnduranceApp {
  public app: express.Application;
  private port: number | string;
  private swaggerApiFiles: string[] = [];
  private __dirname: string;
  private isDirectUsage: boolean = false;
  private upload: multer.Multer;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    this.__dirname = path.dirname(__filename);
    this.app = express();
    this.port = process.env.SERVER_PORT || 3000;

    const storage = multer.diskStorage({
      destination: (req: Request, file: any, cb: (error: Error | null, destination: string) => void) => {
        const nodeModulesPath = this.__dirname.split('node_modules')[0];
        const projectRoot = path.dirname(nodeModulesPath);
        const uploadDir = path.join(projectRoot, 'uploads');

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        logger.info('Upload directory:', uploadDir);
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

    this.upload = multer({
      storage,
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880')
      }
    });

    // Support both package names for compatibility
    const nmPath = path.join('node_modules', '@programisto', 'endurance', 'dist', 'internal');
    (() => nmPath)();

    const currentFilePath = fileURLToPath(import.meta.url);
    const normalizedPath = currentFilePath.replace(/\\/g, '/');

    const forceDirectUsage = process.env.ENDURANCE_DIRECT_USAGE === 'true';
    const forceIndirectUsage = process.env.ENDURANCE_DIRECT_USAGE === 'false';

    const isTestEnvironment = process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID !== undefined ||
      normalizedPath.includes('/__tests__/') ||
      normalizedPath.includes('/node_modules/jest/');

    if (forceDirectUsage) {
      this.isDirectUsage = true;
    } else if (forceIndirectUsage || isTestEnvironment) {
      this.isDirectUsage = false;
    } else {
      const isInNodeModules = normalizedPath.includes('/node_modules/');
      const isInEnduranceCore = normalizedPath.includes('@programisto/endurance');

      const isInMainProjectNodeModules = this.isInMainProjectNodeModules(normalizedPath);

      const isDirect = !isInNodeModules ||
        (isInNodeModules && isInEnduranceCore && this.isSymlinkOrSource()) ||
        (isInNodeModules && isInEnduranceCore && isInMainProjectNodeModules);

      this.isDirectUsage = isDirect;
    }

    this.app.set('port', this.port);
    this.setupMiddlewares();
    this.setupCors();
    this.setupLogging();
    this.setupRoutes().then(() => {
      this.setupErrorHandling();
      this.setupDatabase();
    });
  }

  private setupMiddlewares() {
    const payloadLimit = process.env.REQUEST_PAYLOAD_LIMIT || '50mb';

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        next();
      } else {
        express.json({ limit: payloadLimit })(req, res, next);
      }
    });

    this.app.use(express.urlencoded({ extended: false, limit: payloadLimit }));
    this.app.use(cookieParser());
    this.app.use(compression());
  }

  private setupCors() {
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin) {
      const corsOptions: cors.CorsOptions = {
        origin: (origin, callback) => {
          if (!origin || corsOrigin === '*' || corsOrigin.split(',').includes(origin)) {
            callback(null, true); // Authorized
          } else {
            callback(new Error('CORS unauthorized')); // Rejected
          }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
      };
      this.app.use(cors(corsOptions));
      this.app.options('*', cors(corsOptions));
    }
  }

  private setupLogging() {
    this.app.use(morgan('combined', { stream: morganStream }));
  }

  private async setupRoutes() {
    const extractVersion = (filename: string): string | null => {
      const match = filename.match(/v?(\d+\.\d+\.\d+|\d+)/);
      return match ? match[1] : null;
    };

    const loadRoutes = async (basePath: string, filePath: string, version: string | null) => {
      try {
        const { default: router } = await import('file:///' + filePath);
        const versionedPath = version ? `/v${version}${basePath}` : basePath;
        this.app.use(versionedPath, router.getRouter());
        this.swaggerApiFiles.push(filePath);
      } catch (err) {
        logger.error(`❌ Error loading routes from ${filePath}:`);
        if (err instanceof AggregateError) {
          for (const e of err.errors) {
            logger.error(e.stack || e.message || e);
            console.error('Error details:', e);
          }
        } else {
          if (typeof err === 'object' && err !== null && ('stack' in err || 'message' in err)) {
            logger.error((err as { stack?: string; message?: string }).stack || (err as { message?: string }).message || err);
            console.error('Error details:', err);
          } else {
            logger.error(err);
            console.error('Error details:', err);
          }
        }
      }
    };

    const loadServer = async () => {
      const isDirectory = (filePath: string): boolean => fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();

      const endsWith = (filePath: string, suffix: string): boolean => filePath.endsWith(suffix);
      const routesMap = new Map<string, Map<string, string>>();

      const processFile = async (folderPath: string, file: string, actualFilePath?: string) => {
        const filePath = actualFilePath || path.join(folderPath, file);

        if (isDirectory(filePath)) {
          await readModulesFolder(filePath, filePath);
        } else if (endsWith(folderPath, 'public')) {
          this.app.use(express.static(folderPath));
        } else if (
          (endsWith(file, '.listener.js') && endsWith(folderPath, 'listeners')) ||
          (endsWith(file, '.consumer.js') && endsWith(folderPath, 'consumers')) ||
          (endsWith(file, '.middleware.js') && endsWith(folderPath, 'middlewares')) ||
          (endsWith(file, '.cron.js') && endsWith(folderPath, 'crons'))
        ) {
          try {
            await import('file:///' + filePath);
          } catch (err) {
            logger.error(`Error loading file ${filePath}:`, err);
          }
        } else if (endsWith(file, '.router.js') && endsWith(folderPath, 'routes')) {
          const routerName = path.basename(file, '.router.js');
          const version = extractVersion(routerName);
          const basePath = `/${routerName.replace(`.${version}`, '')}`;

          if (!routesMap.has(basePath)) {
            routesMap.set(basePath, new Map());
          }
          routesMap.get(basePath)!.set(version || 'default', filePath);
          logger.debug(`Route ajoutée à Swagger: ${filePath} (basePath: ${basePath}, version: ${version || 'default'})`);
        }
      };

      const readModulesFolder = async (folderPath: string, overridePath: string, skipMiddlewares: boolean = false) => {
        try {
          const files = fs.readdirSync(folderPath);
          const directories: string[] = [];
          const middlewareFiles: { folderPath: string; file: string; actualFilePath?: string }[] = [];
          const routerFiles: { folderPath: string; file: string; actualFilePath?: string }[] = [];
          const otherFiles: { folderPath: string; file: string; actualFilePath?: string }[] = [];

          // Séparer les fichiers par type
          for (const file of files) {
            const filePath = path.join(folderPath, file);

            if (isDirectory(filePath)) {
              directories.push(file);
            } else {
              const overrideFilePath = overridePath && overridePath !== ''
                ? path.join(overridePath, file)
                : null;
              const hasOverride = overrideFilePath && fs.existsSync(overrideFilePath);
              const actualFilePath = hasOverride ? overrideFilePath : filePath;
              const actualFolderPath = hasOverride ? overridePath : folderPath;

              if (endsWith(file, '.middleware.js') && endsWith(actualFolderPath, 'middlewares')) {
                middlewareFiles.push({ folderPath: actualFolderPath, file, actualFilePath });
              } else if (endsWith(file, '.router.js') && endsWith(actualFolderPath, 'routes')) {
                routerFiles.push({ folderPath: actualFolderPath, file, actualFilePath });
              } else {
                otherFiles.push({ folderPath: actualFolderPath, file, actualFilePath });
              }
            }
          }

          // 1. Charger d'abord tous les middlewares (sauf si on les a déjà chargés)
          if (!skipMiddlewares) {
            for (const { folderPath: fp, file, actualFilePath } of middlewareFiles) {
              try {
                await processFile(fp, file, actualFilePath);
              } catch (err) {
                logger.error(`Error processing middleware file ${file}:`, err);
              }
            }
          }

          // 2. Charger les autres fichiers (listeners, consumers, crons, etc.)
          for (const { folderPath: fp, file, actualFilePath } of otherFiles) {
            try {
              await processFile(fp, file, actualFilePath);
            } catch (err) {
              logger.error(`Error processing file ${file}:`, err);
            }
          }

          // 3. Traiter les sous-dossiers récursivement
          for (const dir of directories) {
            const filePath = path.join(folderPath, dir);
            const overrideSubPath = overridePath && overridePath !== ''
              ? path.join(overridePath, dir)
              : '';
            await readModulesFolder(filePath, overrideSubPath, skipMiddlewares);
          }

          // 4. Enfin, enregistrer les routes (mais ne pas les charger encore)
          for (const { folderPath: fp, file, actualFilePath } of routerFiles) {
            try {
              await processFile(fp, file, actualFilePath);
            } catch (err) {
              logger.error(`Error processing router file ${file}:`, err);
            }
          }
        } catch (err) {
          logger.error('Error reading directory:', err);
        }
      };

      const loadMarketplaceModules = async () => {
        const nodeModulesPath = path.join(process.cwd(), 'node_modules');
        const localModulesPath = path.join(process.cwd(), 'modules');

        const isDirectory = (filePath: string) => fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();

        try {
          const moduleEntries: { name: string; path: string; distPath?: string; basePath?: string }[] = [];

          const rootModules = fs.readdirSync(nodeModulesPath);
          for (const moduleName of rootModules) {
            const fullPath = path.join(nodeModulesPath, moduleName);
            if (moduleName.startsWith('edrm-') && isDirectory(fullPath)) {
              const distPath = path.join(fullPath, 'dist');
              moduleEntries.push({
                name: moduleName,
                path: fullPath,
                distPath: isDirectory(distPath) ? distPath : undefined,
                basePath: isDirectory(fullPath) ? fullPath : undefined
              });
            }

            if (moduleName.startsWith('@') && isDirectory(fullPath)) {
              const scopedPackages = fs.readdirSync(fullPath);
              for (const pkg of scopedPackages) {
                if (pkg.startsWith('edrm-')) {
                  const scopedPath = path.join(fullPath, pkg);
                  if (isDirectory(scopedPath)) {
                    const distPath = path.join(scopedPath, 'dist');
                    moduleEntries.push({
                      name: `${moduleName}/${pkg}`,
                      path: scopedPath,
                      distPath: isDirectory(distPath) ? distPath : undefined,
                      basePath: isDirectory(scopedPath) ? scopedPath : undefined
                    });
                  }
                }
              }
            }
          }

          // Phase 1 : Charger TOUS les middlewares de TOUS les modules EDRM
          // Cela garantit que l'instance d'authentification est disponible avant l'instanciation des routes
          for (const moduleEntry of moduleEntries) {
            logger.info('Loading EDRM module middlewares:', moduleEntry.name);
            const localModulePath = path.join(localModulesPath, ...moduleEntry.name.split('/'));
            const modulePath = moduleEntry.distPath || moduleEntry.basePath;

            if (modulePath) {
              // Charger uniquement les middlewares dans cette phase
              const loadMiddlewaresOnly = async (folderPath: string, overridePath: string) => {
                try {
                  const files = fs.readdirSync(folderPath);
                  for (const file of files) {
                    const filePath = path.join(folderPath, file);
                    if (isDirectory(filePath)) {
                      await loadMiddlewaresOnly(filePath, overridePath ? path.join(overridePath, file) : '');
                    } else if (endsWith(file, '.middleware.js') && endsWith(folderPath, 'middlewares')) {
                      const overrideFilePath = overridePath && overridePath !== ''
                        ? path.join(overridePath, file)
                        : null;
                      const hasOverride = overrideFilePath && fs.existsSync(overrideFilePath);
                      const actualFilePath = hasOverride ? overrideFilePath : filePath;
                      try {
                        await import('file:///' + actualFilePath);
                        logger.debug(`Loaded middleware: ${actualFilePath}`);
                      } catch (err) {
                        logger.error(`Error loading middleware ${file}:`, err);
                      }
                    }
                  }
                } catch (err) {
                  // Ignorer les erreurs de lecture de dossier
                }
              };
              await loadMiddlewaresOnly(modulePath, localModulePath);
            }
          }

          // Phase 2 : Charger les routes et autres fichiers de tous les modules
          // À ce stade, tous les middlewares sont déjà chargés, donc l'instance d'authentification est disponible
          // On passe skipMiddlewares=true pour éviter de les recharger
          for (const moduleEntry of moduleEntries) {
            logger.info('Loading EDRM module routes:', moduleEntry.name);
            const localModulePath = path.join(localModulesPath, ...moduleEntry.name.split('/'));
            const modulePath = moduleEntry.distPath || moduleEntry.basePath;

            if (modulePath) {
              logger.info(`Loading from ${moduleEntry.distPath ? 'dist' : 'standard'} directory:`, modulePath);
              await readModulesFolder(modulePath, localModulePath, true);
            } else {
              logger.warn(`Module ${moduleEntry.name} has no usable folder (dist or base).`);
            }
          }
        } catch (err) {
          logger.error('Error reading node_modules:', err);
        }
      };

      await loadMarketplaceModules();

      let modulesFolder = path.join(process.cwd(), 'dist/modules');

      if (isDirectory(modulesFolder)) {
        await readModulesFolder(modulesFolder, '');
      } else {
        modulesFolder = path.join(process.cwd(), 'src/modules');
        await readModulesFolder(modulesFolder, '');
      }

      for (const [basePath, versionsMap] of routesMap) {
        const sortedVersions = Array.from(versionsMap.keys()).sort((a, b) => {
          if (a === 'default') return -1;
          if (b === 'default') return 1;
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
        for (let index = 0; index < sortedVersions.length; index++) {
          const version = sortedVersions[index];
          if (version === 'default') {
            await loadRoutes(basePath, versionsMap.get(version)!, null);
          } else {
            await loadRoutes(basePath, versionsMap.get(version)!, version);
          }

          if (index > 0) {
            const previousVersion = sortedVersions[index - 1];
            const fallbackPath = `/v${version}${basePath}`;
            const previousPath = `/v${previousVersion}${basePath}`;

            this.app.use(fallbackPath, (req: Request, res: Response, next: NextFunction) => {
              req.url = previousPath + req.url;
              next();
            });
          }
        }
      }

      this.app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.originalUrl === '/favicon.ico') {
          res.status(204).end(); // No Content
        } else {
          next();
        }
      });

      const enableSwagger = process.env.SWAGGER !== 'false';
      if (enableSwagger) {
        logger.info(`📚 Génération de la documentation Swagger avec ${this.swaggerApiFiles.length} fichier(s) de routes`);
        const swaggerSpec = await enduranceSwagger.generateSwaggerSpec(this.swaggerApiFiles);
        await enduranceSwagger.setupSwagger(this.app, swaggerSpec);
      }

      if (process.env.NODE_ENV !== 'production') {
        this.app.get('/cause-error', (req: Request, res: Response) => {
          const error = new Error('Intentional error');
          (error as any).status = 500;
          res.status(500).json({ message: error.message });
        });
      }
    };

    await loadServer();
  }

  private setupErrorHandling() {
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      next(createError(404));
    });

    this.app.use((err: any, req: Request, res: Response) => {
      res.locals.message = err.message;
      res.locals.error = req.app.get('env') === 'development' ? err : {};

      res.status(err.status || 500);
      res.render('error');
    });
  }

  private setupDatabase() {
    if (process.env.MONGODB_HOST) {
      import('../infra/database.js').then(({ enduranceDatabase }) => {
        this.app.use(
          session({
            secret: process.env.SESSION_SECRET || 'endurance',
            resave: false,
            saveUninitialized: false,
            store: enduranceDatabase.createStore()
          })
        );

        enduranceDatabase.connect()
          .then(({ conn }) => {
            const db = conn.db;
            if (!db) {
              logger.warn('[endurance-core] MongoDB connection established, but no database instance found.');
              return;
            }
            setupDistributedEmitter(conn.db);

            if (this.isDirectUsage) {
              this.startServer();
            }
          })
          .catch((err: Error) => {
            logger.error('Error connecting to MongoDB', err);
          });
      });
    } else {
      this.app.use(
        session({
          secret: process.env.SESSION_SECRET || 'endurance',
          resave: false,
          saveUninitialized: false,
          store: new session.MemoryStore()
        })
      );
      if (this.isDirectUsage) {
        this.startServer();
      }
    }
  }

  private startServer() {
    logger.info(`
      ______           _                                
     |  ____|         | |                               
     | |__   _ __   __| |_   _ _ __ __ _ _ __   ___ ___ 
     |  __| | '_ \\ / _\` | | | | '__/ _\` | '_ \\ / __/ _ \\
     | |____| | | | (_| | |_| | | | (_| | | | | (_|  __/
     |______|_| |_|\\__,_|\\__,_|_|  \\__,_|_| |_|\\___\\___|
                                                        
                                                        
    `);
    this.app.listen(this.port, () => {
      logger.info(`Server listening on port ${this.port}`);
      enduranceEmitter.emit(enduranceEventTypes.APP_STARTED);
    });
  }

  public getUpload() {
    return this.upload;
  }

  /**
   * Checks if Endurance is loaded from the top-level project's node_modules
   * and not from an EDRM module's nested node_modules.
   *
   * Start server (direct usage):
   * - /project/node_modules/@programisto/endurance
   * - /project-edrm/node_modules/@programisto/endurance
   *
   * Do NOT start server (indirect usage via EDRM dependency):
   * - /project/node_modules/@programisto/edrm-xxx/node_modules/@programisto/endurance (scoped @programisto)
   * - /project/node_modules/@org/edrm-xxx/node_modules/@programisto/endurance (scoped other org)
   * - /project/node_modules/edrm-xxx/node_modules/@programisto/endurance (non-scoped, no org)
   */
  private isInMainProjectNodeModules(normalizedPath: string): boolean {
    try {
      const cwd = process.cwd().replace(/\\/g, '/');

      // Check if Endurance is inside an EDRM module's node_modules (dependency, not top-level)
      // This covers all cases: scoped (@org/edrm-xxx) and non-scoped (edrm-xxx)
      // Examples:
      // - /node_modules/@programisto/edrm-xxxx/node_modules/@programisto/endurance
      // - /node_modules/@autreOrg/edrm-xxx/node_modules/@programisto/endurance
      // - /node_modules/edrm-xxx/node_modules/@programisto/endurance
      const nodeModulesIndex = normalizedPath.indexOf('/node_modules/');
      if (nodeModulesIndex !== -1) {
        const afterFirstNodeModules = normalizedPath.substring(nodeModulesIndex + '/node_modules/'.length);

        // Check if there's an EDRM module pattern before @programisto/endurance
        // Pattern: [scope?]edrm-xxx/node_modules/@programisto/endurance
        const edrmPattern = /edrm-[^/]+\/node_modules\/@programisto\/endurance/;
        if (edrmPattern.test(afterFirstNodeModules)) {
          return false;
        }
      }

      // Check if Endurance is directly in the project's node_modules (top level)
      // Pattern: /path/to/project/node_modules/@programisto/endurance
      const firstNodeModulesIndex = normalizedPath.indexOf('/node_modules/');
      if (firstNodeModulesIndex !== -1) {
        const pathAfterFirstNodeModules = normalizedPath.substring(firstNodeModulesIndex + '/node_modules/'.length);

        // If directly after node_modules we find @programisto/endurance, it's top-level
        if (pathAfterFirstNodeModules.startsWith('@programisto/endurance')) {
          const pathBeforeNodeModules = normalizedPath.substring(0, firstNodeModulesIndex);
          // Ensure the path before node_modules is not itself in node_modules
          if (!pathBeforeNodeModules.includes('/node_modules/')) {
            return true;
          }
        }
      }

      // Also check if we're in the current working directory's node_modules
      const expectedPath = `${cwd}/node_modules/@programisto/endurance`;
      if (normalizedPath.startsWith(expectedPath)) {
        // Ensure cwd is not in node_modules (to avoid false positives)
        if (!cwd.includes('/node_modules/')) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.warn('Error checking main project node_modules:', error);
      return false;
    }
  }

  /**
   * Detects if the module is a symlink or running from source code.
   * Useful in monorepo contexts with symlinks.
   */
  private isSymlinkOrSource(): boolean {
    try {
      const fs = require('fs');
      const currentFilePath = fileURLToPath(import.meta.url);
      const packageJsonPath = path.join(path.dirname(currentFilePath), '..', '..', 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        const realPath = fs.realpathSync(currentFilePath);
        const isSymlink = realPath !== currentFilePath;

        const isDevContext = (packageJson.name === '@programisto/endurance' ||
          packageJson.name === '@programisto/endurance') &&
          (packageJson.scripts?.dev || packageJson.scripts?.build);

        return isSymlink || isDevContext;
      }

      return false;
    } catch (error) {
      return true;
    }
  }
}

export default new EnduranceApp().app;
