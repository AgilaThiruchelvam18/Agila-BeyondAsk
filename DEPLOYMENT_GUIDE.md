# BeyondAsk Platform Deployment Guide
## Separate Frontend & Backend Instance Deployment

This guide covers deploying the BeyondAsk platform with separate frontend (S3/CloudFront) and backend (ECS Fargate) instances for optimal scalability and performance.

## Architecture Overview

```
Frontend (React/Vite)     Backend (Node.js/Express)
┌─────────────────────┐   ┌─────────────────────────┐
│   S3 + CloudFront   │   │     ECS Fargate        │
│                     │   │                        │
│ • Static assets     │   │ • API endpoints        │
│ • React SPA         │   │ • Database connections │
│ • Global CDN        │   │ • AI services          │
│ • Auto-scaling      │   │ • Auto-scaling         │
└─────────────────────┘   └─────────────────────────┘
          │                         │
          └─────────────────────────┘
                     │
            Application Load Balancer
```

## Prerequisites

### Required Tools
- AWS CLI v2.x configured with appropriate permissions
- Docker Desktop or Docker Engine
- Node.js v20.x
- npm or yarn package manager

### AWS Permissions Required
Your AWS user/role needs the following services:
- CloudFormation (full access)
- S3 (full access)
- CloudFront (full access)
- ECS (full access)
- ECR (full access)
- Application Load Balancer (full access)
- IAM (create/update roles and policies)
- Secrets Manager (read/write)

### Environment Variables
Create these secrets in AWS Secrets Manager:

```bash
# Database
arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:beyondask/database-url

# AI Services
arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:beyondask/pinecone-key
arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:beyondask/pinecone-env
arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:beyondask/openai-key

# Email Service
arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:beyondask/sendgrid-key
```

## Deployment Methods

### Method 1: Automated Script (Recommended)

```bash
# Run the comprehensive deployment script
node deploy-separate-instances.js
```

This script handles:
- Infrastructure deployment via CloudFormation
- Frontend build and S3/CloudFront deployment
- Backend containerization and ECS deployment
- Health checks and validation

### Method 2: GitHub Actions CI/CD

1. Set up repository secrets in GitHub:
   ```
   AWS_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY
   CLOUDFRONT_DISTRIBUTION_ID
   ```

2. Push to main branch to trigger deployment:
   ```bash
   git push origin main
   ```

### Method 3: Manual Step-by-Step

#### Step 1: Deploy Infrastructure
```bash
aws cloudformation deploy \
  --template-file deployment/infrastructure.yml \
  --stack-name beyondask-infrastructure \
  --parameter-overrides Environment=production DomainName=beyondask.com \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

#### Step 2: Build and Deploy Backend
```bash
# Build production package
node production-final-complete.js

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build and push Docker image
docker build -f deployment/Dockerfile -t ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/beyondask-backend:latest .
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/beyondask-backend:latest

# Deploy to ECS
aws ecs create-service --cli-input-json file://deployment/ecs-service-definition.json
```

#### Step 3: Build and Deploy Frontend
```bash
# Set environment variables
export VITE_API_URL=https://api.beyondask.com
export VITE_APP_NAME="BeyondAsk AI"
export VITE_ENVIRONMENT=production

# Build frontend
cd client && npm run build

# Deploy to S3
aws s3 sync dist/ s3://beyondask-frontend-prod --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
```

## Configuration Files

### Frontend Configuration
- **Location**: `client/src/lib/queryClient.ts`
- **Purpose**: API endpoint configuration for production
- **Key Settings**:
  ```typescript
  const apiUrl = import.meta.env.VITE_API_URL || 'https://api.beyondask.com';
  ```

### Backend Configuration
- **Location**: `server/index.ts`
- **Purpose**: CORS and production settings
- **Key Settings**:
  ```typescript
  const corsOptions = {
    origin: ['https://beyondask.com', 'https://www.beyondask.com']
  };
  ```

### Docker Configuration
- **Location**: `deployment/Dockerfile`
- **Purpose**: Backend containerization
- **Features**: Multi-stage build, security hardening, health checks

## Monitoring and Troubleshooting

### Health Check Endpoints
- **Backend**: `https://api.beyondask.com/health`
- **Frontend**: Available through CloudFront URL

### Common Issues

#### CORS Errors
```bash
# Check CORS configuration in server/index.ts
# Verify frontend domain is in corsOptions.origin array
```

#### ECS Service Failed to Start
```bash
# Check ECS service logs
aws logs get-log-events --log-group-name /ecs/beyondask-backend --log-stream-name STREAM_NAME

# Check task definition
aws ecs describe-task-definition --task-definition beyondask-backend
```

#### CloudFront Cache Issues
```bash
# Invalidate cache
aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"

# Check distribution status
aws cloudfront get-distribution --id DISTRIBUTION_ID
```

### Performance Optimization

#### Frontend Optimizations
- Assets cached for 1 year (31536000 seconds)
- HTML files cached for immediate revalidation
- Gzip compression enabled
- HTTP/2 support

#### Backend Optimizations
- ECS Fargate auto-scaling based on CPU/memory
- Application Load Balancer with health checks
- Connection pooling for database
- Redis caching (optional)

## Security Considerations

### Frontend Security
- All secrets stored in AWS Secrets Manager
- CloudFront with HTTPS-only access
- Content Security Policy headers
- CORS properly configured

### Backend Security
- Non-root Docker container
- Security groups restrict access
- Environment variables from Secrets Manager
- Rate limiting enabled

## Scaling Configuration

### Frontend Scaling
- CloudFront automatically scales globally
- S3 provides unlimited storage
- No additional configuration needed

### Backend Scaling
```bash
# Update ECS service desired count
aws ecs update-service \
  --cluster production-beyondask-cluster \
  --service beyondask-api \
  --desired-count 4
```

### Database Scaling
- PostgreSQL with connection pooling
- Consider RDS Multi-AZ for high availability
- Read replicas for read-heavy workloads

## Cost Optimization

### Frontend Costs
- S3 storage: ~$0.023/GB
- CloudFront: ~$0.085/GB (first 10TB)
- Data transfer: Included in CloudFront

### Backend Costs
- ECS Fargate: ~$0.04048/vCPU/hour + $0.004445/GB/hour
- Application Load Balancer: ~$0.0225/hour
- ECR storage: ~$0.10/GB/month

## Backup and Disaster Recovery

### Database Backup
```bash
# Automated backups via RDS
# Point-in-time recovery available
# Cross-region backup replication recommended
```

### Application Backup
- Docker images stored in ECR with lifecycle policies
- Frontend assets replicated across CloudFront edge locations
- Infrastructure as Code in Git repository

## Support and Maintenance

### Regular Maintenance Tasks
1. Update Docker base images monthly
2. Review and rotate API keys quarterly
3. Monitor CloudWatch metrics and alarms
4. Update dependencies and security patches

### Emergency Procedures
1. Rollback ECS deployment: Update to previous task definition
2. Frontend rollback: Deploy previous S3 version
3. Database issues: Switch to read replica or restore from backup

## Useful Commands

```bash
# Get deployment status
aws cloudformation describe-stacks --stack-name beyondask-infrastructure

# View ECS service status
aws ecs describe-services --cluster production-beyondask-cluster --services beyondask-api

# Check frontend deployment
aws s3 ls s3://beyondask-frontend-prod

# View application logs
aws logs tail /ecs/beyondask-backend --follow

# Test endpoints
curl https://api.beyondask.com/health
curl https://beyondask.com
```

For additional support, refer to the project documentation or create an issue in the repository.