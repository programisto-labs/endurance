import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import path from 'path';

export function createRouterTool(): Tool & {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
} {
  return {
    name: 'create_router',
    description: 'Create a new Endurance router with proper structure. The router file will be created with the correct naming convention (*.router.js) and will extend EnduranceRouter.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the router (e.g., "users", "products"). The file will be named {name}.router.js'
        },
        path: {
          type: 'string',
          description: 'Directory path where the router should be created (e.g., "src/routes" or "src/modules/users/routes"). Defaults to "src/routes"',
          default: 'src/routes'
        },
        version: {
          type: 'string',
          description: 'Optional version for the router (e.g., "v1", "1.0"). If provided, file will be named {name}.{version}.router.js'
        }
      },
      required: ['name']
    },
    handler: async (args) => {
      try {
        const routerName = args.name as string;
        const routerPath = (args.path as string) || 'src/routes';
        const version = args.version as string | undefined;

        const fileName = version
          ? `${routerName}.${version}.router.js`
          : `${routerName}.router.js`;

        const fullPath = path.join(process.cwd(), routerPath, fileName);

        // Check if file already exists
        if (await fs.pathExists(fullPath)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Router file ${fileName} already exists at ${fullPath}`
              }
            ],
            isError: true
          };
        }

        // Ensure directory exists
        await fs.ensureDir(path.dirname(fullPath));

        // Generate router template
        const className = routerName
          .split(/[-_]/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join('') + 'Router';

        const routerCode = `import { EnduranceRouter } from '@programisto/endurance';
import { app } from '@programisto/endurance';

class ${className} extends EnduranceRouter {
  protected setupRoutes(): void {
    // Example route - customize as needed
    this.get('/', {}, async (req, res) => {
      res.json({ message: 'Hello from ${routerName} router' });
    });
  }
}

export default new ${className}(app.getUpload());
`;

        await fs.writeFile(fullPath, routerCode, 'utf8');

        return {
          content: [
            {
              type: 'text',
              text: `Router created successfully at ${fullPath}\n\nFile: ${fileName}\nClass: ${className}\n\nThe router extends EnduranceRouter and includes a basic example route. Customize the setupRoutes() method as needed.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating router: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
