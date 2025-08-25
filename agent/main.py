"""
Litestar API server for chat application
"""
import os
import uuid
import asyncio
import json
from typing import Dict, List
from datetime import datetime

from litestar import Litestar, post, get, WebSocket, websocket
from litestar.config.cors import CORSConfig
from litestar.exceptions import HTTPException
from litestar.status_codes import HTTP_400_BAD_REQUEST, HTTP_500_INTERNAL_SERVER_ERROR
from litestar.response import Response
from litestar.response.streaming import Stream
from dotenv import load_dotenv
from chat_graph import ChatGraph
from models import ChatRequest, ChatResponse, HealthCheck, ErrorResponse, ConversationHistory

# Load environment variables
load_dotenv()

# Initialize chat graph
chat_graph = ChatGraph()

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}
conversation_history: Dict[str, List] = {}


@get("/health", response_model=HealthCheck)
async def health_check() -> HealthCheck:
    """Health check endpoint"""
    return HealthCheck()


@post("/chat", response_model=ChatResponse)
async def chat_endpoint(data: ChatRequest) -> ChatResponse:
    """Main chat endpoint"""
    try:
        # Generate conversation ID if not provided
        conversation_id = data.conversation_id or str(uuid.uuid4())
        
        # Process chat through LangGraph
        result = await chat_graph.chat(
            user_message=data.message,
            user_id=data.user_id,
            conversation_id=conversation_id
        )
        
        # Store conversation history
        if conversation_id not in conversation_history:
            conversation_history[conversation_id] = []
        
        conversation_history[conversation_id].extend([
            {"role": "user", "content": data.message, "timestamp": datetime.utcnow().isoformat()},
            {"role": "assistant", "content": result["message"], "timestamp": result["timestamp"]}
        ])
        
        return ChatResponse(
            message=result["message"],
            conversation_id=conversation_id,
            timestamp=datetime.fromisoformat(result["timestamp"])
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat processing failed: {str(e)}"
        )


@get("/conversations/{conversation_id:str}")
async def get_conversation(conversation_id: str) -> ConversationHistory:
    """Get conversation history"""
    if conversation_id not in conversation_history:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="Conversation not found"
        )
    
    messages = conversation_history[conversation_id]
    return ConversationHistory(
        conversation_id=conversation_id,
        user_id="unknown",  # Would be tracked in a real app
        messages=messages
    )


@post("/chat/stream")
async def chat_stream_endpoint(data: ChatRequest) -> Stream:
    """Streaming chat endpoint"""
    try:
        # Generate conversation ID if not provided
        conversation_id = data.conversation_id or str(uuid.uuid4())
        
        async def generate_stream():
            full_response = ""
            async for chunk in chat_graph.chat_stream(
                user_message=data.message,
                user_id=data.user_id,
                conversation_id=conversation_id
            ):
                if chunk["type"] == "content":
                    full_response += chunk["content"]
                    # Send SSE formatted data
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk['content']})}\n\n"
                elif chunk["type"] == "complete":
                    # Store conversation history
                    if conversation_id not in conversation_history:
                        conversation_history[conversation_id] = []
                    
                    conversation_history[conversation_id].extend([
                        {"role": "user", "content": data.message, "timestamp": datetime.utcnow().isoformat()},
                        {"role": "assistant", "content": full_response, "timestamp": chunk["timestamp"]}
                    ])
                    
                    # Send completion signal
                    yield f"data: {json.dumps({'type': 'complete', 'conversation_id': conversation_id, 'timestamp': chunk['timestamp']})}\n\n"
                    break
        
        return Stream(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Streaming chat failed: {str(e)}"
        )




# CORS configuration
cors_config = CORSConfig(
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Create Litestar app
app = Litestar(
    route_handlers=[
        health_check,
        chat_endpoint,
        get_conversation,
        chat_stream_endpoint,
    ],
    cors_config=cors_config,
    debug=os.getenv("DEBUG", "True").lower() == "true",
)


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )