#!/usr/bin/env python3
"""
Test script for the agent service
"""
import asyncio
import aiohttp
import json
from datetime import datetime

async def test_agent_service():
    """Test the agent service endpoints"""
    base_url = "http://localhost:8000"
    
    async with aiohttp.ClientSession() as session:
        # Test health check
        print("Testing health check...")
        async with session.get(f"{base_url}/health") as response:
            if response.status == 200:
                health_data = await response.json()
                print(f"✓ Health check passed: {health_data}")
            else:
                print(f"✗ Health check failed: {response.status}")
                return
        
        # Test regular chat endpoint
        print("\nTesting regular chat endpoint...")
        chat_data = {
            "message": "Hello, how are you?",
            "user_id": "test_user_123",
            "conversation_id": "test_conversation"
        }
        
        async with session.post(
            f"{base_url}/chat",
            json=chat_data,
            headers={"Content-Type": "application/json"}
        ) as response:
            if response.status == 200:
                chat_response = await response.json()
                print(f"✓ Chat endpoint working: {chat_response['message'][:50]}...")
            else:
                print(f"✗ Chat endpoint failed: {response.status}")
                error_text = await response.text()
                print(f"Error: {error_text}")
        
        # Test streaming chat endpoint
        print("\nTesting streaming chat endpoint...")
        async with session.post(
            f"{base_url}/chat/stream",
            json=chat_data,
            headers={
                "Content-Type": "application/json",
                "Accept": "text/event-stream"
            }
        ) as response:
            if response.status == 200:
                print("✓ Streaming chat endpoint connected")
                content_received = False
                async for line in response.content:
                    line = line.decode('utf-8').strip()
                    if line.startswith('data: '):
                        try:
                            data = json.loads(line[6:])
                            if data.get('type') == 'content':
                                content_received = True
                                print(f"  Received content chunk: {data['content'][:30]}...")
                            elif data.get('type') == 'complete':
                                print(f"  Stream completed: {data['conversation_id']}")
                                break
                        except json.JSONDecodeError:
                            continue
                if content_received:
                    print("✓ Streaming content received successfully")
                else:
                    print("✗ No streaming content received")
            else:
                print(f"✗ Streaming chat endpoint failed: {response.status}")
        
        # Test conversation history
        print("\nTesting conversation history...")
        async with session.get(f"{base_url}/conversations/test_conversation") as response:
            if response.status == 200:
                history = await response.json()
                print(f"✓ Conversation history retrieved: {len(history['messages'])} messages")
            else:
                print(f"✗ Conversation history failed: {response.status}")

if __name__ == "__main__":
    print("Testing Agent Service")
    print("=" * 50)
    asyncio.run(test_agent_service())
    print("\n" + "=" * 50)
    print("Testing completed!")