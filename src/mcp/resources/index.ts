import type { Resource } from '@modelcontextprotocol/sdk/types.js';

interface ResourceHandler {
  handler: () => Promise<{
    contents: Array<{
      uri: string;
      mimeType?: string;
      text?: string;
    }>;
  }>;
}

interface ResourceRegistry {
  list(): Promise<{ resources: Resource[] }>;
  get(uri: string): ResourceHandler | undefined;
}

const resources: Map<string, Resource & ResourceHandler> = new Map();

function registerResource(resource: Resource & ResourceHandler): void {
  resources.set(resource.uri, resource);
}

export function registerResources(): ResourceRegistry {
  if (resources.size === 0) {
    registerResource(createNamingConventionsResource());
    registerResource(createFolderStructureResource());
    registerResource(createRouterDocumentationResource());
    registerResource(createSchemaDocumentationResource());
    registerResource(createAuthDocumentationResource());
    registerResource(createCodeStandardsResource());
    registerResource(createPatternsResource());
  }

  return {
    async list() {
      const resourcesList: Resource[] = Array.from(resources.values()).map(({ handler, ...resource }) => resource);
      return { resources: resourcesList };
    },
    get(uri: string) {
      const resource = resources.get(uri);
      if (!resource) {
        return undefined;
      }
      return {
        handler: resource.handler
      };
    }
  };
}

function createNamingConventionsResource(): Resource & ResourceHandler {
  return {
    uri: 'endurance://naming-conventions',
    name: 'Endurance Naming Conventions',
    description: 'File naming conventions for Endurance framework components',
    mimeType: 'text/markdown',
    handler: async () => {
      return {
        contents: [
          {
            uri: 'endurance://naming-conventions',
            mimeType: 'text/markdown',
            text: `# Endurance Naming Conventions

## File Naming Rules

All Endurance framework files must follow strict naming conventions based on their type:

### Routes
- **Pattern**: \`*.router.js\` or \`*.router.ts\`
- **Location**: \`src/routes/\` or \`src/modules/{moduleName}/routes/\`
- **Examples**:
  - \`users.router.js\`
  - \`users.v1.router.js\` (versioned)
  - \`products.router.js\`

### Listeners
- **Pattern**: \`*.listener.js\` or \`*.listener.ts\`
- **Location**: \`src/listeners/\` or \`src/modules/{moduleName}/listeners/\`
- **Examples**:
  - \`user-created.listener.js\`
  - \`order-processed.listener.js\`

### Consumers
- **Pattern**: \`*.consumer.js\` or \`*.consumer.ts\`
- **Location**: \`src/consumers/\` or \`src/modules/{moduleName}/consumers/\`
- **Examples**:
  - \`user-events.consumer.js\`
  - \`order-queue.consumer.js\`

### Cron Jobs
- **Pattern**: \`*.cron.js\` or \`*.cron.ts\`
- **Location**: \`src/crons/\` or \`src/modules/{moduleName}/crons/\`
- **Examples**:
  - \`cleanup.cron.js\`
  - \`backup.cron.js\`

### Middlewares
- **Pattern**: \`*.middleware.js\` or \`*.middleware.ts\`
- **Location**: \`src/middlewares/\` or \`src/modules/{moduleName}/middlewares/\`
- **Examples**:
  - \`auth.middleware.js\`
  - \`validation.middleware.js\`

## Class Naming

- **Router classes**: Should end with \`Router\` (e.g., \`UserRouter\`, \`ProductRouter\`)
- **Schema classes**: Should match the model name (e.g., \`User\`, \`Product\`)
- **Auth classes**: Should end with \`Auth\` (e.g., \`CustomAuth\`, \`UserAuth\`)
- **Access Control classes**: Should end with \`AccessControl\` (e.g., \`CustomAccessControl\`)

## Module Naming

- Modules should use kebab-case (e.g., \`user-management\`, \`order-processing\`)
- EDRM modules must start with \`edrm-\` prefix (e.g., \`edrm-users\`, \`@programisto/edrm-orders\`)`
          }
        ]
      };
    }
  };
}

function createFolderStructureResource(): Resource & ResourceHandler {
  return {
    uri: 'endurance://folder-structure',
    name: 'Endurance Folder Structure',
    description: 'Recommended folder structure for Endurance projects',
    mimeType: 'text/markdown',
    handler: async () => {
      return {
        contents: [
          {
            uri: 'endurance://folder-structure',
            mimeType: 'text/markdown',
            text: `# Endurance Folder Structure

## Standard Project Structure

\`\`\`
project-root/
├── src/
│   ├── routes/          # Application routes (*.router.js)
│   ├── listeners/       # Event listeners (*.listener.js)
│   ├── consumers/       # Kafka/AMQP consumers (*.consumer.js)
│   ├── crons/           # Cron jobs (*.cron.js)
│   ├── middlewares/     # Custom middlewares (*.middleware.js)
│   ├── schemas/         # Typegoose schemas (*.schema.ts)
│   ├── modules/         # Local modules
│   │   └── {moduleName}/
│   │       ├── routes/
│   │       ├── listeners/
│   │       ├── consumers/
│   │       ├── crons/
│   │       └── middlewares/
│   └── internal/        # Internal application files
├── dist/                # Compiled JavaScript (or use src/ for TypeScript)
├── node_modules/        # Dependencies
│   ├── @programisto/
│   │   └── endurance-core/
│   ├── edrm-*/          # EDRM marketplace modules
│   └── @*/edrm-*/       # Scoped EDRM modules
└── modules/             # Optional: override local modules directory
\`\`\`

## Module Discovery

Endurance automatically discovers:

1. **Local modules**: \`src/modules/\` or \`dist/modules/\`
2. **EDRM modules**: \`node_modules/edrm-*\` and \`node_modules/@*/edrm-*\`
3. **Marketplace modules**: Automatically loaded from installed packages

## File Detection

The framework automatically loads files based on:
- File extension (e.g., \`.router.js\`)
- Parent folder name (e.g., \`routes/\`, \`listeners/\`)
- Location within the project structure`
          }
        ]
      };
    }
  };
}

function createRouterDocumentationResource(): Resource & ResourceHandler {
  return {
    uri: 'endurance://router-documentation',
    name: 'EnduranceRouter Documentation',
    description: 'Complete documentation for EnduranceRouter class',
    mimeType: 'text/markdown',
    handler: async () => {
      return {
        contents: [
          {
            uri: 'endurance://router-documentation',
            mimeType: 'text/markdown',
            text: `# EnduranceRouter Documentation

## Overview

\`EnduranceRouter\` is an abstract class that provides a standardized way to define routes in Endurance applications.

## Basic Usage

\`\`\`typescript
import { EnduranceRouter } from '@programisto/endurance';
import { app } from '@programisto/endurance';

class MyRouter extends EnduranceRouter {
  protected setupRoutes(): void {
    this.get('/hello', {}, async (req, res) => {
      res.json({ message: 'Hello World' });
    });
  }
}

export default new MyRouter(app.getUpload());
\`\`\`

## HTTP Methods

### GET
\`\`\`typescript
this.get(path: string, securityOptions: SecurityOptions, ...handlers: RequestHandler[]): void
\`\`\`

### POST
\`\`\`typescript
this.post(path: string, securityOptions: SecurityOptions, fileConfig?: FileUploadConfig, ...handlers: RequestHandler[]): void
\`\`\`

### PUT, PATCH, DELETE
Similar signatures to GET and POST.

## Security Options

\`\`\`typescript
type SecurityOptions = {
  requireAuth?: boolean;      // Default: true
  permissions?: string[];      // Required permissions
  checkOwnership?: boolean;    // Restrict to resource owner
}
\`\`\`

**Example:**
\`\`\`typescript
// Public route
this.get('/public', { requireAuth: false }, async (req, res) => {
  res.json({ data: 'public' });
});

// Protected route with permissions
this.get('/admin', { permissions: ['admin'] }, async (req, res) => {
  res.json({ data: 'admin only' });
});

// Route restricted to owner
this.get('/profile', { checkOwnership: true }, async (req, res) => {
  res.json({ data: req.user });
});
\`\`\`

## File Uploads

Use \`FileUploadConfig\` for file uploads in POST routes:

\`\`\`typescript
import { FileUploadConfig } from '@programisto/endurance';

this.post('/upload', {}, FileUploadConfig.single('file', {
  allowedMimeTypes: ['image/jpeg', 'image/png'],
  maxFileSize: 5242880 // 5MB
}), async (req, res) => {
  const file = req.file;
  res.json({ filename: file.filename });
});
\`\`\`

## Auto-Wire Secure Routes

Automatically generate CRUD routes for a schema:

\`\`\`typescript
import { User } from '../schemas/user.schema.js';

this.autoWireSecure(User, 'User', {
  permissions: ['user:read']
});
\`\`\`

This generates:
- GET / - List all
- GET /:id - Get one
- POST / - Create
- PATCH /:id - Update
- DELETE /:id - Delete

## Events

Routes automatically emit events on completion:
- \`\${path}_GET_END\`
- \`\${path}_POST_END\`
- \`\${path}_PUT_END\`
- \`\${path}_DELETE_END\`
- \`\${path}_PATCH_END\``
          }
        ]
      };
    }
  };
}

function createSchemaDocumentationResource(): Resource & ResourceHandler {
  return {
    uri: 'endurance://schema-documentation',
    name: 'EnduranceSchema Documentation',
    description: 'Complete documentation for EnduranceSchema class',
    mimeType: 'text/markdown',
    handler: async () => {
      return {
        contents: [
          {
            uri: 'endurance://schema-documentation',
            mimeType: 'text/markdown',
            text: `# EnduranceSchema Documentation

## Overview

\`EnduranceSchema\` extends Typegoose functionality with Endurance-specific features like automatic event emission.

## Basic Usage

\`\`\`typescript
import { EnduranceSchema, EnduranceModelType } from '@programisto/endurance';

class User extends EnduranceSchema {
  @EnduranceModelType.prop({ required: true })
  name!: string;

  @EnduranceModelType.prop({ required: true, unique: true })
  email!: string;

  @EnduranceModelType.prop({ default: Date.now })
  createdAt!: Date;
}

export default User;

// Get the Mongoose model
const UserModel = User.getModel();
\`\`\`

## Typegoose Decorators

All Typegoose decorators are available via \`EnduranceModelType\`:

- \`@EnduranceModelType.prop()\` - Define a property
- \`@EnduranceModelType.pre()\` - Pre-hooks
- \`@EnduranceModelType.post()\` - Post-hooks
- \`@EnduranceModelType.modelOptions()\` - Model options
- \`@EnduranceModelType.index()\` - Indexes

## Automatic Event Emission

Schemas automatically emit events:

- \`\${ClassName}:preSave\` - Before saving a document

\`\`\`typescript
class User extends EnduranceSchema {
  @EnduranceModelType.prop({ required: true })
  name!: string;
}

// Event will be emitted: "User:preSave"
const user = new User({ name: 'John' });
await user.save();
\`\`\`

## Custom Event Emission

Emit custom events using the protected \`emitEvent()\` method:

\`\`\`typescript
class User extends EnduranceSchema {
  @EnduranceModelType.prop({ required: true })
  name!: string;

  async customMethod() {
    this.emitEvent('customAction', { data: 'value' });
  }
}
\`\`\`

## Getting the Model

Always use \`getModel()\` static method:

\`\`\`typescript
const UserModel = User.getModel();
const users = await UserModel.find();
const user = await UserModel.findById(id);
\`\`\`

## Default Schema Options

EnduranceSchema includes these default options:
- \`timestamps: true\` - Automatic createdAt/updatedAt
- \`toObject: { virtuals: true }\` - Include virtuals in plain objects
- \`toJSON: { virtuals: true }\` - Include virtuals in JSON
- \`strict: false\` - Allow additional fields`
          }
        ]
      };
    }
  };
}

function createAuthDocumentationResource(): Resource & ResourceHandler {
  return {
    uri: 'endurance://auth-documentation',
    name: 'Endurance Auth Documentation',
    description: 'Complete documentation for Endurance authentication system',
    mimeType: 'text/markdown',
    handler: async () => {
      return {
        contents: [
          {
            uri: 'endurance://auth-documentation',
            mimeType: 'text/markdown',
            text: `# Endurance Authentication Documentation

## Overview

Endurance provides a flexible authentication system based on abstract classes that you must extend.

## Components

### EnduranceAuth

Abstract class for authentication logic.

### EnduranceAccessControl

Abstract class for access control and permissions.

### EnduranceAuthMiddleware

Combines auth and access control into a middleware.

## Setup

\`\`\`typescript
import {
  EnduranceAuth,
  EnduranceAccessControl,
  EnduranceAuthMiddleware
} from '@programisto/endurance';

class MyAuth extends EnduranceAuth {
  async getUserById(userId: string): Promise<any> {
    // Implement user retrieval
  }

  async validatePassword(user: any, password: string): Promise<boolean> {
    // Implement password validation
  }

  async generateToken(user: any): Promise<string> {
    // Implement JWT generation
  }

  isAuthenticated() {
    return async (req, res, next) => {
      // Implement authentication middleware
      const token = req.headers.authorization?.replace('Bearer ', '');
      // Verify token and attach user to req.user
      next();
    };
  }

  // ... implement other abstract methods
}

class MyAccessControl extends EnduranceAccessControl {
  checkUserPermissions(
    permissions: string[],
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Check if user has required permissions
    const user = (req as any).user;
    const hasPermissions = permissions.every(p => user.permissions?.includes(p));
    if (!hasPermissions) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    next();
  }

  restrictToOwner(req: Request, res: Response, next: NextFunction): void {
    // Ensure user can only access their own resources
    const user = (req as any).user;
    const resource = req.params;
    if (user.id !== resource.userId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    next();
  }

  // ... implement other abstract methods
}

// Initialize and set middleware
const authMiddleware = new EnduranceAuthMiddleware(
  new MyAccessControl(),
  new MyAuth()
);
EnduranceAuthMiddleware.setInstance(authMiddleware);
\`\`\`

## Usage in Routes

Once set up, routes automatically use authentication:

\`\`\`typescript
// Protected route (default)
this.get('/profile', {}, async (req, res) => {
  // req.user is available here
  res.json(req.user);
});

// Public route
this.get('/public', { requireAuth: false }, async (req, res) => {
  res.json({ message: 'public' });
});

// Route with permissions
this.get('/admin', { permissions: ['admin'] }, async (req, res) => {
  res.json({ data: 'admin data' });
});
\`\`\``
          }
        ]
      };
    }
  };
}

function createCodeStandardsResource(): Resource & ResourceHandler {
  return {
    uri: 'endurance://code-standards',
    name: 'Endurance Code Standards',
    description: 'Coding standards and ESLint rules for Endurance projects',
    mimeType: 'text/markdown',
    handler: async () => {
      return {
        contents: [
          {
            uri: 'endurance://code-standards',
            mimeType: 'text/markdown',
            text: `# Endurance Code Standards

## ESLint Configuration

Endurance uses ESLint with the following standards:

- **Base**: \`standard\` config
- **Parser**: \`@typescript-eslint/parser\`
- **Plugins**: \`@typescript-eslint\`, \`security\`

## Key Rules

### Security
- \`security/detect-eval-with-expression\`: Error
- \`security/detect-child-process\`: Error
- \`security/detect-possible-timing-attacks\`: Warn
- \`security/detect-non-literal-fs-filename\`: Warn
- \`security/detect-unsafe-regex\`: Warn

### TypeScript
- \`@typescript-eslint/ban-ts-comment\`: Error (with exceptions for documented suppressions)
- \`semi\`: Error (always require semicolons)
- \`indent\`: Off (handled by formatter)

## Code Style

### Semicolons
Always use semicolons:
\`\`\`typescript
const value = 'hello';
function test() {
  return 'test';
}
\`\`\`

### TypeScript Strict Mode
- Always use TypeScript strict types
- Prefer \`interface\` over \`type\` for object shapes
- Use proper null/undefined handling

### Async/Await
Prefer async/await over promises:
\`\`\`typescript
// Good
async function fetchData() {
  const data = await api.get('/data');
  return data;
}

// Avoid
function fetchData() {
  return api.get('/data').then(data => data);
}
\`\`\`

### Error Handling
Always handle errors appropriately:
\`\`\`typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed:', error);
  throw error;
}
\`\`\`

## File Organization

- One class/interface per file
- Use named exports for classes
- Use default exports for instances
- Group related files in folders

## Imports

Order imports:
1. External dependencies
2. Internal core modules
3. Local modules
4. Types

\`\`\`typescript
// External
import express from 'express';
import { Types } from 'mongoose';

// Internal core
import { EnduranceSchema } from '@programisto/endurance';

// Local
import { UserService } from '../services/user.service.js';
\`\`\``
          }
        ]
      };
    }
  };
}

function createPatternsResource(): Resource & ResourceHandler {
  return {
    uri: 'endurance://patterns',
    name: 'Endurance Common Patterns',
    description: 'Common code patterns and best practices for Endurance',
    mimeType: 'text/markdown',
    handler: async () => {
      return {
        contents: [
          {
            uri: 'endurance://patterns',
            mimeType: 'text/markdown',
            text: `# Endurance Common Patterns

## CRUD Operations

### Complete CRUD Router

\`\`\`typescript
import { EnduranceRouter } from '@programisto/endurance';
import { User } from '../schemas/user.schema.js';

class UserRouter extends EnduranceRouter {
  protected setupRoutes(): void {
    // List all
    this.get('/', { permissions: ['user:read'] }, async (req, res) => {
      const UserModel = User.getModel();
      const users = await UserModel.find();
      res.json(users);
    });

    // Get one
    this.get('/:id', { permissions: ['user:read'] }, async (req, res) => {
      const UserModel = User.getModel();
      const user = await UserModel.findById(req.params.id);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.json(user);
    });

    // Create
    this.post('/', { permissions: ['user:create'] }, async (req, res) => {
      const UserModel = User.getModel();
      const user = new UserModel(req.body);
      const saved = await user.save();
      res.status(201).json(saved);
    });

    // Update
    this.patch('/:id', { permissions: ['user:update'] }, async (req, res) => {
      const UserModel = User.getModel();
      const user = await UserModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.json(user);
    });

    // Delete
    this.delete('/:id', { permissions: ['user:delete'] }, async (req, res) => {
      const UserModel = User.getModel();
      const deleted = await UserModel.findByIdAndDelete(req.params.id);
      if (!deleted) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.json({ message: 'User deleted' });
    });
  }
}
\`\`\`

## Event-Driven Patterns

### Emit Event After Operation

\`\`\`typescript
import { enduranceEmitter } from '@programisto/endurance';

this.post('/users', {}, async (req, res) => {
  const user = await createUser(req.body);
  
  // Emit event
  enduranceEmitter.emit('USER_CREATED', {
    userId: user.id,
    email: user.email
  });
  
  res.status(201).json(user);
});
\`\`\`

### Listen to Events

\`\`\`typescript
import { enduranceListener } from '@programisto/endurance';

// In a *.listener.js file
enduranceListener.createListener('USER_CREATED', async (data) => {
  console.log('User created:', data.userId);
  // Send welcome email, create audit log, etc.
});
\`\`\`

## Consumer Pattern

### Kafka Consumer

\`\`\`typescript
import { enduranceConsumer } from '@programisto/endurance';

// In a *.consumer.js file
await enduranceConsumer.createConsumer('kafka', {
  brokers: ['localhost:9092'],
  groupId: 'user-service',
  topic: 'user-events'
}, async (message) => {
  const event = JSON.parse(message.value.toString());
  await processUserEvent(event);
});
\`\`\`

## Cron Job Pattern

\`\`\`typescript
import { enduranceCron } from '@programisto/endurance';

// In a *.cron.js file
// Run every day at midnight
enduranceCron.loadCronJob('daily-cleanup', '0 0 * * *', async () => {
  await cleanupOldData();
  await sendDailyReport();
});
\`\`\`

## Error Handling Pattern

\`\`\`typescript
this.get('/users/:id', {}, async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    next(error); // Pass to error handler
  }
});
\`\`\`

## Validation Pattern

\`\`\`typescript
this.post('/users', {}, async (req, res) => {
  // Validate input
  const { name, email } = req.body;
  if (!name || !email) {
    res.status(400).json({ message: 'Name and email are required' });
    return;
  }
  
  // Process
  const user = await createUser({ name, email });
  res.status(201).json(user);
});
\`\`\``
          }
        ]
      };
    }
  };
}
