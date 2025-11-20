#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

class EnduranceMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'endurance-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return registerTools().list();
    });

    // Call a tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tools = registerTools();
      const tool = tools.get(request.params.name);
      if (!tool) {
        throw new Error(`Tool ${request.params.name} not found`);
      }
      return await tool.handler(request.params.arguments || {});
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return registerResources().list();
    });

    // Read a resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const resources = registerResources();
      const resource = resources.get(request.params.uri);
      if (!resource) {
        throw new Error(`Resource ${request.params.uri} not found`);
      }
      return await resource.handler();
    });

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return registerPrompts().list();
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      // Write to stderr to avoid interfering with JSON-RPC protocol on stdout
      process.stderr.write(`[MCP Error] ${error}\n`);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    // Ensure stdout is available for JSON-RPC protocol only
    // All logging must go to stderr
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    // Server is now running and listening for requests
  }
}

// Main entry point
async function main() {
  const server = new EnduranceMCPServer();
  await server.start();
}

// Run if called directly (check if this file is being executed directly)
const isMainModule = import.meta.url === `file://${fileURLToPath(process.argv[1] || '')}` ||
  (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(process.argv[1]));

if (isMainModule) {
  main().catch((error) => {
    // Write to stderr to avoid interfering with JSON-RPC protocol on stdout
    process.stderr.write(`Failed to start MCP server: ${error}\n`);
    process.exit(1);
  });
}

export { EnduranceMCPServer, main };
