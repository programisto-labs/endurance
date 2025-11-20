import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const TEMPLATE_CACHE_DIR = path.join(os.homedir(), '.endurance', 'templates');

export async function downloadTemplate(
  repo: string,
  targetPath: string,
  templateName: string
): Promise<void> {
  try {
    // Ensure cache directory exists
    await fs.ensureDir(TEMPLATE_CACHE_DIR);

    const cachePath = path.join(TEMPLATE_CACHE_DIR, templateName);
    const isCacheValid = await fs.pathExists(cachePath);

    // Download or update template from GitHub
    if (!isCacheValid) {
      console.log(`Downloading template from GitHub: ${repo}...`);
      await cloneRepository(repo, cachePath);
    } else {
      console.log(`Using cached template from: ${cachePath}`);
      // Optionally update cache
      try {
        execSync('git pull', { cwd: cachePath, stdio: 'ignore' });
      } catch {
        // If git pull fails, use cached version
        console.log('Using cached template (update skipped)');
      }
    }

    // Copy template to target path
    await fs.copy(cachePath, targetPath, {
      filter: (src) => {
        const name = path.basename(src);
        // Exclude git, node_modules, and other unnecessary files
        return !name.startsWith('.git') &&
          name !== 'node_modules' &&
          name !== '.DS_Store' &&
          name !== 'dist' &&
          name !== 'build';
      }
    });

    // Remove .git directory if it exists
    const gitPath = path.join(targetPath, '.git');
    if (await fs.pathExists(gitPath)) {
      await fs.remove(gitPath);
    }
  } catch (error) {
    // Fallback: create basic structure inline if download fails
    console.warn('Failed to download template, creating basic structure...');
    await createBasicStructure(targetPath);
    throw error;
  }
}

async function cloneRepository(repo: string, targetPath: string): Promise<void> {
  // Ensure target directory exists
  await fs.ensureDir(path.dirname(targetPath));

  // Clone repository
  const repoUrl = repo.includes('://') || repo.includes('@')
    ? repo
    : `https://github.com/${repo}.git`;

  try {
    execSync(`git clone ${repoUrl} "${targetPath}"`, { stdio: 'inherit' });
  } catch (error) {
    throw new Error(`Failed to clone repository: ${repoUrl}. ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function createBasicStructure(targetPath: string): Promise<void> {
  await fs.ensureDir(targetPath);

  const basicFiles = {
    'package.json': JSON.stringify({
      name: 'endurance-project',
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'ts-node src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js'
      },
      dependencies: {
        '@programisto/endurance': 'latest'
      }
    }, null, 2),
    'src/index.ts': `import app from '@programisto/endurance/internal/app.js';

// Your application code here
`,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2021',
        module: 'ESNext',
        moduleResolution: 'node',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    }, null, 2),
    '.gitignore': `node_modules/
dist/
*.log
.env
.DS_Store
`,
    'README.md': `# Endurance Project

This project was created with Endurance framework.
`
  };

  for (const [file, content] of Object.entries(basicFiles)) {
    const filePath = path.join(targetPath, file);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf8');
  }

  // Create basic directories
  await fs.ensureDir(path.join(targetPath, 'src', 'routes'));
  await fs.ensureDir(path.join(targetPath, 'src', 'schemas'));
  await fs.ensureDir(path.join(targetPath, 'src', 'modules'));
}
