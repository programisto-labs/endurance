# Endurance Core

A modular and extensible TypeScript library for building secure, event-driven, Express-based backend systems — with support for authentication, routing, file uploads, Kafka/AMQP consumers, cron tasks, notifications, and Swagger documentation.

## Installation

yarn add endurance-core
# or
npm install endurance-core

## Getting Started

Import and initialize only the components you need. The library is modular and works well with Express, Mongoose/Typegoose, and event-driven architectures.

## Usage Examples

### Authentication Middleware

```
import {
  EnduranceAuthMiddleware,
  EnduranceAccessControl,
  EnduranceAuth
} from 'endurance-core';

class MyAccessControl extends EnduranceAccessControl {
  // Implement your access control logic here
}

class MyAuth extends EnduranceAuth {
  // Implement your authentication logic here
}

const middleware = new EnduranceAuthMiddleware(
  new MyAccessControl(),
  new MyAuth()
);

EnduranceAuthMiddleware.setInstance(middleware);
```

### Custom Router

```
import { EnduranceRouter } from 'endurance-core';

class MyRouter extends EnduranceRouter {
  protected setupRoutes() {
    this.get('/hello', {}, async (req, res) => {
      res.send('Hello World');
    });
  }
}
```

### Schema with Typegoose

```
import { EnduranceSchema, EnduranceModelType } from 'endurance-core';

class User extends EnduranceSchema {
  @EnduranceModelType.prop({ required: true })
  name!: string;
}

const UserModel = User.getModel();
```

### Kafka or AMQP Consumers

```
import { enduranceConsumer } from 'endurance-core';

await enduranceConsumer.createConsumer('kafka', {
  brokers: ['localhost:9092'],
  groupId: 'group',
  topic: 'my-topic',
}, message => {
  console.log('Received message:', message);
});
```

### Cron Jobs

```
import { enduranceCron } from 'endurance-core';

enduranceCron.loadCronJob('cacheClear', '0 * * * *', async () => {
  console.log('Clearing cache...');
});
```

### Event Emitters and Listeners

```
import {
  enduranceEmitter,
  enduranceListener,
  enduranceEventTypes
} from 'endurance-core';

enduranceListener.createListener('MY_EVENT', data => {
  console.log('Received:', data);
});

enduranceEmitter.emit(enduranceEventTypes.MY_EVENT, { hello: 'world' });
```

### Notifications

```
import { enduranceNotificationManager } from 'endurance-core';

enduranceNotificationManager.registerNotification('email', (opts) => {
  console.log('Sending email with:', opts);
});

enduranceNotificationManager.sendNotification('email', {
  to: 'user@example.com',
  subject: 'Welcome!',
});
```

### Swagger Integration

```
import express from 'express';
import { enduranceSwagger } from 'endurance-core';

const app = express();

const spec = await enduranceSwagger.generateSwaggerSpec(['./routes/*.ts']);
enduranceSwagger.setupSwagger(app, spec);
```

## Project Structure

```
src/
├── core/        # Authentication, Routing, Schema, Event system, etc.
├── infra/       # Cron jobs, Swagger, DB access
├── consumers/   # Kafka and AMQP logic
├── index.ts     # Public API
```

## CLI Commands

Endurance includes a CLI tool for project management and code generation.

### Installation

After installing `@programisto/endurance`, the CLI is available via `endurance` or `npx endurance`:

```bash
endurance --help
```

### Available Commands

#### Create New Project

```bash
endurance new-project
```

Creates a new Endurance project from a template. Templates are downloaded from GitHub and cached locally.

Options:
- `-t, --template <template>`: Template name (default: `endurance-template`)
- `-r, --repo <repo>`: GitHub repository URL or owner/repo (default: `programisto-labs/endurance-template`)
- `--skip-install`: Skip npm/yarn install after project creation

#### Create New Module

```bash
endurance new-module <moduleName>
```

Creates a new Endurance module with proper folder structure.

Options:
- `-p, --path <path>`: Path where the module should be created (default: `src/modules`)
- `-t, --template <template>`: Template name (default: `endurance-template-module`)
- `-r, --repo <repo>`: GitHub repository URL or owner/repo

Example:
```bash
endurance new-module user-management
```

#### List Events

```bash
endurance list-events
```

Lists all available events across modules and node_modules. Searches for `emitter.emit()` calls and `enduranceEventTypes` usage.

Options:
- `-p, --path <path>`: Base path to search (default: current directory)

#### List Environment Variables

```bash
endurance list-env-vars
```

Lists all environment variables used across modules and node_modules. Searches for `process.env.*` references.

Options:
- `-p, --path <path>`: Base path to search (default: current directory)

#### MCP Server

```bash
endurance mcp-server
```

Starts the Endurance MCP (Model Context Protocol) server for IDE integration (e.g., Cursor).

## MCP Server Integration

The Endurance MCP server allows IDEs like Cursor to understand and use Endurance framework conventions, constraints, and commands.

### Configuration

To use the Endurance MCP server in Cursor, add the following to your Cursor configuration (`.cursor/mcp.json` or Cursor settings):

```json
{
  "mcpServers": {
    "endurance": {
      "command": "endurance",
      "args": ["mcp-server"]
    }
  }
}
```

Or using the executable directly:

```json
{
  "mcpServers": {
    "endurance": {
      "command": "endurance-mcp"
    }
  }
}
```

### Available MCP Tools

The MCP server provides the following tools that can be executed by the AI:

- **`create_router`**: Create a new Endurance router with proper structure
- **`create_schema`**: Create a new Endurance schema (Typegoose model)
- **`create_module`**: Create a new Endurance module with folder structure
- **`create_listener`**: Create a new event listener
- **`create_consumer`**: Create a new Kafka/AMQP consumer
- **`create_cron`**: Create a new cron job
- **`create_auth`**: Generate custom authentication classes
- **`list_events`**: List all available events in the project
- **`list_env_vars`**: List all environment variables used in the project

### Available MCP Resources

The MCP server provides the following resources for documentation:

- **`endurance://naming-conventions`**: File naming conventions for Endurance components
- **`endurance://folder-structure`**: Recommended folder structure for Endurance projects
- **`endurance://router-documentation`**: Complete documentation for EnduranceRouter
- **`endurance://schema-documentation`**: Complete documentation for EnduranceSchema
- **`endurance://auth-documentation`**: Complete documentation for Endurance authentication
- **`endurance://code-standards`**: Coding standards and ESLint rules
- **`endurance://patterns`**: Common code patterns and best practices

### Available MCP Prompts

The MCP server provides prompt templates for:

- **`create-endurance-router`**: Template for creating routers
- **`create-endurance-schema`**: Template for creating schemas
- **`create-endurance-module`**: Template for creating modules
- **`create-endurance-crud`**: Template for creating CRUD operations
- **`create-endurance-event-driven`**: Template for creating event-driven features

## Scripts

# Run tests
```yarn test```

# Build the library
```yarn build```

# Clean build artifacts
```yarn clean```

## License

MIT
