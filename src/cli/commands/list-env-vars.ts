import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';

export function listEnvVarsCommand(program: Command): void {
  program
    .command('list-env-vars')
    .description('List all environment variables used across modules and node_modules')
    .option('-p, --path <path>', 'Base path to search', process.cwd())
    .action(async (options) => {
      try {
        const searchPath = path.resolve(options.path);
        const results: Array<{ envVar: string; file: string; module: string }> = [];

        const searchEnvVarsInDirectory = async (dirPath: string, moduleName: string = ''): Promise<void> => {
          if (!(await fs.pathExists(dirPath))) {
            return;
          }

          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const dirent of entries) {
            const fullPath = path.join(dirPath, dirent.name);

            // Skip node_modules except endurance-core and edrm-* modules
            if (dirent.name === 'node_modules' && !moduleName) {
              const nodeModulesPath = fullPath;
              if (await fs.pathExists(nodeModulesPath)) {
                const subEntries = await fs.readdir(nodeModulesPath, { withFileTypes: true });
                for (const subEntry of subEntries) {
                  if (subEntry.name === '@programisto' || subEntry.name === 'endurance-core' || subEntry.name.startsWith('edrm-')) {
                    const modulePath = path.join(nodeModulesPath, subEntry.name);
                    if (subEntry.name === '@programisto') {
                      // Handle scoped packages
                      const scopedPath = modulePath;
                      if (await fs.pathExists(scopedPath)) {
                        const scopedEntries = await fs.readdir(scopedPath, { withFileTypes: true });
                        for (const scopedEntry of scopedEntries) {
                          if (scopedEntry.name.startsWith('edrm-')) {
                            await searchEnvVarsInDirectory(
                              path.join(scopedPath, scopedEntry.name),
                              `@programisto/${scopedEntry.name}`
                            );
                          }
                        }
                      }
                    } else {
                      await searchEnvVarsInDirectory(modulePath, subEntry.name);
                    }
                  }
                }
              }
              continue;
            }

            if (dirent.isDirectory()) {
              await searchEnvVarsInDirectory(fullPath, moduleName || dirent.name);
            } else if (dirent.isFile() && (fullPath.endsWith('.js') || fullPath.endsWith('.ts'))) {
              try {
                const fileContent = await fs.readFile(fullPath, 'utf8');
                // Match process.env.* references
                const envVarMatches = fileContent.match(/process\.env\.([\w_]+)/g);
                if (envVarMatches) {
                  envVarMatches.forEach((envVar) => {
                    const varName = envVar.replace('process.env.', '');
                    results.push({
                      envVar: varName,
                      file: path.relative(searchPath, fullPath),
                      module: moduleName || 'Unknown module'
                    });
                  });
                }
              } catch (err) {
                // Skip files that can't be read
              }
            }
          }
        };

        await searchEnvVarsInDirectory(searchPath);

        if (results.length === 0) {
          console.log('No environment variables found.');
          return;
        }

        // Group by variable name
        const envVarMap = new Map<string, Array<{ file: string; module: string }>>();
        results.forEach((result) => {
          if (!envVarMap.has(result.envVar)) {
            envVarMap.set(result.envVar, []);
          }
          envVarMap.get(result.envVar)!.push({ file: result.file, module: result.module });
        });

        console.log(`Found ${results.length} environment variable reference(s) across ${envVarMap.size} unique variable(s):\n`);
        for (const [varName, occurrences] of envVarMap.entries()) {
          console.log(`Environment Variable: ${varName}`);
          occurrences.forEach((occ) => {
            console.log(`  - ${occ.file} (${occ.module})`);
          });
          console.log('');
        }
      } catch (error) {
        console.error('Error listing environment variables:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
