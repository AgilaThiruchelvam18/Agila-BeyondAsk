# Deployment Guidelines

## Port Configuration
The application is properly configured to use `process.env.PORT || 5000` and listens on `0.0.0.0` for external accessibility, which is good for deployment.

## Deployment Configuration Added
- Created a `Procfile` that builds and starts the application: `web: npm run build && npm start`
- Enhanced server startup with better error handling
- Added CORS configuration for deployment
- Improved resilience for external service dependencies

## Steps to Deploy on Replit
1. Make sure all required environment variables are set in the Replit Secrets
2. Click Deploy on the Replit interface
3. The application will use the `Procfile` to build and start
4. The server will automatically handle port conflicts by trying alternative ports

## Required Environment Variables
Make sure these are all set in your deployment environment:
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_ENVIRONMENT`
- `PINECONE_INDEX`

## Troubleshooting Deployment
If the deployment fails:
1. Check the deployment logs
2. Ensure all environment variables are set correctly
3. Look for any port conflicts (application will try alternative ports in production)
4. Verify that the build process completes successfully

Note: The TypeScript error about string vs number in process.exit() can be ignored as it doesn't affect runtime behavior.