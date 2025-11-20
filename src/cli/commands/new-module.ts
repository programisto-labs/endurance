import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { downloadTemplate } from '../templates/download.js';

export function newModuleCommand(program: Command): void {
  program
    .command('new-module <moduleName>')
    .description('Create a new Endurance module')
    .option('-p, --path <path>', 'Path where the module should be created', 'src/modules')
    .option('-t, --template <template>', 'Template name (default: endurance-template-module)', 'endurance-template-module')
    .option('-r, --repo <repo>', 'GitHub repository URL or owner/repo', 'programisto-labs/endurance-template-module')
    .action(async (moduleName: string, options) => {
      try {
        if (!moduleName) {
          console.error('Error: Module name is required');
          process.exit(1);
        }

        const modulePath = path.resolve(process.cwd(), options.path, moduleName);

        // Check if module already exists
        if (await fs.pathExists(modulePath)) {
          console.error(`Error: Module "${moduleName}" already exists at ${modulePath}`);
          process.exit(1);
        }

        console.log(`Creating module "${moduleName}" from template: ${options.repo}...`);

        // Create temporary directory for template
        const tempDir = path.join(process.cwd(), '.temp-template');
        await downloadTemplate(options.repo, tempDir, options.template);

        // Process template: replace {module-name} with actual module name
        await processModuleTemplate(tempDir, modulePath, moduleName);

        // Cleanup temp directory
        await fs.remove(tempDir);

        console.log(`Module "${moduleName}" created successfully in ${modulePath}`);
      } catch (error) {
        console.error('Error creating module:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

async function processModuleTemplate(srcDir: string, destDir: string, moduleName: string): Promise<void> {
  await fs.ensureDir(destDir);

  const processFile = async (srcPath: string, destPath: string): Promise<void> => {
    const stat = await fs.stat(srcPath);

    if (stat.isDirectory()) {
      await fs.ensureDir(destPath);
      const entries = await fs.readdir(srcPath);
      for (const entry of entries) {
        await processFile(
          path.join(srcPath, entry),
          path.join(destPath, entry.replace(/{module-name}/g, moduleName))
        );
      }
    } else if (stat.isFile()) {
      let content = await fs.readFile(srcPath, 'utf8');
      content = content.replace(/{module-name}/g, moduleName);
      // Also replace PascalCase, camelCase, etc.
      const PascalCase = moduleName
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      const camelCase = moduleName
        .split(/[-_]/)
        .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
        .join('');

      content = content.replace(/{ModuleName}/g, PascalCase);
      content = content.replace(/{moduleName}/g, camelCase);

      await fs.writeFile(destPath, content, 'utf8');
    }
  };

  const entries = await fs.readdir(srcDir);
  for (const entry of entries) {
    if (entry !== 'node_modules' && entry !== '.git') {
      await processFile(
        path.join(srcDir, entry),
        path.join(destDir, entry.replace(/{module-name}/g, moduleName))
      );
    }
  }
}
