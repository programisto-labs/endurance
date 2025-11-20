import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import path from 'path';

export function createAuthTool(): Tool & {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
} {
  return {
    name: 'create_auth',
    description: 'Create custom authentication classes (EnduranceAuth and EnduranceAccessControl) following Endurance conventions.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Base name for auth classes (e.g., "CustomAuth", "UserAuth")'
        },
        path: {
          type: 'string',
          description: 'Directory path where auth files should be created. Defaults to "src/auth"',
          default: 'src/auth'
        },
        createAccessControl: {
          type: 'boolean',
          description: 'Whether to create an EnduranceAccessControl class',
          default: true
        }
      },
      required: ['name']
    },
    handler: async (args) => {
      try {
        const authName = args.name as string;
        const authPath = (args.path as string) || 'src/auth';
        const createAccessControl = args.createAccessControl !== false;

        // Ensure directory exists
        await fs.ensureDir(path.join(process.cwd(), authPath));

        const createdFiles: string[] = [];

        // Create EnduranceAuth class
        const authClassName = authName.endsWith('Auth') ? authName : `${authName}Auth`;
        const authFileName = `${authClassName.toLowerCase()}.ts`;
        const authFilePath = path.join(process.cwd(), authPath, authFileName);

        if (await fs.pathExists(authFilePath)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Auth file ${authFileName} already exists at ${authFilePath}`
              }
            ],
            isError: true
          };
        }

        const authCode = `import {
  EnduranceAuth,
  EnduranceAccessControl,
  EnduranceAuthMiddleware
} from '@programisto/endurance';
import { Request, Response, NextFunction } from 'express';

class ${authClassName} extends EnduranceAuth {
  // Implement authentication methods
  async getUserById(userId: string): Promise<any> {
    // TODO: Implement user retrieval logic
    throw new Error('getUserById not implemented');
  }

  async validatePassword(user: any, password: string): Promise<boolean> {
    // TODO: Implement password validation logic
    throw new Error('validatePassword not implemented');
  }

  async storeRefreshToken(userId: string, token: string): Promise<void> {
    // TODO: Implement refresh token storage
    throw new Error('storeRefreshToken not implemented');
  }

  async getStoredRefreshToken(userId: string): Promise<string | null> {
    // TODO: Implement refresh token retrieval
    throw new Error('getStoredRefreshToken not implemented');
  }

  async deleteStoredRefreshToken(userId: string): Promise<void> {
    // TODO: Implement refresh token deletion
    throw new Error('deleteStoredRefreshToken not implemented');
  }

  async authenticateLocalAndGenerateTokens(email: string, password: string): Promise<any> {
    // TODO: Implement local authentication
    throw new Error('authenticateLocalAndGenerateTokens not implemented');
  }

  async authenticateAzureAndGenerateTokens(code: string): Promise<any> {
    // TODO: Implement Azure AD authentication
    throw new Error('authenticateAzureAndGenerateTokens not implemented');
  }

  async generateAzureTokens(user: any): Promise<any> {
    // TODO: Implement Azure token generation
    throw new Error('generateAzureTokens not implemented');
  }

  async refreshJwt(refreshToken: string): Promise<any> {
    // TODO: Implement JWT refresh
    throw new Error('refreshJwt not implemented');
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    // TODO: Implement refresh token revocation
    throw new Error('revokeRefreshToken not implemented');
  }

  async generateToken(user: any): Promise<string> {
    // TODO: Implement JWT token generation
    throw new Error('generateToken not implemented');
  }

  generateRefreshToken(): string {
    // TODO: Implement refresh token generation
    return Math.random().toString(36).substring(7);
  }

  isAuthenticated(): (req: Request, res: Response, next: NextFunction) => void {
    // TODO: Implement authentication middleware
    return async (req: Request, res: Response, next: NextFunction) => {
      // Add authentication logic here
      next();
    };
  }

  handleAuthError(err: any, req: any, res: any, next: any): void {
    // TODO: Implement error handling
    console.error('Auth error:', err);
    res.status(401).json({ message: 'Unauthorized' });
  }
}

${createAccessControl
    ? `class ${authClassName.replace('Auth', 'AccessControl')} extends EnduranceAccessControl {
  checkUserPermissions(
    permissions: string[],
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // TODO: Implement permission checking logic
    // Example: Check if user has required permissions
    next();
  }

  restrictToOwner(req: Request, res: Response, next: NextFunction): void {
    // TODO: Implement ownership restriction logic
    // Example: Ensure user can only access their own resources
    next();
  }

  authorize(...args: any[]): void {
    // TODO: Implement authorization logic
    throw new Error('authorize not implemented');
  }

  isAuthenticated(...args: any[]): void {
    // TODO: Implement authentication check
    throw new Error('isAuthenticated not implemented');
  }

  handleAuthError(err: any, req: any, res: any, next: any): void {
    // TODO: Implement error handling
    console.error('Access control error:', err);
    res.status(403).json({ message: 'Forbidden' });
  }
}`
    : ''}

${createAccessControl
    ? `// Initialize and set the auth middleware
const authInstance = new ${authClassName}();
const accessControlInstance = new ${authClassName.replace('Auth', 'AccessControl')}();
const authMiddleware = new EnduranceAuthMiddleware(accessControlInstance, authInstance);
EnduranceAuthMiddleware.setInstance(authMiddleware);`
    : ''}

export { ${authClassName}${createAccessControl ? `, ${authClassName.replace('Auth', 'AccessControl')}` : ''} };
`;

        await fs.writeFile(authFilePath, authCode, 'utf8');
        createdFiles.push(authFileName);

        if (createAccessControl) {
          createdFiles.push(`${authClassName.replace('Auth', 'AccessControl')} class`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Auth classes created successfully at ${authPath}\n\nCreated files:\n${createdFiles.map((f) => `  - ${f}`).join('\n')}\n\nImplement all abstract methods marked with TODO. ${createAccessControl ? 'The middleware is automatically initialized and set as the instance.' : ''}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating auth classes: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
