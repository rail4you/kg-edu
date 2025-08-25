# Agent Service - AI Chat Service

A Python-based AI chat service built with Litestar, LangGraph, and OpenAI API integration.

## Features

- **Streaming Chat**: Real-time responses using Server-Sent Events (SSE)
- **Conversation History**: Persistent conversation storage
- **User Context**: Multi-user support with conversation isolation
- **LangGraph Integration**: Advanced conversation flow management
- **OpenAI API**: Integration with OpenAI's language models

## API Endpoints

### POST /chat
Standard chat endpoint for non-streaming responses.

**Request:**
```json
{
  "message": "Hello, how are you?",
  "user_id": "user123",
  "conversation_id": "optional-conversation-id"
}
```

**Response:**
```json
{
  "message": "AI response message",
  "conversation_id": "conversation-id",
  "timestamp": "2024-01-01T00:00:00Z",
  "status": "success"
}
```

### POST /chat/stream
Streaming chat endpoint using Server-Sent Events.

**Request:** Same as `/chat`
**Response:** SSE stream with chunks of content

**Event Format:**
```
data: {"type": "content", "content": "Hello"}
data: {"type": "content", "content": " there!"}
data: {"type": "complete", "conversation_id": "conv-id", "timestamp": "2024-01-01T00:00:00Z"}
```

### GET /conversations/{conversation_id}
Retrieve conversation history.

**Response:**
```json
{
  "conversation_id": "conversation-id",
  "user_id": "user123",
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-01T00:00:00Z"
    },
    {
      "role": "assistant", 
      "content": "Hello there!",
      "timestamp": "2024-01-01T00:00:01Z"
    }
  ]
}
```

### GET /health
Health check endpoint.

## Setup

1. Install dependencies:
```bash
cd agent
uv sync
```

2. Create `.env` file:
```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_API_MODEL=gpt-3.5-turbo
HOST=0.0.0.0
PORT=8000
DEBUG=True
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

3. Run the service:
```bash
uv run python main.py
```

## Testing

Run the test script:
```bash
python test_agent.py
```

## Frontend Integration

The chat interface is integrated into the Next.js frontend at `/student` page. It includes:

- **Streaming responses**: Real-time message display
- **Conversation history**: Automatic loading of previous conversations
- **User authentication**: Integration with the existing auth system
- **Material-UI components**: Consistent styling with the rest of the application

## Architecture

- **Litestar**: Fast ASGI web framework
- **LangGraph**: Conversation flow and state management
- **OpenAI API**: AI language model integration
- **Server-Sent Events**: Real-time streaming
- **In-memory storage**: Conversation persistence (can be replaced with database)

## Environment Variables

- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_API_URL`: OpenAI API base URL
- `OPENAI_API_MODEL`: Model to use (e.g., gpt-3.5-turbo)
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `DEBUG`: Debug mode (default: True)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins