"""
Chat Graph using LangGraph for conversation flow management
"""
import os
from typing import Dict, Any, List, TypedDict
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from dotenv import load_dotenv
load_dotenv()

api_url = os.getenv("OPENAI_API_URL", "")
model = os.getenv("OPENAI_API_MODEL","")
api_key = os.getenv("OPENAI_API_KEY","")

class ChatState(TypedDict):
    messages: List[Dict[str, Any]]
    user_id: str
    conversation_id: str
    context: Dict[str, Any]


class ChatGraph:
    def __init__(self):
        self.llm = ChatOpenAI(
            model_name=model,
            openai_api_key=api_key,
            openai_api_base=api_url,
            temperature=0.1,
        )
        self.memory = MemorySaver()
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        # Create the state graph
        workflow = StateGraph(ChatState)
        
        # Add nodes
        workflow.add_node("process_input", self.process_input)
        workflow.add_node("generate_response", self.generate_response)
        workflow.add_node("save_context", self.save_context)
        
        # Define the flow
        workflow.set_entry_point("process_input")
        workflow.add_edge("process_input", "generate_response")
        workflow.add_edge("generate_response", "save_context")
        workflow.add_edge("save_context", END)
        
        # Compile the graph
        return workflow.compile(checkpointer=self.memory)
    
    async def process_input(self, state: ChatState) -> ChatState:
        """Process and validate user input"""
        # Add system message if this is the start of conversation
        if len(state["messages"]) == 1:
            system_msg = {
                "role": "system",
                "content": "You are a helpful AI assistant. Provide clear, concise, and helpful responses."
            }
            state["messages"].insert(0, system_msg)
        
        return state
    
    async def generate_response(self, state: ChatState) -> ChatState:
        """Generate AI response using LLM"""
        # Convert messages to LangChain format
        langchain_messages = []
        for msg in state["messages"]:
            if msg["role"] == "system":
                langchain_messages.append(SystemMessage(content=msg["content"]))
            elif msg["role"] == "user":
                langchain_messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                langchain_messages.append(AIMessage(content=msg["content"]))
        
        # Generate response
        response = await self.llm.ainvoke(langchain_messages)
        
        # Add AI response to messages
        ai_message = {
            "role": "assistant",
            "content": response.content,
            "timestamp": self._get_timestamp()
        }
        state["messages"].append(ai_message)
        
        return state

    async def generate_response_stream(self, state: ChatState):
        """Generate AI response using LLM with streaming"""
        # Convert messages to LangChain format
        langchain_messages = []
        for msg in state["messages"]:
            if msg["role"] == "system":
                langchain_messages.append(SystemMessage(content=msg["content"]))
            elif msg["role"] == "user":
                langchain_messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                langchain_messages.append(AIMessage(content=msg["content"]))
        
        # Generate streaming response
        async for chunk in self.llm.astream(langchain_messages):
            if chunk.content:
                yield {
                    "type": "content",
                    "content": chunk.content,
                    "timestamp": self._get_timestamp()
                }
        
        # Signal completion
        yield {
            "type": "complete",
            "timestamp": self._get_timestamp()
        }
    
    async def save_context(self, state: ChatState) -> ChatState:
        """Save conversation context"""
        # Update context with recent conversation
        state["context"]["last_response"] = state["messages"][-1]["content"]
        state["context"]["message_count"] = len(state["messages"])
        
        return state
    
    def _get_timestamp(self) -> str:
        """Get current timestamp"""
        from datetime import datetime
        return datetime.utcnow().isoformat()
    
    async def chat(self, user_message: str, user_id: str, conversation_id: str) -> Dict[str, Any]:
        """Main chat function"""
        # Prepare initial state
        user_msg = {
            "role": "user",
            "content": user_message,
            "timestamp": self._get_timestamp()
        }
        
        initial_state = {
            "messages": [user_msg],
            "user_id": user_id,
            "conversation_id": conversation_id,
            "context": {}
        }
        
        # Configure for thread
        config = {"configurable": {"thread_id": conversation_id}}
        
        # Run the graph
        result = await self.graph.ainvoke(initial_state, config)
        
        # Return the AI response
        return {
            "message": result["messages"][-1]["content"],
            "conversation_id": conversation_id,
            "timestamp": result["messages"][-1]["timestamp"]
        }

    async def chat_stream(self, user_message: str, user_id: str, conversation_id: str):
        """Streaming chat function"""
        # Prepare initial state
        user_msg = {
            "role": "user",
            "content": user_message,
            "timestamp": self._get_timestamp()
        }
        
        initial_state = {
            "messages": [user_msg],
            "user_id": user_id,
            "conversation_id": conversation_id,
            "context": {}
        }
        
        # Process input first
        processed_state = await self.process_input(initial_state)
        
        # Generate streaming response
        async for chunk in self.generate_response_stream(processed_state):
            yield chunk