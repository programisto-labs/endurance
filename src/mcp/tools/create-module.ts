import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import path from 'path';

export function createModuleTool(): Tool & {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
} {
  return {
    name: 'create_module',
    description: 'Create a new Endurance module with proper folder structure (routes, listeners, consumers, crons, middlewares). Modules can be placed in src/modules/ or dist/modules/.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the module (e.g., "users", "products")'
        },
        path: {
          type: 'string',
          description: 'Base path for modules. Defaults to "src/modules"',
          default: 'src/modules'
        },
        createRoutes: {
          type: 'boolean',
          description: 'Whether to create a routes folder with example router',
          default: true
        },
        createListeners: {
          type: 'boolean',
          description: 'Whether to create a listeners folder',
          default: false
        },
        createConsumers: {
          type: 'boolean',
          description: 'Whether to create a consumers folder',
          default: false
        },
        createCrons: {
          type: 'boolean',
          description: 'Whether to create a crons folder',
          default: false
        }
      },
      required: ['name']
    },
    handler: async (args) => {
      try {
        const moduleName = args.name as string;
        const basePath = (args.path as string) || 'src/modules';
        const createRoutes = args.createRoutes !== false;
        const createListeners = args.createListeners === true;
        const createConsumers = args.createConsumers === true;
        const createCrons = args.createCrons === true;

        const modulePath = path.join(process.cwd(), basePath, moduleName);

        // Check if module already exists
        if (await fs.pathExists(modulePath)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Module ${moduleName} already exists at ${modulePath}`
              }
            ],
            isError: true
          };
        }

        // Create module directory structure
        const createdFolders: string[] = [];

        if (createRoutes) {
          const routesPath = path.join(modulePath, 'routes');
          await fs.ensureDir(routesPath);
          createdFolders.push('routes/');

          // Create example router
          const routerClassName = moduleName
            .split(/[-_]/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('') + 'Router';

          const routerCode = `import { EnduranceRouter } from '@programisto/endurance';
import { app } from '@programisto/endurance';

class ${routerClassName} extends EnduranceRouter {
  protected setupRoutes(): void {
    this.get('/', {}, async (req, res) => {
      res.json({ message: 'Hello from ${moduleName} module' });
    });
  }
}

export default new ${routerClassName}(app.getUpload());
`;

          await fs.writeFile(
            path.join(routesPath, `${moduleName}.router.js`),
            routerCode,
            'utf8'
          );
        }

        if (createListeners) {
          const listenersPath = path.join(modulePath, 'listeners');
          await fs.ensureDir(listenersPath);
          createdFolders.push('listeners/');
        }

        if (createConsumers) {
          const consumersPath = path.join(modulePath, 'consumers');
          await fs.ensureDir(consumersPath);
          createdFolders.push('consumers/');
        }

        if (createCrons) {
          const cronsPath = path.join(modulePath, 'crons');
          await fs.ensureDir(cronsPath);
          createdFolders.push('crons/');
        }

        return {
          content: [
            {
              type: 'text',
              text: `Module "${moduleName}" created successfully at ${modulePath}\n\nCreated folders:\n${createdFolders.map((f) => `  - ${f}`).join('\n')}\n\nFollow Endurance naming conventions:\n  - Routes: *.router.js\n  - Listeners: *.listener.js\n  - Consumers: *.consumer.js\n  - Crons: *.cron.js\n  - Middlewares: *.middleware.js`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating module: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
