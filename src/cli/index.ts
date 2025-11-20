#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { newProjectCommand } from './commands/new-project.js';
import { newModuleCommand } from './commands/new-module.js';
import { listEventsCommand } from './commands/list-events.js';
import { listEnvVarsCommand } from './commands/list-env-vars.js';
import { mcpServerCommand } from './commands/mcp-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

const program = new Command();

program
  .name('endurance')
  .description('Endurance CLI - Framework tools and utilities')
  .version(packageJson.version, '-v, --version', 'output the current version');

// Register commands
newProjectCommand(program);
newModuleCommand(program);
listEventsCommand(program);
listEnvVarsCommand(program);
mcpServerCommand(program);

// Parse command line arguments
program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
