'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Send,
  SmartToy,
  Person,
  Refresh,
  Delete,
} from '@mui/icons-material';
import { useAuth } from '@/src/contexts/auth-context';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatComponentProps {
  initialMessages?: ChatMessage[];
  onSendMessage?: (message: string) => Promise<void>;
  onClearChat?: () => void;
  title?: string;
  placeholder?: string;
}

export const ChatComponent: React.FC<ChatComponentProps> = ({
  initialMessages = [],
  onSendMessage,
  onClearChat,
  title = 'AI Assistant',
  placeholder = 'Type your message...',
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [conversationId, setConversationId] = useState<string>('default');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversation history on mount
  useEffect(() => {
    if (user?.id) {
      const userConversationId = `${user.id}_default`;
      setConversationId(userConversationId);
      loadConversationHistory(userConversationId);
    }
  }, [user?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setStreamingMessage('');

    try {
      if (onSendMessage) {
        await onSendMessage(inputMessage.trim());
      } else {
        // Default implementation - connect to agent service
        await sendToAgentService(inputMessage.trim());
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingMessage('');
    }
  };

  const sendToAgentService = async (message: string) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    abortControllerRef.current = new AbortController();

    const response = await fetch('http://localhost:8000/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message,
        user_id: user.id,
        conversation_id: conversationId,
      }),
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let assistantMessage = '';
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content') {
                assistantMessage += data.content;
                setStreamingMessage(assistantMessage);
              } else if (data.type === 'complete') {
                const finalMessage: ChatMessage = {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: assistantMessage,
                  timestamp: data.timestamp,
                };
                setMessages(prev => [...prev, finalMessage]);
                setStreamingMessage('');
                return;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setStreamingMessage('');
    if (onClearChat) {
      onClearChat();
    }
  };

  const loadConversationHistory = async (conversationId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        const historyMessages = data.messages.map((msg: any) => ({
          id: msg.timestamp || Date.now().toString(),
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }));
        setMessages(historyMessages);
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  };

  const handleRegenerateResponse = async () => {
    if (messages.length === 0) return;

    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage.role !== 'user') return;

    // Remove the last assistant message if it exists
    const newMessages = messages.slice(0, -1);
    setMessages(newMessages);

    // Resend the last user message
    setInputMessage(lastUserMessage.content);
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, borderRadius: 1, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <SmartToy color="primary" />
            <Typography variant="h6">{title}</Typography>
          </Box>
          <Box display="flex" gap={1}>
            <IconButton
              size="small"
              onClick={handleRegenerateResponse}
              disabled={messages.length === 0 || isLoading}
              title="Regenerate last response"
            >
              <Refresh />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleClearChat}
              disabled={messages.length === 0}
              title="Clear chat"
            >
              <Delete />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Messages */}
      <Paper
        elevation={1}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          borderRadius: 1,
          mb: 2,
          maxHeight: '400px',
        }}
      >
        {messages.length === 0 && !streamingMessage && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="100%"
            color="text.secondary"
          >
            <SmartToy sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body1">
              Start a conversation with the AI assistant
            </Typography>
          </Box>
        )}

        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              gap: 2,
              mb: 2,
              alignItems: 'flex-start',
            }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
              }}
            >
              {message.role === 'user' ? <Person /> : <SmartToy />}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Chip
                  label={message.role === 'user' ? 'You' : 'AI Assistant'}
                  size="small"
                  color={message.role === 'user' ? 'primary' : 'secondary'}
                />
                <Typography variant="caption" color="text.secondary">
                  {formatTimestamp(message.timestamp)}
                </Typography>
              </Box>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: message.role === 'user' ? 'primary.light' : 'secondary.light',
                  borderRadius: 2,
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
              </Paper>
            </Box>
          </Box>
        ))}

        {streamingMessage && (
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              mb: 2,
              alignItems: 'flex-start',
            }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'secondary.main',
              }}
            >
              <SmartToy />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Chip
                  label="AI Assistant"
                  size="small"
                  color="secondary"
                />
                <Typography variant="caption" color="text.secondary">
                  {formatTimestamp(new Date().toISOString())}
                </Typography>
              </Box>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'secondary.light',
                  borderRadius: 2,
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {streamingMessage}
                  {isLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
                </Typography>
              </Paper>
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Paper>

      {/* Input */}
      <Paper elevation={2} sx={{ p: 2, borderRadius: 1 }}>
        <Box display="flex" gap={2}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isLoading}
            variant="outlined"
            size="small"
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            sx={{ minWidth: 'auto', px: 3 }}
          >
            {isLoading ? <CircularProgress size={20} /> : <Send />}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};