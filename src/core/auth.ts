import { Request, Response, NextFunction } from 'express';

abstract class EnduranceAccessControl {
  abstract checkUserPermissions(
    permissions: string[],
    req: Request,
    res: Response,
    next: NextFunction
  ): void;

  abstract restrictToOwner(
    req: Request,
    res: Response,
    next: NextFunction
  ): void;

  abstract authorize(...args: any[]): void;
  abstract isAuthenticated(...args: any[]): void;
  abstract handleAuthError(err: any, req: any, res: any, next: any): void;

  asyncHandler(fn: (req: any, res: any, next: any) => Promise<void>) {
    return (req: any, res: any, next: any): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

abstract class EnduranceAuth {
  abstract getUserById(...args: any[]): void;
  abstract validatePassword(...args: any[]): void;
  abstract storeRefreshToken(...args: any[]): void;
  abstract getStoredRefreshToken(...args: any[]): void;
  abstract deleteStoredRefreshToken(...args: any[]): void;
  abstract authenticateLocalAndGenerateTokens(...args: any[]): void;
  abstract authenticateAzureAndGenerateTokens(...args: any[]): void;
  abstract generateAzureTokens(...args: any[]): void;
  abstract refreshJwt(...args: any[]): void;
  abstract revokeRefreshToken(...args: any[]): void;
  abstract generateToken(...args: any[]): void;
  abstract generateRefreshToken(...args: any[]): string;
  abstract isAuthenticated(): (req: Request, res: Response, next: NextFunction) => void;
  abstract handleAuthError(err: any, req: any, res: any, next: any): void;

  asyncHandler(fn: (req: any, res: any, next: any) => Promise<void>) {
    return (req: any, res: any, next: any): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

class EnduranceAuthMiddleware {
  public accessControl: EnduranceAccessControl;
  public auth: EnduranceAuth;
  private static instance: any = null;

  constructor(accessControlInstance: EnduranceAccessControl, authInstance: EnduranceAuth) {
    this.accessControl = accessControlInstance;
    this.auth = authInstance;
  }

  public static getInstance(): EnduranceAuthMiddleware {
    return EnduranceAuthMiddleware.instance;
  }

  public static setInstance(instance: EnduranceAuthMiddleware): void {
    EnduranceAuthMiddleware.instance = instance;
  }
}

export { EnduranceAuthMiddleware, EnduranceAccessControl, EnduranceAuth };
