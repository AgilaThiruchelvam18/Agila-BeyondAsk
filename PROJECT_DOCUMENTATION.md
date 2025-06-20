# BeyondAsk - AI-Powered Knowledge Management Platform

## Project Overview

BeyondAsk is an advanced AI-powered knowledge management and workflow automation platform that enables intelligent content synthesis through visual workflow design. The platform combines multiple knowledge bases to create compelling marketing content, sales copy, and automated responses through an intuitive drag-and-drop interface.

## Architecture

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (React/Vite)  │◄──►│   (Express.js)  │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌─────────┐            ┌─────────┐            ┌─────────┐
    │ Auth0   │            │PostgreSQL│            │Pinecone │
    │ Auth    │            │Database │            │Vector DB│
    └─────────┘            └─────────┘            └─────────┘
                                  │                       │
                            ┌─────────┐            ┌─────────┐
                            │ Drizzle │            │OpenAI/  │
                            │   ORM   │            │Anthropic│
                            └─────────┘            └─────────┘
```

### Technology Stack

#### Frontend
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.14
- **Routing**: Wouter 3.3.5
- **State Management**: TanStack React Query 5.60.5
- **UI Components**: Radix UI + shadcn/ui
- **Styling**: Tailwind CSS 3.4.14
- **Form Handling**: React Hook Form 7.53.1
- **Validation**: Zod 3.23.8
- **Workflow Builder**: ReactFlow 11.11.4
- **Icons**: Lucide React + React Icons

#### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js 4.21.2
- **Database**: PostgreSQL with Drizzle ORM 0.39.1
- **Authentication**: Auth0 with JWT
- **File Processing**: Multer + PDF-parse
- **API Documentation**: Swagger
- **Session Management**: Express Session + PostgreSQL Store

#### AI & Vector Services
- **LLM Providers**: OpenAI 4.96.0, Anthropic SDK 0.37.0
- **Vector Database**: Pinecone 5.1.1
- **Embedding Generation**: OpenAI Embeddings API
- **Content Synthesis**: Custom multi-KB synthesis engine

#### External Integrations
- **Email**: SendGrid, Nodemailer
- **Cloud Storage**: AWS S3, Azure
- **Communication**: Slack Web API
- **Office**: Microsoft Graph API
- **Authentication**: Auth0

## Database Schema

### Core Entities

#### Users & Authentication
```sql
users {
  id: serial PRIMARY KEY
  auth_id: text UNIQUE (Auth0 ID)
  email: text UNIQUE
  name: text
  picture: text
  created_at: timestamp
}

user_profiles {
  id: serial PRIMARY KEY
  user_id: integer REFERENCES users(id)
  theme: text DEFAULT 'system'
  language: text DEFAULT 'en'
  notifications: boolean DEFAULT true
  preferences: json
}
```

#### Knowledge Management
```sql
knowledge_bases {
  id: serial PRIMARY KEY
  user_id: integer REFERENCES users(id)
  name: text
  description: text
  created_at: timestamp
  updated_at: timestamp
}

documents {
  id: serial PRIMARY KEY
  knowledge_base_id: integer REFERENCES knowledge_bases(id)
  title: text
  content: text
  source_type: text
  source_url: text
  metadata: json
  created_at: timestamp
}
```

#### AI Agents & Providers
```sql
agents {
  id: serial PRIMARY KEY
  user_id: integer REFERENCES users(id)
  name: text
  description: text
  instructions: text
  knowledge_base_ids: integer[]
  llm_provider_id: integer
  model: text
  temperature: decimal
  max_tokens: integer
  public_key: uuid UNIQUE
}

llm_providers {
  id: serial PRIMARY KEY
  name: text
  base_url: text
  api_key_required: boolean
  models: json
}
```

#### Visual Workflow System
```sql
visualizer_boards {
  id: serial PRIMARY KEY
  user_id: integer REFERENCES users(id)
  name: text
  description: text
  board_data: json
  created_at: timestamp
  updated_at: timestamp
}

visualizer_chat_conversations {
  id: serial PRIMARY KEY
  board_id: integer REFERENCES visualizer_boards(id)
  chat_node_id: text
  messages: json
  created_at: timestamp
  updated_at: timestamp
}
```

#### Team Management
```sql
teams {
  id: serial PRIMARY KEY
  name: text
  description: text
  owner_id: integer REFERENCES users(id)
  settings: json
  created_at: timestamp
}

team_members {
  team_id: integer REFERENCES teams(id)
  user_id: integer REFERENCES users(id)
  role: text
  permissions: json
  joined_at: timestamp
  PRIMARY KEY (team_id, user_id)
}
```

## Key Features

### 1. Visual Workflow Builder
- **Drag-and-Drop Interface**: ReactFlow-based visual workflow designer
- **Node Types**: Chat widgets, knowledge bases, API connectors
- **Real-time Collaboration**: Multi-user workflow editing
- **Custom Themes**: Branded chat widgets with theme customization

### 2. Enhanced Content Synthesis
- **Multi-KB Querying**: Simultaneous querying across multiple knowledge bases
- **Intelligent Detection**: Automatic content creation vs Q&A mode detection
- **Content Types**: Facebook ads, sales copy, email campaigns, blog posts
- **Smart Deduplication**: Prevents duplicate responses from similar sources

### 3. Knowledge Base Management
- **Multiple Sources**: PDF, text, URLs, YouTube transcripts, SharePoint
- **Vector Storage**: Pinecone-powered semantic search
- **Batch Processing**: Multiple document upload and processing
- **Scheduled Updates**: Automatic content refresh from dynamic sources

### 4. AI Agent Configuration
- **Custom Instructions**: Personalized agent behavior and tone
- **Model Selection**: Support for multiple LLM providers
- **Public API**: Webhook access via API keys
- **Widget Embedding**: Embeddable chat widgets for websites

### 5. Team Collaboration
- **Role-Based Access**: Owner, admin, member, viewer permissions
- **Resource Sharing**: Shared knowledge bases and agents
- **Team Analytics**: Usage metrics and performance tracking
- **Invitation System**: Email-based team member onboarding

### 6. Integration Ecosystem
- **Email Providers**: SendGrid, SMTP
- **Cloud Storage**: AWS S3, Azure Blob
- **Communication**: Slack, Microsoft Teams
- **Office Suite**: SharePoint, OneDrive
- **Authentication**: Auth0, OAuth providers

## API Architecture

### Authentication Flow
```
1. Frontend → Auth0 Login
2. Auth0 → JWT Token
3. Frontend → API requests with Bearer token
4. Backend → Token verification
5. Backend → User identification & authorization
```

### Core API Endpoints

#### Knowledge Bases
```
GET    /api/knowledge-bases          # List user's knowledge bases
POST   /api/knowledge-bases          # Create new knowledge base
GET    /api/knowledge-bases/:id      # Get specific knowledge base
PUT    /api/knowledge-bases/:id      # Update knowledge base
DELETE /api/knowledge-bases/:id      # Delete knowledge base
```

#### Documents
```
GET    /api/knowledge-bases/:id/documents     # List documents
POST   /api/knowledge-bases/:id/documents     # Upload document
PUT    /api/documents/:id                     # Update document
DELETE /api/documents/:id                     # Delete document
```

#### Visualizer Workflow
```
GET    /api/visualizer/all                    # List workflow boards
POST   /api/visualizer                        # Create board
GET    /api/visualizer/:id                    # Get board
PUT    /api/visualizer/:id                    # Update board
POST   /api/visualizer/:id/process-query      # Process chat query
```

#### Agents
```
GET    /api/agents                    # List user's agents
POST   /api/agents                    # Create agent
GET    /api/agents/:id                # Get agent details
PUT    /api/agents/:id                # Update agent
DELETE /api/agents/:id                # Delete agent
```

## Security Implementation

### Authentication & Authorization
- **Auth0 Integration**: Industry-standard OAuth2/OIDC
- **JWT Tokens**: Stateless authentication with refresh
- **Role-Based Access Control**: Granular permissions system
- **API Key Management**: Secure webhook access tokens

### Data Protection
- **PostgreSQL Security**: Row-level security policies
- **Input Validation**: Zod schema validation on all inputs
- **File Upload Security**: Type validation and size limits
- **Rate Limiting**: API endpoint protection
- **CORS Configuration**: Controlled cross-origin access

### Privacy & Compliance
- **Data Encryption**: At-rest and in-transit encryption
- **User Consent**: Explicit permissions for data processing
- **Data Retention**: Configurable retention policies
- **Audit Logging**: Comprehensive activity tracking

## Performance Optimization

### Frontend Performance
- **Code Splitting**: Dynamic imports for route-based splitting
- **React Query Caching**: Intelligent data caching and invalidation
- **Lazy Loading**: Component and route lazy loading
- **Asset Optimization**: Vite-powered build optimization

### Backend Performance
- **Database Indexing**: Optimized PostgreSQL indexes
- **Connection Pooling**: Efficient database connections
- **Caching Strategy**: Redis-compatible session storage
- **API Response Optimization**: Compressed responses

### AI Service Optimization
- **Vector Search**: Optimized Pinecone queries
- **Batch Processing**: Efficient document processing
- **Model Selection**: Performance-cost balanced model choices
- **Response Caching**: Intelligent response caching

## Development Workflow

### Environment Setup
```bash
# Clone repository
git clone <repository-url>

# Install dependencies
npm install

# Environment configuration
cp .env.example .env

# Database setup
npm run db:push

# Start development server
npm run dev
```

### Development Scripts
```json
{
  "dev": "tsx server/index.ts",
  "build": "node build.js",
  "prod": "NODE_ENV=production tsx server/index.ts",
  "check": "tsc",
  "db:push": "drizzle-kit push"
}
```

### Code Quality
- **TypeScript**: Full type safety across frontend and backend
- **ESLint**: Code quality enforcement
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality gates

## Deployment Architecture

### Production Environment
- **Platform**: Replit Deployments
- **Database**: PostgreSQL (managed service)
- **CDN**: Vite static asset optimization
- **Environment Variables**: Secure configuration management

### External Service Dependencies
- **Auth0**: Authentication service
- **Pinecone**: Vector database
- **OpenAI/Anthropic**: LLM providers
- **SendGrid**: Email delivery
- **AWS S3**: File storage

## Roadmap & Future Enhancements

### Phase 1: Core Stability (Current)
- ✅ Multi-knowledge base content synthesis
- ✅ Visual workflow builder
- ✅ Team collaboration features
- ✅ Enhanced chat widget system
- 🔄 AI service reliability improvements

### Phase 2: Advanced AI Features (Q2 2025)
- 🎯 Advanced content templates
- 🎯 Multi-language support
- 🎯 Custom model fine-tuning
- 🎯 Advanced analytics dashboard
- 🎯 Workflow automation triggers

### Phase 3: Enterprise Features (Q3 2025)
- 🎯 SSO integration
- 🎯 Advanced compliance features
- 🎯 Custom deployment options
- 🎯 Advanced API rate limiting
- 🎯 Webhook management system

### Phase 4: AI Innovation (Q4 2025)
- 🎯 Multi-modal content support
- 🎯 Advanced reasoning capabilities
- 🎯 Automated workflow generation
- 🎯 Predictive content suggestions
- 🎯 Advanced personalization

## Technical Debt & Known Issues

### Current Issues
1. **AI Service Reliability**: External Python service connectivity issues
2. **Error Handling**: Need comprehensive error boundary implementation
3. **Performance**: Large knowledge base query optimization needed
4. **Testing**: Comprehensive test suite implementation required

### Improvement Areas
1. **Monitoring**: Application performance monitoring setup
2. **Logging**: Structured logging implementation
3. **Documentation**: API documentation enhancement
4. **Mobile**: Responsive design improvements

## Contributing Guidelines

### Code Standards
- Follow TypeScript strict mode
- Use meaningful variable and function names
- Implement proper error handling
- Add comprehensive comments for complex logic
- Follow the existing architectural patterns

### Pull Request Process
1. Create feature branch from main
2. Implement changes with tests
3. Update documentation as needed
4. Submit PR with detailed description
5. Code review and approval process

### Development Environment
- Node.js 18+ required
- PostgreSQL 14+ for local development
- Environment variables properly configured
- All external services properly mocked for testing

---

*Last Updated: June 2025*
*Version: 1.0.0*
*Maintainer: BeyondAsk Development Team*