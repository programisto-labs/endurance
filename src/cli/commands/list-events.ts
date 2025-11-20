import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';

export function listEventsCommand(program: Command): void {
  program
    .command('list-events')
    .description('List all available events across modules and node_modules')
    .option('-p, --path <path>', 'Base path to search', process.cwd())
    .action(async (options) => {
      try {
        const searchPath = path.resolve(options.path);
        const results: Array<{ event: string; file: string; module: string }> = [];

        const searchEventsInDirectory = async (dirPath: string, moduleName: string = ''): Promise<void> => {
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
                            await searchEventsInDirectory(
                              path.join(scopedPath, scopedEntry.name),
                              `@programisto/${scopedEntry.name}`
                            );
                          }
                        }
                      }
                    } else {
                      await searchEventsInDirectory(modulePath, subEntry.name);
                    }
                  }
                }
              }
              continue;
            }

            if (dirent.isDirectory()) {
              await searchEventsInDirectory(fullPath, moduleName || dirent.name);
            } else if (dirent.isFile() && (fullPath.endsWith('.js') || fullPath.endsWith('.ts'))) {
              try {
                const fileContent = await fs.readFile(fullPath, 'utf8');
                // Match emitter.emit() calls with eventTypes
                const eventMatches = fileContent.match(/emitter\.emit\((?:enduranceEventTypes\.)?([\w_]+)/g);
                if (eventMatches) {
                  eventMatches.forEach((event) => {
                    const eventName = event.replace(/emitter\.emit\((?:enduranceEventTypes\.)?/, '').replace(/\)/, '');
                    results.push({
                      event: eventName,
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

        await searchEventsInDirectory(searchPath);

        if (results.length === 0) {
          console.log('No events found.');
          return;
        }

        // Group by event name
        const eventMap = new Map<string, Array<{ file: string; module: string }>>();
        results.forEach((result) => {
          if (!eventMap.has(result.event)) {
            eventMap.set(result.event, []);
          }
          eventMap.get(result.event)!.push({ file: result.file, module: result.module });
        });

        console.log(`Found ${results.length} event occurrence(s) across ${eventMap.size} unique event(s):\n`);
        for (const [eventName, occurrences] of eventMap.entries()) {
          console.log(`Event: ${eventName}`);
          occurrences.forEach((occ) => {
            console.log(`  - ${occ.file} (${occ.module})`);
          });
          console.log('');
        }
      } catch (error) {
        console.error('Error listing events:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
