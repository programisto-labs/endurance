import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createRouterTool } from './create-router.js';
import { createSchemaTool } from './create-schema.js';
import { createModuleTool } from './create-module.js';
import { createListenerTool } from './create-listener.js';
import { createConsumerTool } from './create-consumer.js';
import { createCronTool } from './create-cron.js';
import { createAuthTool } from './create-auth.js';
import { listEventsTool } from './list-events.js';
import { listEnvVarsTool } from './list-env-vars.js';

interface ToolHandler {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{
      type: 'text';
      text: string;
    }>;
    isError?: boolean;
  }>;
}

interface ToolRegistry {
  list(): Promise<{ tools: Tool[] }>;
  get(name: string): ToolHandler | undefined;
}

const tools: Map<string, Tool & ToolHandler> = new Map();

function registerTool(tool: Tool & ToolHandler): void {
  tools.set(tool.name, tool);
}

export function registerTools(): ToolRegistry {
  // Register all tools
  if (tools.size === 0) {
    registerTool(createRouterTool());
    registerTool(createSchemaTool());
    registerTool(createModuleTool());
    registerTool(createListenerTool());
    registerTool(createConsumerTool());
    registerTool(createCronTool());
    registerTool(createAuthTool());
    registerTool(listEventsTool());
    registerTool(listEnvVarsTool());
  }

  return {
    async list() {
      const toolsList: Tool[] = Array.from(tools.values()).map(({ handler, ...tool }) => tool);
      return { tools: toolsList };
    },
    get(name: string) {
      const tool = tools.get(name);
      if (!tool) {
        return undefined;
      }
      return {
        handler: tool.handler
      };
    }
  };
}
