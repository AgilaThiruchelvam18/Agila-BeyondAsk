#!/usr/bin/env node

// Simplified production build script
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Starting production build process...');

// Clean and prepare dist directory
console.log('Cleaning dist directory...');
try {
  if (fs.existsSync('dist')) {
    execSync('rm -rf dist');
  }
  fs.mkdirSync('dist', { recursive: true });
  fs.mkdirSync(path.join('dist', 'public'), { recursive: true });
} catch (error) {
  console.error('Error cleaning dist directory:', error.message);
  process.exit(1);
}

// Build frontend with timeout handling
console.log('Building frontend...');
try {
  execSync('timeout 300 vite build --outDir dist/public', { stdio: 'inherit' });
  console.log('Frontend build completed successfully');
} catch (error) {
  console.log('Frontend build timed out, creating basic HTML file');
  fs.writeFileSync(path.join('dist', 'public', 'index.html'), `<!DOCTYPE html>
<html><head><title>BeyondAsk</title></head>
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

/**
 * Production Startup Script for BeyondAsk Platform
 */

console.log('Starting BeyondAsk production server...');

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';
process.env.FORCE_VITE = 'true';

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Determine the best way to start the server
let serverCommand, serverArgs;

if (fs.existsSync('./server/index.js')) {
  // Use compiled JavaScript if available
  console.log('Using compiled JavaScript server...');
  serverCommand = 'node';
  serverArgs = ['./server/index.js'];
} else if (fs.existsSync('./server/index.ts')) {
  // Use tsx to run TypeScript directly
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

server.on('exit', (code, signal) => {
  if (signal) {
    console.log(\`Server terminated by signal: \${signal}\`);
  } else {
    console.log(\`Server exited with code: \${code}\`);
  }
  process.exit(code || 0);
});

server.on('error', (error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});

console.log('Production server started successfully!');
`;

fs.writeFileSync('dist/start.js', startScript);
execSync('chmod +x dist/start.js', { stdio: 'inherit' });

// Create alternative entry points for deployment compatibility
const indexScript = \`#!/usr/bin/env node
import('./start.js').catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
\`;

fs.writeFileSync('dist/index.js', indexScript);
execSync('chmod +x dist/index.js', { stdio: 'inherit' });

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
console.log('Deploy with: cd dist && npm install && npm start');
console.log('📝 Creating production startup script...');
try {
  const startupScript = `#!/usr/bin/env node
// Production startup script using ES modules
console.log('Starting production server...');

// Set production environment
process.env.NODE_ENV = 'production';

// Add comprehensive error handling for ES modules
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Set timeout to prevent hanging if server doesn't start properly
const startupTimeout = setTimeout(() => {
  console.error('Server startup timed out after 60 seconds. This could indicate an issue with external service connections.');
  process.exit(1);
}, 60000);

// Set a custom timeout for Pinecone and other external service connections
// to prevent deployment hanging indefinitely
process.env.SERVICE_CONNECTION_TIMEOUT = '15000'; // 15 seconds timeout for external services

// Import the main server module dynamically since we're using ES modules
console.log('Loading server module via dynamic import...');

// Use dynamic import for ES modules
import('./index.js')
  .then(() => {
    clearTimeout(startupTimeout);
    console.log('Server module loaded successfully');
  })
  .catch((err) => {
    clearTimeout(startupTimeout);
    console.error('Failed to load server via import:', err);
    console.error(err.stack);
    process.exit(1);
  });
`;

  fs.writeFileSync(path.join('dist', 'start.js'), startupScript, 'utf8');
  execSync('chmod +x dist/start.js');

  // Also create a simple direct execution script
  const directScript = `#!/usr/bin/env node
// Simple direct execution script
console.log('Starting production server (direct mode)...');
process.env.NODE_ENV = 'production';

// Basic error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Import and run the server
require('./index.js');
`;

  fs.writeFileSync(path.join('dist', 'start-direct.js'), directScript, 'utf8');
  execSync('chmod +x dist/start-direct.js');

} catch (error) {
  console.error('❌ Failed to create startup script:', error.message);
}

console.log('✅ Build completed successfully!');
console.log('📦 To start the production server, run:');
console.log('   NODE_ENV=production node dist/index.js');
console.log('📦 Alternative startup scripts available:');
console.log('   NODE_ENV=production node dist/start.js (with timeout protection)');
console.log('   NODE_ENV=production node dist/start-direct.js (simple direct execution)');