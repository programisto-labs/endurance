import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EnduranceSwagger {
  private getServerUrl(): string {
    // Priorité 1 : Variable d'environnement spécifique à Swagger (URL complète)
    if (process.env.SWAGGER_SERVER_URL) {
      return process.env.SWAGGER_SERVER_URL;
    }

    // Priorité 2 : Construire l'URL à partir du port (SERVER_PORT ou PORT)
    const port = process.env.SERVER_PORT || process.env.PORT || '3000';
    return `http://localhost:${port}`;
  }

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
    let options = { ...this.defaultOptions };

    if (fs.existsSync(swaggerConfigPath)) {
      try {
        const swaggerConfig = await import('file:///' + swaggerConfigPath, {
          assert: { type: 'json' }
        });
        options = swaggerConfig.default || options;
      } catch (error) {
        logger.warn(`Failed to load swagger.json from ${swaggerConfigPath}, using default options:`, error);
      }
    }

    // Mettre à jour l'URL du serveur avec la valeur déterminée dynamiquement
    const serverUrl = this.getServerUrl();

    // S'assurer que swaggerDefinition existe
    if (!options.swaggerDefinition) {
      options.swaggerDefinition = this.defaultOptions.swaggerDefinition;
    }

    // Mettre à jour l'URL du serveur
    if (options.swaggerDefinition.servers && options.swaggerDefinition.servers.length > 0) {
      options.swaggerDefinition.servers[0].url = serverUrl;
    } else {
      options.swaggerDefinition.servers = [
        {
          url: serverUrl,
          description: 'API Server'
        }
      ];
    }

    return options;
  }

  public async generateSwaggerSpec(apiFiles: string[]): Promise<any> {
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

  public setupSwagger(app: express.Application, swaggerSpec: any): void {
    // Créer un endpoint pour servir le JSON de la spécification OpenAPI
    app.get('/api-docs/swagger.json', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // Configurer Swagger UI pour utiliser l'endpoint JSON au lieu de window.location.origin
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      swaggerUrl: '/api-docs/swagger.json'
    }));
  }
}
export const enduranceSwagger = new EnduranceSwagger();
