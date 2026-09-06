# Pi Agent Rollout

## Runtime switch

- `ASSISTANT_AGENT_MODE=legacy`: keep forwarding `/api/assistant/ag-ui` to the existing `.NET /agui`.
- `ASSISTANT_AGENT_MODE=pi`: handle `/api/assistant/ag-ui` inside Bun, then call Pi custom tools and existing C# generation endpoints.

## Required environment variables

### Local defaults

- `ASSISTANT_AGENT_MODE=pi`
- `KG_EDU_BACKEND_URL=http://127.0.0.1:4000`
- `KG_EDU_AGENT_API_BASE_URL=http://127.0.0.1:5001`

### Production defaults

- `ASSISTANT_AGENT_MODE=pi`
- `KG_EDU_BACKEND_URL=http://backend:4000`
- `KG_EDU_AGENT_API_BASE_URL=http://kg-edu-ai-agent:5000`
- `AGENT_URL=http://kg-edu-ai-agent:5000/agui`

## Model configuration

- `PI_AGENT_MODEL_PROVIDER`: optional Pi provider name.
- `PI_AGENT_MODEL_ID`: optional model id.
- `PI_AGENT_THINKING_LEVEL`: optional, defaults to `medium`.
- `PI_AGENT_SESSION_DIR`: optional session storage directory. Default is `kg-edu-vite-antd/.pi/assistant-sessions`.

## Tool split

- Bun Pi gateway calls backend RPC for read tools:
  - `kg_get_courses`
  - `kg_get_knowledge_resources`
  - `kg_count_knowledge_resources`
  - `kg_list_ai_generated_files_by_course`
- Bun Pi gateway calls C# skill endpoints for generation tools:
  - `POST /agent/skills/generate-pptx`
  - `POST /agent/skills/generate-docx`

## Deployment note

- `Dockerfile.prod` must include both `server/` and `.pi/` or Pi mode will not load the gateway and skills.
- Local development still needs `bun install` in `kg-edu-vite-antd/` so `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, and `typebox` are available at runtime.
