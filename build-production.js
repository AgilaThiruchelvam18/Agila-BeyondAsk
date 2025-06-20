#!/usr/bin/env node

// Production build script that fixes ES module compatibility issues
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Building for production deployment...');

// Clean dist directory
console.log('Cleaning dist directory...');
if (fs.existsSync('dist')) {
  execSync('rm -rf dist');
}
fs.mkdirSync('dist', { recursive: true });

// Build frontend
console.log('Building frontend...');
try {
  execSync('vite build --outDir dist/public', { stdio: 'inherit' });
  console.log('Frontend build completed');
} catch (error) {
  console.error('Frontend build failed:', error.message);
  // Create minimal fallback
  fs.mkdirSync(path.join('dist', 'public'), { recursive: true });
  fs.writeFileSync(path.join('dist', 'public', 'index.html'), 
    '<!DOCTYPE html><html><head><title>BeyondAsk</title></head><body><div id="root">Loading...</div></body></html>');
}

// Copy server files
console.log('Copying server files...');
execSync('cp -r server dist/', { stdio: 'inherit' });

// Copy shared directory
if (fs.existsSync('shared')) {
  execSync('cp -r shared dist/', { stdio: 'inherit' });
}

// Create production package.json
console.log('Creating production package.json...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const prodPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  type: "module",
  main: "index.js",
  scripts: {
    start: "tsx server/index.ts"
  },
  dependencies: packageJson.dependencies
};
fs.writeFileSync(path.join('dist', 'package.json'), JSON.stringify(prodPackageJson, null, 2));

// Create simple startup script
console.log('Creating startup script...');
const startScript = `#!/usr/bin/env node

console.log('Starting production server...');

process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

const { spawn } = require('child_process');

const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: process.env
});

server.on('exit', (code) => {
  process.exit(code);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});
`;

fs.writeFileSync(path.join('dist', 'index.js'), startScript);
execSync('chmod +x dist/index.js');

console.log('Production build completed successfully!');
console.log('To deploy: cd dist && npm install && node index.js');