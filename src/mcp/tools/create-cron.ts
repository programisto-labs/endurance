import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import path from 'path';

export function createCronTool(): Tool & {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
} {
  return {
    name: 'create_cron',
    description: 'Create a new cron job following Endurance conventions. The file must be named *.cron.js and placed in a crons/ folder.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the cron job (e.g., "cleanup", "backup")'
        },
        schedule: {
          type: 'string',
          description: 'Cron schedule expression (e.g., "0 * * * *" for every hour)',
          default: '0 * * * *'
        },
        path: {
          type: 'string',
          description: 'Directory path where the cron should be created. Defaults to "src/crons"',
          default: 'src/crons'
        },
        description: {
          type: 'string',
          description: 'Optional description of what the cron job does'
        }
      },
      required: ['name']
    },
    handler: async (args) => {
      try {
        const cronName = args.name as string;
        const schedule = (args.schedule as string) || '0 * * * *';
        const cronPath = (args.path as string) || 'src/crons';
        const description = (args.description as string) || 'Scheduled task';

        const fileName = `${cronName}.cron.js`;

        const fullPath = path.join(process.cwd(), cronPath, fileName);

        // Check if file already exists
        if (await fs.pathExists(fullPath)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Cron file ${fileName} already exists at ${fullPath}`
              }
            ],
            isError: true
          };
        }

        // Ensure directory exists
        await fs.ensureDir(path.dirname(fullPath));

        // Generate cron template
        const cronCode = `import { enduranceCron } from '@programisto/endurance';

// ${description}
// Schedule: ${schedule}
enduranceCron.loadCronJob('${cronName}', '${schedule}', async () => {
  console.log('Running cron job: ${cronName}');
  // Add your cron job logic here
});
`;

        await fs.writeFile(fullPath, cronCode, 'utf8');

        return {
          content: [
            {
              type: 'text',
              text: `Cron job created successfully at ${fullPath}\n\nFile: ${fileName}\nSchedule: ${schedule}\nDescription: ${description}\n\nThe cron job will be automatically loaded by Endurance when placed in a crons/ folder.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating cron job: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
