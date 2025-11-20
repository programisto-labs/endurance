import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import path from 'path';

export function createConsumerTool(): Tool & {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
} {
  return {
    name: 'create_consumer',
    description: 'Create a new Kafka or AMQP consumer following Endurance conventions. The file must be named *.consumer.js and placed in a consumers/ folder.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the consumer (e.g., "user-events", "order-queue")'
        },
        type: {
          type: 'string',
          description: 'Type of consumer: "kafka" or "amqp"',
          enum: ['kafka', 'amqp']
        },
        path: {
          type: 'string',
          description: 'Directory path where the consumer should be created. Defaults to "src/consumers"',
          default: 'src/consumers'
        },
        topic: {
          type: 'string',
          description: 'Topic/queue name (required for Kafka)'
        },
        queue: {
          type: 'string',
          description: 'Queue name (required for AMQP)'
        },
        brokers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of broker addresses (for Kafka, e.g., ["localhost:9092"])'
        },
        groupId: {
          type: 'string',
          description: 'Consumer group ID (for Kafka)'
        }
      },
      required: ['name', 'type']
    },
    handler: async (args) => {
      try {
        const consumerName = args.name as string;
        const consumerType = args.type as 'kafka' | 'amqp';
        const consumerPath = (args.path as string) || 'src/consumers';

        const fileName = `${consumerName}.consumer.js`;

        const fullPath = path.join(process.cwd(), consumerPath, fileName);

        // Check if file already exists
        if (await fs.pathExists(fullPath)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Consumer file ${fileName} already exists at ${fullPath}`
              }
            ],
            isError: true
          };
        }

        // Ensure directory exists
        await fs.ensureDir(path.dirname(fullPath));

        // Generate consumer template
        let consumerCode = '';

        if (consumerType === 'kafka') {
          const topic = args.topic as string || 'your-topic';
          const brokers = (args.brokers as string[]) || ['localhost:9092'];
          const groupId = args.groupId as string || 'your-group-id';

          consumerCode = `import { enduranceConsumer } from '@programisto/endurance';

// Create Kafka consumer
await enduranceConsumer.createConsumer('kafka', {
  brokers: ${JSON.stringify(brokers)},
  groupId: '${groupId}',
  topic: '${topic}',
}, (message) => {
  console.log('Received message:', message);
  // Add your message processing logic here
});
`;
        } else {
          const queue = args.queue as string || 'your-queue';

          consumerCode = `import { enduranceConsumer } from '@programisto/endurance';

// Create AMQP consumer
await enduranceConsumer.createConsumer('amqp', {
  url: process.env.AMQP_URL || 'amqp://localhost',
  queue: '${queue}',
}, (message) => {
  console.log('Received message:', message);
  // Add your message processing logic here
});
`;
        }

        await fs.writeFile(fullPath, consumerCode, 'utf8');

        return {
          content: [
            {
              type: 'text',
              text: `Consumer created successfully at ${fullPath}\n\nFile: ${fileName}\nType: ${consumerType}\n\nThe consumer will be automatically loaded by Endurance when placed in a consumers/ folder.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating consumer: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
