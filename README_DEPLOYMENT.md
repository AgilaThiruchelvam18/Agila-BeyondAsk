# BeyondAsk Platform - Separate Instance Deployment

## Quick Start

Deploy the BeyondAsk platform with separate frontend and backend instances for optimal performance and scalability.

### Prerequisites
- AWS CLI configured with appropriate permissions
- Docker installed and running
- Node.js v20.x

### One-Command Deployment
```bash
node deploy-separate-instances.js
```

### Manual Deployment Steps
```bash
# 1. Deploy infrastructure
aws cloudformation deploy --template-file deployment/infrastructure.yml --stack-name beyondask-infrastructure --capabilities CAPABILITY_IAM

# 2. Build and deploy backend
node production-final-complete.js
docker build -f deployment/Dockerfile -t beyondask-backend .
# (ECR push commands follow)

# 3. Build and deploy frontend
cd client && npm run build
aws s3 sync dist/ s3://beyondask-frontend-prod --delete
```

### Validate Deployment
```bash
node validate-deployment.js
```

## Architecture

**Frontend**: React SPA deployed to S3 + CloudFront
- Global CDN distribution
- Automatic HTTPS and compression
- Optimized caching strategies

**Backend**: Node.js API deployed to ECS Fargate
- Auto-scaling containers
- Application Load Balancer
- Health monitoring and logging

**Database**: PostgreSQL with connection pooling
**AI Services**: Pinecone vector database + OpenAI
**Email**: SendGrid integration

## Key Features

- **Independent Scaling**: Frontend and backend scale separately
- **High Availability**: Multi-AZ deployment with auto-recovery
- **Security**: All secrets in AWS Secrets Manager
- **Performance**: CDN caching + container auto-scaling
- **Monitoring**: CloudWatch metrics and alerting

## Environment Configuration

The deployment automatically configures:
- CORS for cross-origin requests
- Environment-specific API endpoints
- SSL certificates and security headers
- Database connection pooling
- Auto-scaling policies

## Support

See `DEPLOYMENT_GUIDE.md` for detailed instructions and `DEPLOYMENT_CHECKLIST.md` for validation steps.