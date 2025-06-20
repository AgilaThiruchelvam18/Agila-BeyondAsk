# BeyondAsk Deployment Checklist

## Pre-Deployment Setup

### AWS Configuration
- [ ] AWS CLI installed and configured
- [ ] AWS credentials have required permissions
- [ ] Target AWS region selected (default: us-east-1)
- [ ] Domain name configured (beyondask.com)

### Secrets Management
- [ ] DATABASE_URL stored in AWS Secrets Manager
- [ ] PINECONE_API_KEY stored in AWS Secrets Manager
- [ ] PINECONE_ENVIRONMENT stored in AWS Secrets Manager
- [ ] OPENAI_API_KEY stored in AWS Secrets Manager
- [ ] SENDGRID_API_KEY stored in AWS Secrets Manager

### Local Environment
- [ ] Node.js v20.x installed
- [ ] Docker installed and running
- [ ] All dependencies installed (`npm ci`)
- [ ] Production build tested locally

## Infrastructure Deployment

### CloudFormation Stack
- [ ] Deploy infrastructure stack: `aws cloudformation deploy --template-file deployment/infrastructure.yml --stack-name beyondask-infrastructure --capabilities CAPABILITY_IAM`
- [ ] Verify stack creation successful
- [ ] Note outputs: ALB URL, CloudFront URL, ECR URI
- [ ] Security groups configured correctly
- [ ] Target groups healthy

### Network Configuration
- [ ] VPC created with public/private subnets
- [ ] Internet Gateway attached
- [ ] Route tables configured
- [ ] NAT Gateways for private subnets (if needed)

## Backend Deployment

### ECR Repository
- [ ] ECR repository created: `beyondask-backend`
- [ ] Docker login successful
- [ ] Production package built: `node production-final-complete.js`
- [ ] Docker image built and tested locally

### ECS Configuration
- [ ] ECS cluster created: `production-beyondask-cluster`
- [ ] Task definition registered with correct image URI
- [ ] Task execution role has Secrets Manager permissions
- [ ] Service created with desired count: 2
- [ ] Load balancer target group attached
- [ ] Health checks passing

### Container Verification
- [ ] Container starts successfully
- [ ] Health endpoint responds: `/health`
- [ ] Environment variables loaded from Secrets Manager
- [ ] Database connection established
- [ ] AI services (Pinecone, OpenAI) connected
- [ ] Email service initialized

## Frontend Deployment

### Build Configuration
- [ ] Environment variables set:
  - `VITE_API_URL=https://api.beyondask.com`
  - `VITE_APP_NAME=BeyondAsk AI`
  - `VITE_ENVIRONMENT=production`
- [ ] Frontend build successful: `cd client && npm run build`
- [ ] Bundle size optimized
- [ ] Source maps disabled for production

### S3 Configuration
- [ ] S3 bucket created with proper naming
- [ ] Bucket policy allows CloudFront access only
- [ ] Static assets uploaded with cache headers
- [ ] HTML files uploaded with no-cache headers
- [ ] Public access blocked correctly

### CloudFront Configuration
- [ ] Distribution created and deployed
- [ ] Origin Access Identity configured
- [ ] Custom domain (beyondask.com) configured
- [ ] SSL certificate installed
- [ ] Error pages configured for SPA routing
- [ ] Cache behaviors optimized

## Post-Deployment Verification

### Health Checks
- [ ] Backend health endpoint: `curl https://api.beyondask.com/health`
- [ ] Frontend loads: `curl https://beyondask.com`
- [ ] CORS working between frontend and backend
- [ ] Authentication flow working
- [ ] API endpoints responding correctly

### Functional Testing
- [ ] User registration/login
- [ ] Agent creation and configuration
- [ ] Knowledge base upload and processing
- [ ] Chat conversations working
- [ ] Email notifications sending
- [ ] File uploads to S3 working

### Performance Testing
- [ ] Page load times acceptable (<3s)
- [ ] API response times acceptable (<500ms)
- [ ] CloudFront cache hit ratio >80%
- [ ] ECS CPU/Memory usage normal
- [ ] Database connection pool stable

## Monitoring Setup

### CloudWatch Configuration
- [ ] Log groups created for ECS tasks
- [ ] Metrics and alarms configured
- [ ] Dashboard created for key metrics
- [ ] SNS notifications for critical alerts

### Application Monitoring
- [ ] Error tracking configured
- [ ] Performance monitoring enabled
- [ ] Uptime monitoring setup
- [ ] Database performance monitoring

## Security Review

### Access Control
- [ ] IAM roles follow least privilege principle
- [ ] Security groups restrict unnecessary access
- [ ] Secrets Manager policies configured
- [ ] S3 bucket policies secure

### SSL/TLS Configuration
- [ ] HTTPS enforced on CloudFront
- [ ] SSL certificate valid and auto-renewing
- [ ] HSTS headers configured
- [ ] Security headers implemented

### Data Protection
- [ ] Database encryption at rest
- [ ] Application data encrypted in transit
- [ ] API keys rotated and secure
- [ ] Backup encryption enabled

## Scaling Configuration

### Auto Scaling
- [ ] ECS service auto-scaling configured
- [ ] CloudWatch scaling policies created
- [ ] Target tracking scaling enabled
- [ ] Min/max capacity limits set

### Database Scaling
- [ ] Connection pooling configured
- [ ] Read replicas setup (if needed)
- [ ] Multi-AZ deployment enabled
- [ ] Backup retention configured

## Disaster Recovery

### Backup Strategy
- [ ] Database automated backups enabled
- [ ] Cross-region backup replication
- [ ] Application code versioned in Git
- [ ] Infrastructure as Code stored

### Recovery Procedures
- [ ] Rollback procedures documented
- [ ] Recovery time objectives defined
- [ ] Recovery point objectives defined
- [ ] Disaster recovery plan tested

## Final Validation

### Load Testing
- [ ] Application handles expected traffic
- [ ] Database performance under load
- [ ] CDN edge cache performance
- [ ] Auto-scaling triggers tested

### Documentation
- [ ] Deployment procedures documented
- [ ] Runbook created for operations
- [ ] Troubleshooting guide updated
- [ ] Team training completed

### Go-Live Checklist
- [ ] DNS cutover completed
- [ ] Monitoring alerts active
- [ ] Support team notified
- [ ] Rollback plan ready
- [ ] Success metrics defined

## Post-Deployment Tasks

### Day 1
- [ ] Monitor application metrics
- [ ] Check error rates and logs
- [ ] Verify user feedback
- [ ] Address any immediate issues

### Week 1
- [ ] Review performance metrics
- [ ] Optimize caching strategies
- [ ] Update documentation
- [ ] Team retrospective

### Month 1
- [ ] Cost optimization review
- [ ] Security audit
- [ ] Performance optimization
- [ ] Capacity planning review

---

**Deployment Lead:** _____________________ **Date:** _____________________

**Sign-off:**
- [ ] Technical Lead
- [ ] DevOps Engineer  
- [ ] Security Officer
- [ ] Product Owner