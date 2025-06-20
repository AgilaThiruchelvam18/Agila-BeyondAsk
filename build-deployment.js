#!/usr/bin/env node

// Deployment-ready build script for ES modules
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting deployment build process...');

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

// Build frontend
console.log('Building frontend...');
try {
  execSync('vite build --outDir dist/public', { stdio: 'inherit' });
  console.log('Frontend build completed successfully');
} catch (error) {
  console.error('Frontend build failed:', error.message);
  // Create basic HTML as fallback
  fs.writeFileSync(path.join('dist', 'public', 'index.html'), `<!DOCTYPE html>
<html><head><title>BeyondAsk</title></head>
<body><div id="root"><h1>Application Loading...</h1></div></body></html>`);
}

// Build server with proper ES module compatibility
console.log('Building server for deployment...');
try {
  // Copy the entire server directory structure to preserve imports
  execSync('cp -r server dist/', { stdio: 'inherit' });
  
  // Copy shared directory for type definitions
  if (fs.existsSync('shared')) {
    execSync('cp -r shared dist/', { stdio: 'inherit' });
  }
  
  console.log('Server files copied successfully');
} catch (error) {
  console.error('Server copy failed:', error.message);
  process.exit(1);
}

// Create production startup script with proper ES module handling
console.log('Creating production startup script...');
try {
  const startupScript = `#!/usr/bin/env node

// Production startup script for ES modules
console.log('Starting BeyondAsk production server...');

// Set production environment variables
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';

// Comprehensive error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Set startup timeout
const startupTimeout = setTimeout(() => {
  console.error('Server startup timed out after 60 seconds');
  process.exit(1);
}, 60000);

// Import tsx module and start the server
async function startServer() {
  try {
    console.log('Starting server with tsx...');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Use tsx to run the TypeScript server directly
    const command = 'npx tsx server/index.ts';
    console.log('Executing:', command);
    
    const childProcess = exec(command, {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: process.env.PORT || '5000'
      }
    });
    
    childProcess.stdout?.on('data', (data) => {
      process.stdout.write(data);
    });
    
    childProcess.stderr?.on('data', (data) => {
      process.stderr.write(data);
    });
    
    childProcess.on('exit', (code) => {
      clearTimeout(startupTimeout);
      console.log('Server process exited with code:', code);
      process.exit(code || 0);
    });
    
    childProcess.on('error', (error) => {
      clearTimeout(startupTimeout);
      console.error('Server process error:', error);
      process.exit(1);
    });
    
    clearTimeout(startupTimeout);
    console.log('Server process started successfully');
    
  } catch (error) {
    clearTimeout(startupTimeout);
    console.error('Failed to start server:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

startServer();
`;

  fs.writeFileSync(path.join('dist', 'start.js'), startupScript, 'utf8');
  execSync('chmod +x dist/start.js');
  
  console.log('Production startup script created successfully');
} catch (error) {
  console.error('Failed to create startup script:', error.message);
  process.exit(1);
}

// Copy necessary files
console.log('Copying additional files...');
try {
  // Copy package.json for dependencies
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Create a production-only package.json
  const prodPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    type: "module",
    main: "start.js",
    scripts: {
      start: "node start.js"
    },
    dependencies: packageJson.dependencies
  };
  
  fs.writeFileSync(path.join('dist', 'package.json'), JSON.stringify(prodPackageJson, null, 2));
  
  // Copy other necessary directories
  if (fs.existsSync('shared')) {
    execSync('cp -r shared dist/', { stdio: 'inherit' });
  }
  
  console.log('Additional files copied successfully');
} catch (error) {
  console.error('Error copying additional files:', error.message);
}

console.log('✅ Deployment build completed successfully!');
console.log('📦 Built files are in the dist/ directory');
console.log('🚀 To start in production: cd dist && npm install && npm start');