import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import path from 'path';

export function createListenerTool(): Tool & {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
} {
  return {
    name: 'create_listener',
    description: 'Create a new event listener following Endurance conventions. The file must be named *.listener.js and placed in a listeners/ folder.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the listener (e.g., "user-created", "order-processed")'
        },
        eventName: {
          type: 'string',
          description: 'Event name to listen to (e.g., "USER_CREATED", "ORDER_PROCESSED")'
        },
        path: {
          type: 'string',
          description: 'Directory path where the listener should be created. Defaults to "src/listeners"',
          default: 'src/listeners'
        }
      },
      required: ['name', 'eventName']
    },
    handler: async (args) => {
      try {
        const listenerName = args.name as string;
        const eventName = args.eventName as string;
        const listenerPath = (args.path as string) || 'src/listeners';

        const fileName = `${listenerName}.listener.js`;

        const fullPath = path.join(process.cwd(), listenerPath, fileName);

        // Check if file already exists
        if (await fs.pathExists(fullPath)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Listener file ${fileName} already exists at ${fullPath}`
              }
            ],
            isError: true
          };
        }

        // Ensure directory exists
        await fs.ensureDir(path.dirname(fullPath));

        // Generate listener template
        const listenerCode = `import { enduranceListener } from '@programisto/endurance';

// Create listener for event: ${eventName}
enduranceListener.createListener('${eventName}', (data) => {
  console.log('Event ${eventName} received:', data);
  // Add your event handling logic here
});
`;

        await fs.writeFile(fullPath, listenerCode, 'utf8');

        return {
          content: [
            {
              type: 'text',
              text: `Listener created successfully at ${fullPath}\n\nFile: ${fileName}\nEvent: ${eventName}\n\nThe listener will be automatically loaded by Endurance when placed in a listeners/ folder.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating listener: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
