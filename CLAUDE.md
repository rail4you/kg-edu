# KgEdu - Knowledge Graph Education

This is a Phoenix application built with the Ash Framework for educational knowledge graph management.

## Project Structure

- **Backend** (`backend/kg_edu/`) - Phoenix + Ash application
  - Ash Framework for domain modeling
  - Phoenix for web interface and APIs
  - PostgreSQL database
  - Authentication with AshAuthentication
  - JSON:API endpoints with AshJsonApi

- **Agent Service** (`agent/`) - AI Chat service
  - Litestar web framework for REST API
  - LangGraph for conversation flow management
  - OpenAI API integration for AI responses
  - Streaming chat support with Server-Sent Events
  - Conversation history and user context management

- **Frontend** (`frontend/kg-edu-ui/`) - Next.js application
  - React with TypeScript and Material-UI
  - Authentication integration with backend
  - Real-time chat interface with streaming responses

## Development Setup

```bash
# Install dependencies and setup
cd backend/kg_edu
mix setup

# Start the development server
mix phx.server

# Or start with IEx for interactive development
iex -S mix phx.server
```

Visit [localhost:4000](http://localhost:4000) to access the application.
The agent service runs on [localhost:8000](http://localhost:8000).

## Key Development Commands

```bash
# Database operations
mix ash.setup          # Setup database and run migrations
mix ash.migrate        # Run pending migrations
mix ash.migrate --rollback  # Rollback migrations

# Generate migrations after resource changes
mix ash.codegen feature_name
mix ash.codegen --dev  # For development iterations

# Testing
mix test               # Run all tests
mix test test/file.exs # Run specific test file

# Assets
mix assets.setup       # Setup asset tools
mix assets.build       # Build assets
mix assets.deploy      # Build and minify assets for production

# Agent Service (from agent/ directory)
uv sync                # Install Python dependencies
uv run python main.py  # Start agent service on port 8000

# Frontend (from frontend/kg-edu-ui/)
npm run dev            # Start Next.js development server
npm run build          # Build for production
npm run start          # Start production server
```

## Using .rules with Claude Code

This project includes comprehensive usage rules in the `.rules` file (`backend/kg_edu/.rules`). These rules contain detailed guidance for working with:

### Key Packages Covered

- **Ash Framework** - Core domain modeling and business logic
- **AshPostgres** - PostgreSQL data layer
- **AshAuthentication** - User authentication
- **AshPhoenix** - Phoenix integration
- **AshJsonApi** - JSON:API endpoints
- **Igniter** - Code generation and project patching
- **Elixir/OTP** - Core language and platform patterns

### How to Use the Rules

1. **Before making changes** - Consult the relevant package's usage rules in `.rules`
2. **When working with Ash resources** - Refer to the Ash section for patterns and best practices
3. **For database changes** - Check AshPostgres rules for migration patterns
4. **Authentication features** - Use AshAuthentication rules for security practices
5. **Code generation** - Follow Igniter guidelines for automated changes

### Important Patterns to Follow

- Use code interfaces instead of direct Ash calls
- Prefer domain-specific actions over generic CRUD
- Follow Ash's declarative approach to resource modeling
- Use proper authorization patterns with policies
- Leverage the existing .rules documentation for package-specific guidance

## Ash Framework Guidelines

The `.rules` file contains comprehensive guidance for:

### Resource Design
- Organize code around domains and resources
- Create specific, well-named actions
- Put business logic inside action definitions
- Use changes, validations, and preparations appropriately

### Code Interfaces
- Define code interfaces on domains for clean APIs
- Use `get_by` for lookup operations
- Leverage query options for filtering, sorting, and loading

### Database Operations
- Use `mix ash.codegen` for migrations
- Follow the dev workflow for iterative changes
- Review migrations before applying them

### Testing
- Test through code interfaces
- Use `Ash.can?` for authorization testing
- Prefer raising functions for expected success cases

## Reference Documentation

For detailed information about any package used in this project, consult the `.rules` file at `backend/kg_edu/.rules`. This file contains:

- Package-specific usage rules and best practices
- Code examples and patterns
- Common pitfalls to avoid
- Integration guidance between packages

## Development Workflow

1. **Plan changes** - Review relevant sections in `.rules`
2. **Implement** - Follow the documented patterns
3. **Generate migrations** - Use `mix ash.codegen` for database changes
4. **Test** - Verify functionality works as expected
5. **Review** - Ensure compliance with Ash and Elixir best practices

The `.rules` file is your primary reference for understanding how to work effectively with this Ash-based application.

## Agent Service API

The agent service provides AI chat functionality with the following endpoints:

### Endpoints
- `POST /chat` - Send chat message (supports streaming)
- `GET /conversations/{conversation_id}` - Get conversation history
- `GET /health` - Health check

### Request Format (POST /chat)
```json
{
  "message": "Hello, how are you?",
  "user_id": "user123",
  "conversation_id": "optional-conversation-id"
}
```

### Response Format
```json
{
  "message": "AI response",
  "conversation_id": "conversation-id",
  "timestamp": "2024-01-01T00:00:00Z",
  "status": "success"
}
```

### Streaming Support
The agent supports streaming responses via Server-Sent Events (SSE). Set the `Accept` header to `text/event-stream` to enable streaming.

## Chat Integration

### Frontend Integration
- User authentication tokens are passed to the agent service
- The chat interface maintains conversation history
- Real-time streaming provides immediate feedback
- Material-UI components ensure consistent UI design

### Authentication Flow
1. User authenticates with Phoenix backend
2. Frontend receives JWT token
3. Token is used to identify user in agent service
4. Chat requests include user ID for context management