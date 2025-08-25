"""
Pydantic models for request/response validation
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: user, assistant, or system")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    message: str = Field(..., description="User message", min_length=1)
    user_id: str = Field(..., description="Unique user identifier")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for thread management")


class ChatResponse(BaseModel):
    message: str = Field(..., description="AI response message")
    conversation_id: str = Field(..., description="Conversation ID")
    timestamp: datetime = Field(..., description="Response timestamp")
    status: str = Field(default="success", description="Response status")


class ConversationHistory(BaseModel):
    conversation_id: str = Field(..., description="Conversation identifier")
    user_id: str = Field(..., description="User identifier")
    messages: List[ChatMessage] = Field(default_factory=list, description="List of messages")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class HealthCheck(BaseModel):
    status: str = Field(default="healthy")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = Field(default="1.0.0")


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    status: str = Field(default="error")
    timestamp: datetime = Field(default_factory=datetime.utcnow)