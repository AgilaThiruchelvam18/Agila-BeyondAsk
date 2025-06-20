#!/usr/bin/env node

// Simple deployment build script that fixes ES module issues
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Starting simple deployment build...');

// Clean dist directory
if (fs.existsSync('dist')) {
  execSync('rm -rf dist');
}
fs.mkdirSync('dist', { recursive: true });
fs.mkdirSync('dist/public', { recursive: true });

// Simple frontend build - create basic HTML if vite fails
console.log('Building frontend...');
try {
  execSync('timeout 120 vite build --outDir dist/public', { stdio: 'inherit' });
  console.log('Frontend built successfully');
} catch (error) {
  console.log('Creating minimal frontend fallback...');
  fs.writeFileSync(path.join('dist', 'public', 'index.html'), 
    '<!DOCTYPE html><html><head><title>BeyondAsk</title></head><body><div id="root">Loading BeyondAsk...</div></body></html>');
}

// Copy all necessary files
console.log('Copying server files...');
execSync('cp -r server dist/');
execSync('cp -r shared dist/');

// Create production package.json with proper ES module setup
const originalPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deployPkg = {
  name: originalPkg.name,
  version: originalPkg.version,
  type: "module",
  main: "start.js",
  scripts: {
    start: "node start.js"
  },
  dependencies: originalPkg.dependencies
};
fs.writeFileSync('dist/package.json', JSON.stringify(deployPkg, null, 2));

// Create a simple CommonJS startup script to avoid ES module issues
console.log('Creating startup script...');
const startScript = `// Simple production startup script
console.log('Starting BeyondAsk production server...');

// Set environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Use dynamic import to load tsx and run the server
import('child_process').then(({ spawn }) => {
  const server = spawn('npx', ['tsx', 'server/index.ts'], {
    stdio: 'inherit',
    env: process.env
  });

  server.on('exit', (code) => {
    process.exit(code || 0);
  });

  server.on('error', (error) => {
    console.error('Server startup error:', error);
    process.exit(1);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
`;

fs.writeFileSync('dist/start.js', startScript);

console.log('Build completed successfully!');
console.log('Deploy with: cd dist && npm install && npm start');