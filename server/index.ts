console.log("Index file is running...");

import express, { Request, Response, NextFunction } from "express";
import registerRoutes from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { connectToDB as connectToPgDB } from "./postgresql";  
import { initPineconeApi } from "./services/pinecone-api";
import { startLLMService, stopLLMService } from "./services/llm";
import emailService from "./services/email_service";
import { initSendGridService } from "./services/sendgrid_service";
import { setupSwagger } from "./swagger";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import http from "http";

import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

// Enhanced logging function for error diagnosis
function logStep(step: string, error?: any) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [startup] ${step}`);
  if (error) {
    console.error(`${timestamp} [startup] ERROR in ${step}:`, error);
  }
}

// Set up __dirname and __filename in a way that works in both ESM and CommonJS
const _filename = typeof import.meta !== 'undefined' ? fileURLToPath(import.meta.url) : '';
const _dirname = _filename ? path.dirname(_filename) : '';

const __dirname = typeof global.__dirname !== 'undefined' ? global.__dirname : _dirname;
const __filename = typeof global.__filename !== 'undefined' ? global.__filename : _filename;

console.log('Working directory:', process.cwd());
console.log('__dirname:', __dirname);

const app = express();

// Configure CORS for deployment
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://beyondask.com',
        'https://www.beyondask.com',
        /\.cloudfront\.net$/,
        /\.replit\.app$/,
        /\.replit\.dev$/,
        'http://localhost:3000',
        'http://localhost:5000',
        'http://localhost:5173'
      ] 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Set Content Security Policy for Vite development
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* blob:; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' ws://localhost:* http://localhost:* https:; " +
      "worker-src 'self' blob:;"
    );
  }
  next();
});

// Serve static files from the public directory with error handling
app.use('/public', express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, path) => {
    // Add cache headers for static assets
    if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log("Current Environment:", {
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_REPLIT: Boolean(process.env.REPL_ID || process.env.REPL_SLUG),
    PORT: process.env.PORT || 5000
  });

  try {
    logStep("Starting server initialization");

    // Health check endpoints
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        message: 'Server is running', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime()
      });
    });

    app.get('/_ah/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    app.get('/.well-known/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    app.get('/api/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        message: 'Server is running', 
        timestamp: new Date().toISOString()
      });
    });

    // Determine port - simplified logic
    let port: number = 5000;

    if (process.env.PORT) {
      const envPort = parseInt(process.env.PORT, 10);
      if (!isNaN(envPort) && envPort > 0 && envPort <= 65535) {
        port = envPort;
      }
    }

    logStep(`Using port: ${port} in environment: ${process.env.NODE_ENV || 'development'}`);

    // Create HTTP server - simplified approach
    const server = http.createServer(app);

    // Graceful startup
    server.listen(port, "0.0.0.0", () => {
      log(`Server listening on 0.0.0.0:${port} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
      logStep(`Server successfully started and listening on port ${port}`);
    });

    // Handle server errors gracefully
    server.on('error', (err: NodeJS.ErrnoException) => {
      console.error('Server error:', err);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please check for running processes.`);
        process.exit(1);
      } else {
        console.error('Unexpected server error:', err);
        process.exit(1);
      }
    });

    // Initialize services after server is listening
    try {
      // Initialize PostgreSQL
      logStep("Connecting to PostgreSQL database");
      const pgConnected = await connectToPgDB();
      if (!pgConnected) {
        log('Warning: PostgreSQL connection failed - using fallback storage');
        logStep("WARNING: PostgreSQL connection failed, using in-memory storage as fallback");
      } else {
        log('Successfully connected to PostgreSQL database');
        logStep("PostgreSQL connected successfully");
      }

      // Initialize Pinecone API with timeout
      logStep("Initializing Pinecone API");
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Pinecone API connection timeout')), 20000);
        });

        await Promise.race([initPineconeApi(), timeoutPromise]);
        log('Successfully connected to Pinecone API');
        logStep("Pinecone API initialized successfully");
      } catch (error) {
        console.error('Pinecone API initialization failed:', error);
        log('Warning: Pinecone service unavailable - vector search features will be limited');
        logStep("WARNING: Pinecone API initialization failed", error);
      }

      // Start LLM service with timeout
      logStep("Starting LLM service");
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('LLM service connection timeout')), 20000);
        });

        await Promise.race([startLLMService(), timeoutPromise]);
        log('LLM service started successfully');
        logStep("LLM service started successfully");
      } catch (error) {
        console.error('LLM service startup failed:', error);
        log('Warning: LLM service unavailable - AI features will be limited');
        logStep("WARNING: LLM service failed to start", error);
      }

      // Initialize email service
      logStep("Initializing email service");
      try {
        if (process.env.SENDGRID_API_KEY) {
          const sendGridInitialized = await initSendGridService();
          if (sendGridInitialized) {
            log('SendGrid email service initialized successfully');
            logStep("SendGrid email service initialized successfully");
          } else {
            log('Email service configured but not initialized');
            logStep("Email service available for use");
          }
        } else {
          log('Email service configured and ready');
          logStep("Email service available for use");
        }
      } catch (error) {
        console.error('Email service initialization failed:', error);
        log('Warning: Email service unavailable - notification features will be limited');
        logStep("WARNING: Email service initialization failed", error);
      }

      // Setup Swagger
      logStep("Setting up Swagger documentation");
      setupSwagger(app);

      // Register API routes FIRST - before any frontend middleware
      logStep("Registering application routes");
      
      // Determine environment settings
      const useModularRoutes = process.env.USE_MODULAR_ROUTES !== 'false';
      
      if (useModularRoutes) {
        try {
          const modularRoutesModule = await import('./routes/index');
          const modularRoutes = modularRoutesModule.default || modularRoutesModule;
          app.use('/api', modularRoutes);
          
          if (process.env.NODE_ENV === 'production') {
            console.log('🚀 PRODUCTION: Modular routes active at /api/* (legacy routes excluded)');
          } else {
            console.log('🔄 DEVELOPMENT: Modular routes active at /api/* (legacy routes disabled for testing)');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Failed to load modular routes:', errorMessage);
          throw new Error('Modular routes required - legacy system removed');
        }
      } else {
        console.log('⚠️  LEGACY MODE: Falling back to modular routes (legacy system removed)');
        const modularRoutesModule = await import('./routes/index');
        const modularRoutes = modularRoutesModule.default || modularRoutesModule;
        app.use('/api', modularRoutes);
      }

      // Add health check endpoint before frontend middleware
      app.get('/health', (req, res) => {
        res.json({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          port: port 
        });
      });

      // Add API route debugging middleware
      app.use('/api', (req, res, next) => {
        console.log(`API Request: ${req.method} ${req.originalUrl}`);
        next();
      });

      // Ensure API routes are handled before Vite middleware
      // This prevents API routes from being intercepted by the frontend router

      // Setup Vite or static serving AFTER API routes
      const forceVite = process.env.FORCE_VITE === 'true';
      const isProduction = process.env.NODE_ENV === 'production';
      const isReplit = Boolean(process.env.REPL_ID || process.env.REPL_SLUG);

      // Force static serving in production on Replit unless explicitly overridden
      if (isProduction && !forceVite) {
        logStep("Production environment detected - setting up static file serving");
        try {
          // First, verify build files exist
          const fs = await import('fs');
          const path = await import('path');
          const buildPath = path.join(__dirname, '../dist/public/index.html');
          
          if (!fs.existsSync(buildPath)) {
            logStep("WARNING: Build files not found at expected location, running build...");
            const { execSync } = await import('child_process');
            try {
              execSync('npm run build', { stdio: 'inherit' });
              logStep("Build completed successfully");
            } catch (buildError) {
              logStep("ERROR: Build failed", buildError);
              throw new Error('Build failed');
            }
          }
          
          serveStatic(app);
          logStep("Static file serving setup complete");
        } catch (error) {
          console.error("Error setting up static file serving:", error);
          logStep("ERROR: Failed to set up static file serving", error);
          logStep("FATAL: Could not set up static file serving in production", error);
          process.exit(1);
        }
      } else {
        logStep(`Setting up Vite middleware (NODE_ENV=${process.env.NODE_ENV}, forceVite=${forceVite}, isProduction=${isProduction})`);
        try {
          await setupVite(app, server);
          logStep("Vite middleware setup complete");
          
        } catch (viteError) {
          console.error("Error setting up Vite middleware:", viteError);
          logStep("ERROR: Vite setup failed, falling back to basic static serving", viteError);
          
          // Fallback: serve client directory directly
          const clientPath = path.join(process.cwd(), 'client');
          app.use(express.static(clientPath));
          
          app.get('*', (req, res, next) => {
            // Only serve HTML for non-API routes
            if (!req.originalUrl.startsWith('/api/')) {
              const indexPath = path.join(clientPath, 'index.html');
              if (require('fs').existsSync(indexPath)) {
                res.sendFile(indexPath);
              } else {
                res.status(404).send('Frontend not found - please build the client first');
              }
            } else {
              next();
            }
          });
          logStep("Fallback static serving configured");
        }
      }
      
      // Remove conflicting SPA fallback - let Vite handle all routing
      
      logStep("Routes registered successfully");

      // Setup enhanced static file serving with security headers
      logStep("Setting up enhanced static file serving");

      try {
        const { setupStaticFileMiddleware } = await import('./middleware/static-files');
        setupStaticFileMiddleware(app);
        
        // Skip enhanced Vite configuration to resolve frontend routing issues
        // const { viteConfigManager } = await import('./config/vite-config');
        // viteConfigManager.applyEnhancements(app);
        
        log("Enhanced static file middleware configured successfully", "express");
      } catch (error) {
        console.error("Error setting up enhanced static file middleware:", error);
        logStep("WARNING: Falling back to basic static file serving", error);
      }

      // Skip API fallback handler for modular routes to work properly

      // Error handling middleware
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";

        console.error("Server error:", err);
        res.status(status).json({ message });
      });

      logStep("Server initialization completed successfully");

    } catch (serviceError) {
      console.error("Error during service initialization:", serviceError);
      logStep("ERROR: Service initialization failed", serviceError);
      // Don't exit - continue with limited functionality
    }

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`${signal} signal received: initiating graceful shutdown`);

      try {
        // Cleanup enhanced Vite resources
        const { cleanupViteEnhancements } = await import('./config/vite-config');
        cleanupViteEnhancements();
      } catch (err) {
        console.error('Error cleaning up Vite enhancements:', err);
      }

      try {
        await stopLLMService();
      } catch (err) {
        console.error('Error stopping LLM service:', err);
      }

      server.close(() => {
        console.log('Server closed gracefully');
        process.exit(0);
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions gracefully
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();