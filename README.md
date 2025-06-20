
# BeyondAsk - AI-Powered Knowledge Management

An advanced web application for creating and managing AI knowledge agents that can learn from various data sources and interact with users through web interfaces and embeddable widgets.

## Key Features

- AI Agents with multiple LLM provider support (OpenAI, Anthropic, Mistral)
- Knowledge Base Management with support for text, PDFs, URLs, and YouTube videos
- Embeddable chat widget for external websites
- Scheduled knowledge updates
- Analytics and feedback collection
- Citation support in responses

## Tech Stack

### Frontend
- React/Next.js
- TypeScript
- Tailwind CSS
- Auth0 for authentication

### Backend
- Express.js with TypeScript
- PostgreSQL for data storage
- Pinecone for vector embeddings
- Multiple LLM integrations
- S3 compatible storage

## Application Entry Points

### Server Entrypoints
- `server/index.ts`: Main Express server (Port 5000)
  - Initializes Express
  - Connects to PostgreSQL
  - Sets up API routes
  - Handles authentication

### Client Entrypoints
- `client/src/main.tsx`: React application entry
- `client/src/App.tsx`: Root React component
- `client/index.html`: HTML entry point

### API Routes
- `server/routes.ts`: API route definitions and handlers

### Widget Entry Point
- `public/widget.js`: Embeddable chat widget for external sites

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at:
- Web Interface: http://localhost:5000
- API Documentation: http://localhost:5000/api-docs
