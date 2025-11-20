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
        // Write to stderr to avoid interfering with JSON-RPC protocol on stdout
        process.stderr.write(`Failed to start MCP server: ${error}\n`);
        process.exit(1);
      }
    });
}
