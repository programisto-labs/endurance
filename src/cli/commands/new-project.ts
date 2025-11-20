import { Command } from 'commander';
import fs from 'fs-extra';
import { downloadTemplate } from '../templates/download.js';

export function newProjectCommand(program: Command): void {
  program
    .command('new-project')
    .description('Create a new Endurance project')
    .option('-t, --template <template>', 'Template repository (default: endurance-template)', 'endurance-template')
    .option('-r, --repo <repo>', 'GitHub repository URL or owner/repo', 'programisto-labs/endurance-template')
    .option('--skip-install', 'Skip npm/yarn install after project creation', false)
    .action(async (options) => {
      try {
        const currentPath = process.cwd();

        // Check if directory is empty
        const files = await fs.readdir(currentPath);
        if (files.length > 0) {
          console.error('Error: Current directory is not empty. Please create the project in an empty directory.');
          process.exit(1);
        }

        console.log(`Creating new Endurance project from template: ${options.repo}...`);

        await downloadTemplate(options.repo, currentPath, options.template);

        console.log('Project created successfully!');

        if (!options.skipInstall) {
          console.log('\nInstalling dependencies...');
          // Note: User should run npm/yarn install manually or we could spawn a process here
          console.log('Please run: npm install (or yarn install)');
        }
      } catch (error) {
        console.error('Error creating project:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
