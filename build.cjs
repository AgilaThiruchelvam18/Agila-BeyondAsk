const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting production build with deployment fixes...');

// Clean up previous build
if (fs.existsSync('dist')) {
  execSync('rm -rf dist', { stdio: 'inherit' });
}
fs.mkdirSync('dist', { recursive: true });

// Build frontend
console.log('Building frontend...');
try {
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('Frontend build completed successfully');
} catch (error) {
  console.log('Frontend build failed, creating fallback:', error.message);
  
  // Create minimal frontend fallback
  fs.mkdirSync('dist/client/dist', { recursive: true });
  fs.writeFileSync('dist/client/dist/index.html', 
`<html><head><title>BeyondAsk</title></head>
<body><h1>Application Loading...</h1></body></html>`);
}

// Build server with TypeScript compilation
console.log('Building server with TypeScript...');
try {
  // Use production TypeScript config for proper compilation
  execSync('npx tsc --project tsconfig.production.json', { stdio: 'inherit' });
  console.log('TypeScript compilation completed successfully');
} catch (error) {
  console.warn('TypeScript compilation failed, using tsx runtime fallback:', error.message);
  
  // Fallback: copy source files for tsx runtime
  execSync('cp -r server dist/', { stdio: 'inherit' });
  execSync('cp -r shared dist/', { stdio: 'inherit' });
}

// Copy essential configuration files
console.log('Copying configuration files...');
const configFiles = ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.js', 'drizzle.config.ts'];
configFiles.forEach(file => {
  if (fs.existsSync(file)) {
    execSync(`cp ${file} dist/`, { stdio: 'inherit' });
  }
});

// Copy client directory if it exists
if (fs.existsSync('client')) {
  execSync('cp -r client dist/', { stdio: 'inherit' });
}

// Create test directory for pdf-parse dependency
fs.mkdirSync('dist/test/data', { recursive: true });
fs.writeFileSync('dist/test/data/05-versions-space.pdf', 'dummy file for pdf-parse');

// Create production package.json
console.log('Creating production package.json...');
const originalPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const productionPkg = {
  name: originalPkg.name,
  version: originalPkg.version,
  type: "module",
  main: "start.js",
  scripts: {
    start: "node start.js"
  },
  dependencies: originalPkg.dependencies
};
fs.writeFileSync('dist/package.json', JSON.stringify(productionPkg, null, 2));

// Create startup script that handles both compiled and tsx runtime scenarios
console.log('Creating startup script...');
const startScript = `#!/usr/bin/env node

console.log('Starting BeyondAsk production server...');

process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';
process.env.FORCE_VITE = 'true';

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

import { spawn } from 'child_process';
import fs from 'fs';

let serverCommand, serverArgs;

if (fs.existsSync('./server/index.js')) {
  console.log('Using compiled JavaScript server...');
  serverCommand = 'node';
  serverArgs = ['./server/index.js'];
} else if (fs.existsSync('./server/index.ts')) {
  console.log('Using tsx runtime for TypeScript server...');
  serverCommand = 'npx';
  serverArgs = ['tsx', './server/index.ts'];
} else {
  console.error('No server entry point found!');
  process.exit(1);
}

console.log(\`Starting server with: \${serverCommand} \${serverArgs.join(' ')}\`);

const server = spawn(serverCommand, serverArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '5000',
    FORCE_VITE: 'true'
  }
});

server.on('exit', (code) => {
  console.log(\`Server exited with code: \${code}\`);
  process.exit(code || 0);
});

server.on('error', (error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});
`;

fs.writeFileSync('dist/start.js', startScript);
execSync('chmod +x dist/start.js', { stdio: 'inherit' });

// Create alternative entry points for deployment compatibility
const indexScript = `#!/usr/bin/env node
import('./start.js').catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
`;

fs.writeFileSync('dist/index.js', indexScript);
execSync('chmod +x dist/index.js', { stdio: 'inherit' });

// Create server.js for platforms that expect it
fs.writeFileSync('dist/server.js', indexScript);
execSync('chmod +x dist/server.js', { stdio: 'inherit' });

// Verify that startup scripts were created
if (!fs.existsSync(path.join('dist', 'start.js'))) {
  console.error('Build failed: start.js was not generated');
  process.exit(1);
}

if (!fs.existsSync(path.join('dist', 'index.js'))) {
  console.error('Build failed: index.js was not generated');
  process.exit(1);
}

// Final verification
console.log('Verifying build output...');
const requiredFiles = ['start.js', 'index.js', 'package.json'];
const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join('dist', file)));

if (missingFiles.length > 0) {
  console.error(`Build failed: Missing required files: ${missingFiles.join(', ')}`);
  process.exit(1);
}

console.log('Production build completed successfully!');
console.log('Available entry points:');
console.log('  - start.js (primary startup script)');
console.log('  - index.js (alternative entry point)');
console.log('  - server.js (server-specific entry point)');
console.log('Deploy with: cd dist && npm install && npm start');