import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import path from 'path';

export function createSchemaTool(): Tool & {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
} {
  return {
    name: 'create_schema',
    description: 'Create a new Endurance schema (Typegoose model) extending EnduranceSchema. The schema will follow Endurance conventions with proper decorators.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the schema/model (e.g., "User", "Product")'
        },
        path: {
          type: 'string',
          description: 'Directory path where the schema should be created. Defaults to "src/schemas"',
          default: 'src/schemas'
        },
        fields: {
          type: 'array',
          description: 'Optional array of field definitions. Each field should have {name: string, type: string, required?: boolean}',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              required: { type: 'boolean' }
            }
          }
        }
      },
      required: ['name']
    },
    handler: async (args) => {
      try {
        const schemaName = args.name as string;
        const schemaPath = (args.path as string) || 'src/schemas';
        const fields = (args.fields as Array<{ name: string; type: string; required?: boolean }>) || [];

        const fileName = `${schemaName.toLowerCase()}.schema.ts`;

        const fullPath = path.join(process.cwd(), schemaPath, fileName);

        // Check if file already exists
        if (await fs.pathExists(fullPath)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Schema file ${fileName} already exists at ${fullPath}`
              }
            ],
            isError: true
          };
        }

        // Ensure directory exists
        await fs.ensureDir(path.dirname(fullPath));

        // Generate schema template
        const fieldDefinitions = fields.length > 0
          ? fields.map((field) => {
              const decoratorOptions = field.required !== false ? '{ required: true }' : '{}';
              return `  @EnduranceModelType.prop(${decoratorOptions})\n  ${field.name}!: ${field.type};`;
            }).join('\n\n')
          : '  // Add your schema fields here\n  // Example:\n  // @EnduranceModelType.prop({ required: true })\n  // name!: string;';

        const schemaCode = `import { EnduranceSchema, EnduranceModelType } from '@programisto/endurance';

class ${schemaName} extends EnduranceSchema {
${fieldDefinitions}
}

export default ${schemaName};
`;

        await fs.writeFile(fullPath, schemaCode, 'utf8');

        return {
          content: [
            {
              type: 'text',
              text: `Schema created successfully at ${fullPath}\n\nFile: ${fileName}\nClass: ${schemaName}\n\nUse ${schemaName}.getModel() to get the Mongoose model. Add more fields using @EnduranceModelType.prop() decorator.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating schema: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
