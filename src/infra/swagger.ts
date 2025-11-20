import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EnduranceSwagger {
  private defaultOptions = {
    swaggerDefinition: {
      openapi: '3.0.0',
      info: {
        title: 'Endurance API',
        version: '1.0.0',
        description: 'Description of the Endurance API'
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local server'
        }
      ],
      components: {
        schemas: {}
      }
    },
    apis: []
  };

  private async loadOptions() {
    const swaggerConfigPath = path.resolve(__dirname, '../../../swagger.json');
    if (fs.existsSync(swaggerConfigPath)) {
      const swaggerConfig = await import('file:///' + swaggerConfigPath, {
        assert: { type: 'json' }
      });
      return swaggerConfig.default;
    }
    return this.defaultOptions;
  }

  public async generateSwaggerSpec(apiFiles: any) {
    const options = await this.loadOptions();
    const updatedOptions = {
      swaggerDefinition: {
        ...options.swaggerDefinition,
        components: {
          schemas: {}
        }
      },
      apis: apiFiles
    };

    return swaggerJsdoc(updatedOptions);
  }

  public setupSwagger(app: any, swaggerSpec: any) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }
}
export const enduranceSwagger = new EnduranceSwagger();
