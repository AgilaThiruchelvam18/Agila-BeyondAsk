#!/usr/bin/env node

/**
 * Comprehensive Deployment Script for BeyondAsk Platform
 * Deploys frontend to S3/CloudFront and backend to ECS Fargate
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  aws: {
    region: 'us-east-1',
    profile: 'default'
  },
  frontend: {
    buildDir: 'client/dist',
    s3Bucket: 'beyondask-frontend-prod',
    cloudfrontDistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID
  },
  backend: {
    ecrRepository: 'beyondask-backend',
    ecsCluster: 'production-beyondask-cluster',
    ecsService: 'beyondask-api',
    taskDefinition: 'beyondask-backend'
  }
};

function logStep(step, details = '') {
  console.log(`\n🚀 ${step}`);
  if (details) console.log(`   ${details}`);
}

function execCommand(command, description) {
  logStep(description);
  try {
    const result = execSync(command, { 
      stdio: 'inherit', 
      encoding: 'utf8',
      cwd: process.cwd()
    });
    return result;
  } catch (error) {
    console.error(`❌ Failed: ${description}`);
    console.error(error.message);
    process.exit(1);
  }
}

async function checkPrerequisites() {
  logStep('Checking prerequisites');
  
  // Check AWS CLI
  try {
    execSync('aws --version', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('AWS CLI not found. Please install AWS CLI first.');
  }
  
  // Check Docker
  try {
    execSync('docker --version', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('Docker not found. Please install Docker first.');
  }
  
  // Check Node.js version
  const nodeVersion = process.version;
  if (!nodeVersion.startsWith('v20')) {
    console.warn(`⚠️  Warning: Node.js ${nodeVersion} detected. Recommended version is v20.x`);
  }
  
  console.log('✅ Prerequisites check passed');
}

function buildProductionPackage() {
  logStep('Building production package for backend');
  
  if (!fs.existsSync('production-final-complete.js')) {
    throw new Error('Production build script not found: production-final-complete.js');
  }
  
  execCommand('node production-final-complete.js', 'Creating production-ready backend package');
  
  if (!fs.existsSync('dist/start.mjs')) {
    throw new Error('Production build failed: dist/start.mjs not found');
  }
  
  console.log('✅ Backend production package created');
}

function buildFrontend() {
  logStep('Building frontend for production');
  
  // Set environment variables for production build
  process.env.VITE_API_URL = 'https://api.beyondask.com';
  process.env.VITE_APP_NAME = 'BeyondAsk AI';
  process.env.VITE_ENVIRONMENT = 'production';
  
  execCommand('npm ci', 'Installing dependencies');
  execCommand('cd client && npm run build', 'Building frontend bundle');
  
  if (!fs.existsSync('client/dist/index.html')) {
    throw new Error('Frontend build failed: client/dist/index.html not found');
  }
  
  console.log('✅ Frontend build completed');
}

function deployInfrastructure() {
  logStep('Deploying AWS infrastructure');
  
  const stackName = 'beyondask-infrastructure';
  const templateFile = 'deployment/infrastructure.yml';
  
  if (!fs.existsSync(templateFile)) {
    throw new Error(`CloudFormation template not found: ${templateFile}`);
  }
  
  execCommand(
    `aws cloudformation deploy \\
      --template-file ${templateFile} \\
      --stack-name ${stackName} \\
      --parameter-overrides Environment=production DomainName=beyondask.com \\
      --capabilities CAPABILITY_IAM \\
      --region ${config.aws.region} \\
      --no-fail-on-empty-changeset`,
    'Deploying CloudFormation stack'
  );
  
  console.log('✅ Infrastructure deployment completed');
}

function deployBackend() {
  logStep('Deploying backend to ECS Fargate');
  
  // Login to ECR
  execCommand(
    `aws ecr get-login-password --region ${config.aws.region} | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.${config.aws.region}.amazonaws.com`,
    'Logging into Amazon ECR'
  );
  
  // Get ECR repository URI
  const accountId = execSync('aws sts get-caller-identity --query Account --output text', { encoding: 'utf8' }).trim();
  const imageUri = `${accountId}.dkr.ecr.${config.aws.region}.amazonaws.com/${config.backend.ecrRepository}`;
  const imageTag = Date.now().toString();
  
  // Build and push Docker image
  execCommand(
    `docker build -f deployment/Dockerfile -t ${imageUri}:${imageTag} .`,
    'Building Docker image'
  );
  
  execCommand(
    `docker tag ${imageUri}:${imageTag} ${imageUri}:latest`,
    'Tagging Docker image'
  );
  
  execCommand(
    `docker push ${imageUri}:${imageTag}`,
    'Pushing Docker image to ECR'
  );
  
  execCommand(
    `docker push ${imageUri}:latest`,
    'Pushing latest tag to ECR'
  );
  
  // Update ECS task definition
  const taskDefPath = 'deployment/ecs-task-definition.json';
  let taskDef = fs.readFileSync(taskDefPath, 'utf8');
  taskDef = taskDef.replace(/ACCOUNT_ID/g, accountId);
  taskDef = taskDef.replace(/:latest/g, `:${imageTag}`);
  
  fs.writeFileSync('task-definition-updated.json', taskDef);
  
  execCommand(
    `aws ecs register-task-definition --cli-input-json file://task-definition-updated.json --region ${config.aws.region}`,
    'Registering new task definition'
  );
  
  // Update ECS service
  execCommand(
    `aws ecs update-service \\
      --cluster ${config.backend.ecsCluster} \\
      --service ${config.backend.ecsService} \\
      --task-definition ${config.backend.taskDefinition} \\
      --region ${config.aws.region}`,
    'Updating ECS service'
  );
  
  // Wait for deployment to stabilize
  execCommand(
    `aws ecs wait services-stable \\
      --cluster ${config.backend.ecsCluster} \\
      --services ${config.backend.ecsService} \\
      --region ${config.aws.region}`,
    'Waiting for service to stabilize'
  );
  
  console.log('✅ Backend deployment completed');
}

function deployFrontend() {
  logStep('Deploying frontend to S3/CloudFront');
  
  // Get S3 bucket name from CloudFormation outputs
  const s3Bucket = execSync(
    `aws cloudformation describe-stacks \\
      --stack-name beyondask-infrastructure \\
      --query 'Stacks[0].Outputs[?contains(OutputKey, \\"FrontendBucket\\")].OutputValue' \\
      --output text \\
      --region ${config.aws.region}`,
    { encoding: 'utf8' }
  ).trim();
  
  if (!s3Bucket) {
    throw new Error('Could not retrieve S3 bucket name from CloudFormation stack');
  }
  
  // Sync files to S3 with proper cache headers
  execCommand(
    `aws s3 sync ${config.frontend.buildDir}/ s3://${s3Bucket} \\
      --delete \\
      --cache-control "public,max-age=31536000,immutable" \\
      --exclude "*.html" \\
      --exclude "service-worker.js" \\
      --region ${config.aws.region}`,
    'Uploading static assets to S3'
  );
  
  execCommand(
    `aws s3 sync ${config.frontend.buildDir}/ s3://${s3Bucket} \\
      --delete \\
      --cache-control "public,max-age=0,must-revalidate" \\
      --include "*.html" \\
      --include "service-worker.js" \\
      --region ${config.aws.region}`,
    'Uploading HTML files to S3'
  );
  
  // Get CloudFront distribution ID
  const distributionId = execSync(
    `aws cloudformation describe-stacks \\
      --stack-name beyondask-infrastructure \\
      --query 'Stacks[0].Outputs[?contains(OutputKey, \\"CloudFront\\")].OutputValue' \\
      --output text \\
      --region ${config.aws.region}`,
    { encoding: 'utf8' }
  ).trim().split('.')[0];
  
  if (distributionId) {
    execCommand(
      `aws cloudfront create-invalidation \\
        --distribution-id ${distributionId} \\
        --paths "/*" \\
        --region ${config.aws.region}`,
      'Invalidating CloudFront cache'
    );
  }
  
  console.log('✅ Frontend deployment completed');
}

function runHealthChecks() {
  logStep('Running health checks');
  
  try {
    // Get ALB URL from CloudFormation
    const albUrl = execSync(
      `aws cloudformation describe-stacks \\
        --stack-name beyondask-infrastructure \\
        --query 'Stacks[0].Outputs[?OutputKey==\\"LoadBalancerURL\\"].OutputValue' \\
        --output text \\
        --region ${config.aws.region}`,
      { encoding: 'utf8' }
    ).trim();
    
    if (albUrl) {
      execCommand(`curl -f "${albUrl}/health"`, 'Testing backend health endpoint');
    }
    
    // Get CloudFront URL
    const cloudfrontUrl = execSync(
      `aws cloudformation describe-stacks \\
        --stack-name beyondask-infrastructure \\
        --query 'Stacks[0].Outputs[?OutputKey==\\"CloudFrontURL\\"].OutputValue' \\
        --output text \\
        --region ${config.aws.region}`,
      { encoding: 'utf8' }
    ).trim();
    
    if (cloudfrontUrl) {
      execCommand(`curl -f "https://${cloudfrontUrl}"`, 'Testing frontend availability');
    }
    
    console.log('✅ Health checks passed');
    
    // Display deployment summary
    console.log('\n🎉 Deployment completed successfully!');
    console.log(`Frontend URL: https://${cloudfrontUrl}`);
    console.log(`Backend API: ${albUrl}`);
    
  } catch (error) {
    console.warn('⚠️  Health checks failed, but deployment may still be successful');
    console.warn('Please verify URLs manually');
  }
}

async function main() {
  try {
    console.log('🚀 Starting BeyondAsk Platform Deployment');
    console.log('📍 Deploying to separate frontend and backend instances\n');
    
    await checkPrerequisites();
    buildProductionPackage();
    buildFrontend();
    deployInfrastructure();
    deployBackend();
    deployFrontend();
    runHealthChecks();
    
    console.log('\n✅ All deployments completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment if script is executed directly
if (require.main === module) {
  main();
}

module.exports = { main, config };