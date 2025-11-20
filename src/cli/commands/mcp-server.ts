import { Command } from 'commander';
import { main } from '../../mcp/server.js';

export function mcpServerCommand(program: Command): void {
  program
    .command('mcp-server')
    .description('Start the Endurance MCP server (for IDE integration)')
    .action(async () => {
      try {
        await main();
      } catch (error) {
        console.error('Failed to start MCP server:', error);
        process.exit(1);
      }
    });
}
