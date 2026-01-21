# Email API Deployment Guide

## Problem

在 Docker 生产环境中，backend 容器无法通过 `localhost:5000` 访问 AI agent 容器。错误：

```
✗ HTTP request failed: %Req.TransportError{reason: :econnrefused}
```

## Solution

邮件 API 端点现在通过配置管理，支持不同环境使用不同的端点。

## Configuration

### Development Environment

**config/dev.exs:**
```elixir
config :kg_edu, :email_api,
  endpoint: System.get_env("EMAIL_API_ENDPOINT") || "http://localhost:5000/agent/email"
```

### Production Environment

**config/prod.exs:**
```elixir
config :kg_edu, :email_api,
  endpoint: System.get_env("EMAIL_API_ENDPOINT", "http://kg-edu-ai-agent:5000/agent/email")
```

## Deployment Setup

### Option 1: Using Environment Variable (Recommended)

在 backend 容器的 docker-compose.yml 或启动脚本中设置环境变量：

```yaml
backend:
  environment:
    - EMAIL_API_ENDPOINT=http://kg-edu-ai-agent:5000/agent/email
```

或者：

```bash
docker run -e EMAIL_API_ENDPOINT=http://kg-edu-ai-agent:5000/agent/email ...
```

### Option 2: Use Default Configuration

如果不设置环境变量，production 环境会使用默认值：
- `http://kg-edu-ai-agent:5000/agent/email`

这要求 AI agent 容器的名称必须是 `kg-edu-ai-agent`。

### Option 3: Custom Service Name

如果你的 AI agent 容器使用不同的名称，设置环境变量：

```bash
EMAIL_API_ENDPOINT=http://your-ai-agent-service:5000/agent/email
```

## Verify Configuration

启动容器后，检查配置是否正确：

```bash
# 进入 backend 容器
docker exec -it kg-edu-backend bash

# 检查日志
tail -f /app/_build/prod/rel/kg_edu/log/erlang.log.1

# 查找配置的端点
grep "email_api" log/*
```

发送测试邮件后，日志应该显示：

```
[SENDING EMAIL VIA API]
Student: zhang <18951684111@163.com>
Teacher: bai <619126989@qq.com>
Auth Account: 619126989@qq.com
Subject: Test Email
Endpoint: http://kg-edu-ai-agent:5000/agent/email
```

## Troubleshooting

### 1. Connection Refused Error

**症状：**
```
✗ HTTP request failed: %Req.TransportError{reason: :econnrefused}
```

**原因：** Backend 无法连接到 AI agent 容器

**解决：**
- 确保 AI agent 容器正在运行：`docker ps | grep ai`
- 检查容器是否在同一 Docker 网络：`docker network inspect kg-edu-network`
- 验证服务名称是否正确
- 检查环境变量是否设置：`docker exec kg-edu-backend env | grep EMAIL_API`

### 2. DNS Resolution Failed

**症状：** Cannot connect to host

**解决：**
- 确认 AI agent 容器名称：`docker ps --format "{{.Names}}"`
- 使用正确的容器名称设置 `EMAIL_API_ENDPOINT`

### 3. Container Not in Same Network

**症状：** Connection timeout

**解决：**
确保 backend 和 ai-agent 在同一 Docker 网络：

```yaml
services:
  backend:
    networks:
      - kg-edu-network

  ai-agent:
    networks:
      - kg-edu-network
```

## Docker Compose Example

如果 AI agent 服务不在主 docker-compose.yml 中，确保添加：

```yaml
services:
  ai-agent:
    image: your-ai-agent-image
    container_name: kg-edu-ai-agent
    ports:
      - "5000:5000"
    networks:
      - kg-edu-network
    restart: unless-stopped

  backend:
    environment:
      - EMAIL_API_ENDPOINT=http://kg-edu-ai-agent:5000/agent/email
    depends_on:
      - ai-agent
    networks:
      - kg-edu-network

networks:
  kg-edu-network:
    driver: bridge
```

## Testing

### Local Testing

```bash
# 在本地测试，确保 AI agent 运行在 localhost:5000
mix phx.server

# 发送测试邮件
# 检查日志显示: Endpoint: http://localhost:5000/agent/email
```

### Docker Testing

```bash
# 启动所有容器
docker-compose up -d

# 检查容器状态
docker ps

# 发送测试邮件，检查日志
docker logs kg-edu-backend --tail 50
```

## Summary

- ✅ Email API endpoint 现在通过配置管理
- ✅ 开发环境默认使用 `localhost:5000`
- ✅ 生产环境默认使用 `kg-edu-ai-agent:5000`
- ✅ 支持通过环境变量自定义端点
- ✅ 解决了 Docker 容器间通信问题
