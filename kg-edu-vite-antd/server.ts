import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import OSS from 'ali-oss';
import { STS } from 'ali-oss';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HttpAgent, type RunAgentInput } from '@ag-ui/client';
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from '@copilotkit/runtime';
import { completeSimple, getModel } from '@earendil-works/pi-ai';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable, Writable } from 'node:stream';
import { AsyncLocalStorage } from 'node:async_hooks';
import { runPiAgentAsAgUi } from './server/pi-agent-gateway';

// AsyncLocalStorage to store per-request headers
const requestContextStorage = new AsyncLocalStorage<Map<string, string>>();

const app = new Hono();
const BACKEND_BASE_URL =
  process.env.KG_EDU_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://127.0.0.1:4000';

function stripAgUiSuffix(url: string) {
  return url.replace(/\/agui$/, '');
}

function stripAgentSuffix(url: string) {
  return url.replace(/\/agent\/?$/, '');
}

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

const configuredAgentBaseUrl =
  process.env.KG_EDU_AGENT_API_BASE_URL ||
  (process.env.AGENT_URL
    ? stripAgUiSuffix(process.env.AGENT_URL)
    : 'http://127.0.0.1:5050');
const AGENT_SERVICE_BASE_URL = stripTrailingSlash(
  stripAgentSuffix(configuredAgentBaseUrl),
);
const AGENT_API_BASE_URL = AGENT_SERVICE_BASE_URL;
console.log('[Agent Config] AGENT_API_BASE_URL:', AGENT_API_BASE_URL);
console.log('[Agent Config] AGENT_SERVICE_BASE_URL:', AGENT_SERVICE_BASE_URL);

// AG-UI Agent Configuration
// Configure these environment variables to point to your agent endpoints
// Note: These are used for the /api/ag-ui/* proxy endpoint, NOT for CopilotKit
const AGENT_ENDPOINTS = {
  // Default legacy AG-UI backend. Override in production with AGENT_URL.
  default: process.env.AGENT_URL || 'http://127.0.0.1:5050/agui',
  // Microsoft Agent Framework (C#)
  csharp: process.env.CSHARP_AGENT_URL || 'http://127.0.0.1:8000',
  // Python agent
  python: process.env.PYTHON_AGENT_URL || 'http://127.0.0.1:8001',
};

// Log agent configuration for debugging
console.log('[Agent Config] AGENT_URL env:', process.env.AGENT_URL || '(not set)');
console.log('[Agent Config] Default agent URL:', AGENT_ENDPOINTS.default);
console.log('[Agent Config] CSHARP_AGENT_URL:', AGENT_ENDPOINTS.csharp);

const ASSISTANT_AGENT_MODE = process.env.ASSISTANT_AGENT_MODE || 'pi';
console.log('[Agent Config] ASSISTANT_AGENT_MODE:', ASSISTANT_AGENT_MODE);

type CurriculumJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

type CurriculumDocxResult = {
  downloadUrl: string;
  fileName: string;
  markdownPreview: string;
};

type CurriculumJob = {
  id: string;
  orgSchema: string;
  majorId: string;
  customPrompt: string;
  status: CurriculumJobStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: CurriculumDocxResult;
  error?: string;
};

type MajorInfo = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  college?: string;
  degreeType?: string;
  duration?: number;
};

type JobInfo = {
  id?: string;
  title: string;
  description?: string;
  requirements?: string;
  salaryRange?: string;
};

type CompetencyInfo = {
  id?: string;
  name: string;
  category?: string;
  description?: string;
  parentId?: string | null;
};

const curriculumJobs = new Map<string, CurriculumJob>();
const CURRICULUM_JOB_TTL_MS = 6 * 60 * 60 * 1000;

const curriculumJobCleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [jobId, job] of curriculumJobs.entries()) {
    const updatedAt = Date.parse(job.updatedAt);
    if (!Number.isNaN(updatedAt) && now - updatedAt > CURRICULUM_JOB_TTL_MS) {
      curriculumJobs.delete(jobId);
    }
  }
}, 30 * 60 * 1000);

(curriculumJobCleanupTimer as any).unref?.();

// Configure OSS client
const client = new OSS({
  bucket: 'kg-edu',
  region: 'cn-beijing',
  endpoint: 'oss-cn-beijing.aliyuncs.com',
  accessKeyId: 'LTAI5tA3M63FNf9qJPGwHGMU',
  accessKeySecret: 'Y481c9cjNvloxWTC0WOkLw8qWM9FMI',
});

// Helper function to decode octal-escaped UTF-8 filenames
function decodeOctalFilename(filename: string): string {
  if (!/\\[0-9]{3}/.test(filename)) {
    return filename;
  }

  const bytes: number[] = [];
  let i = 0;

  while (i < filename.length) {
    if (filename[i] === '\\' && /[0-9]{3}/.test(filename.slice(i + 1, i + 4))) {
      bytes.push(parseInt(filename.slice(i + 1, i + 4), 8));
      i += 4;
    } else {
      bytes.push(filename.charCodeAt(i));
      i++;
    }
  }

  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}

function isoNow() {
  return new Date().toISOString();
}

function buildForwardRpcHeaders(requestHeaders: Headers): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const authorization = requestHeaders.get('authorization');
  const csrfToken = requestHeaders.get('x-csrf-token');

  if (authorization) headers.set('authorization', authorization);
  if (csrfToken) headers.set('x-csrf-token', csrfToken);

  return headers;
}

async function callBackendRpc<T>(
  requestHeaders: Headers,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${BACKEND_BASE_URL}/rpc/run`, {
    method: 'POST',
    headers: buildForwardRpcHeaders(requestHeaders),
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(
      `RPC ${String(payload.action)} failed: ${response.status} ${JSON.stringify(result)}`,
    );
  }

  return result.data as T;
}

function normalizeRows<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && Array.isArray((value as any).results)) {
    return (value as any).results as T[];
  }

  return [];
}

async function loadCurriculumContext(requestHeaders: Headers, orgSchema: string, majorId: string) {
  const major = await callBackendRpc<MajorInfo | null>(requestHeaders, {
    action: 'get_major',
    tenant: orgSchema,
    input: { id: majorId },
    fields: ['id', 'name', 'code', 'description', 'college', 'degreeType', 'duration'],
  });

  if (!major) {
    throw new Error('专业不存在');
  }

  const jobsData = await callBackendRpc<unknown>(requestHeaders, {
    action: 'get_positions_by_major',
    tenant: orgSchema,
    input: { majorId },
    fields: ['id', 'title', 'description', 'requirements', 'salaryRange'],
  });

  const competenciesData = await callBackendRpc<unknown>(requestHeaders, {
    action: 'get_competencies_by_major',
    tenant: orgSchema,
    input: { majorId },
    fields: ['id', 'name', 'category', 'description', 'parentId'],
  });

  return {
    major,
    jobs: normalizeRows<JobInfo>(jobsData),
    competencies: normalizeRows<CompetencyInfo>(competenciesData),
  };
}

function buildCurriculumContextMarkdown(
  major: MajorInfo,
  jobs: JobInfo[],
  competencies: CompetencyInfo[],
) {
  const lines: string[] = [];

  lines.push('## 专业信息');
  lines.push(`- 名称: ${major.name}`);
  if (major.code) lines.push(`- 代码: ${major.code}`);
  if (major.college) lines.push(`- 学院: ${major.college}`);
  if (major.degreeType) lines.push(`- 学位类型: ${major.degreeType}`);
  if (major.duration) lines.push(`- 学制: ${major.duration}年`);
  if (major.description) lines.push(`- 描述: ${major.description}`);

  if (jobs.length > 0) {
    lines.push('', `## 关联岗位 (${jobs.length}个)`);
    jobs.forEach((job, index) => {
      lines.push('', `### 岗位${index + 1}: ${job.title}`);
      if (job.description) lines.push(`描述: ${job.description}`);
      if (job.requirements) lines.push(`要求: ${job.requirements}`);
      if (job.salaryRange) lines.push(`薪资: ${job.salaryRange}`);
    });
  }

  if (competencies.length > 0) {
    const categoryLabels: Record<string, string> = {
      professional: '专业能力',
      general: '通用能力',
      practical: '实践能力',
    };
    const groupedCompetencies = competencies.reduce<Record<string, CompetencyInfo[]>>(
      (acc, item) => {
        const category = item.category || 'professional';
        acc[category] ||= [];
        acc[category]!.push(item);
        return acc;
      },
      {},
    );

    lines.push('', `## 能力素质图谱 (${competencies.length}个能力节点)`);

    for (const [category, rows] of Object.entries(groupedCompetencies)) {
      lines.push('', `### ${categoryLabels[category] || category}`);
      rows.forEach((item) => {
        const desc = item.description ? ` - ${item.description}` : '';
        lines.push(`- ${item.name}${desc}`);
      });
    }
  }

  return lines.join('\n');
}

function getCurriculumModel() {
  const provider = process.env.PI_AGENT_MODEL_PROVIDER;
  const modelId = process.env.PI_AGENT_MODEL_ID;

  if (!provider || !modelId) {
    throw new Error('PI_AGENT_MODEL_PROVIDER or PI_AGENT_MODEL_ID is not configured');
  }

  const model = getModel(provider as any, modelId as any);
  if (!model) {
    throw new Error(`Pi model not found: ${provider}/${modelId}`);
  }

  return model;
}

async function generateCurriculumMarkdown(contextMarkdown: string, customPrompt: string) {
  const model = getCurriculumModel();
  const prompt = [
    '你是一位高等教育课程体系设计专家。',
    '请严格根据提供的专业信息、岗位数据和能力素质图谱，输出一份完整的课程体系设计方案。',
    '只输出 Markdown，不要输出解释性前言，不要使用代码块包裹 Markdown。',
    '文档必须包含以下部分：',
    '# [专业名称] 课程体系设计方案',
    '## 一、培养目标',
    '## 二、毕业要求',
    '## 三、课程体系框架',
    '### 通识教育课程',
    '### 学科基础课程',
    '### 专业核心课程',
    '### 专业选修课程',
    '### 集中实践教学环节',
    '## 四、课程与能力对应关系',
    '## 五、教学进程安排',
    '## 六、说明与建议',
    '要求：内容具体可执行，学分总量合理，课程安排符合教育规律。',
    '',
    '请根据以下信息设计课程体系方案。',
    '',
    contextMarkdown,
    '',
    '## 用户自定义要求',
    customPrompt.trim() || '无特殊要求，请综合分析生成。',
  ].join('\n');

  const response = await completeSimple(
    model as any,
    {
      messages: [
        {
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        },
      ],
    } as any,
    { reasoning: 'medium' } as any,
  );

  const markdown = response.content
    .filter((block): block is Extract<(typeof response.content)[number], { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  if (!markdown) {
    throw new Error('模型没有返回课程体系内容');
  }

  return markdown;
}

function sanitizeForJson(value: string) {
  return Array.from(value)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join('');
}

function buildSafeMarkdownPreview(markdown: string) {
  const sanitized = sanitizeForJson(markdown);
  return sanitized.length > 4000 ? `${sanitized.slice(0, 4000)}\n\n...` : sanitized;
}

async function runPandoc(markdown: string, outputPath: string) {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'curriculum-docx-'));
  const inputPath = path.join(tempDir, 'curriculum.md');

  await fs.writeFile(inputPath, markdown, 'utf8');

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('pandoc', [inputPath, '-o', outputPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `pandoc exited with code ${code}`));
      });
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function uploadFileToOss(filePath: string) {
  const fileName = path.basename(filePath);
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const objectKey = `uploads/${timestamp}/${fileName}`;

  const result = await client.put(objectKey, filePath);
  return result.url;
}

function updateCurriculumJob(jobId: string, patch: Partial<CurriculumJob>) {
  const current = curriculumJobs.get(jobId);
  if (!current) return;

  curriculumJobs.set(jobId, {
    ...current,
    ...patch,
    updatedAt: isoNow(),
  });
}

async function executeCurriculumJob(
  jobId: string,
  requestHeaders: Headers,
) {
  const job = curriculumJobs.get(jobId);
  if (!job) return;

  updateCurriculumJob(jobId, {
    status: 'running',
    message: '正在生成课程体系文档',
  });

  const tempDocxPath = path.join(
    tmpdir(),
    `${job.majorId}_${Date.now()}_${randomUUID()}.docx`,
  );

  try {
    const { major, jobs, competencies } = await loadCurriculumContext(
      requestHeaders,
      job.orgSchema,
      job.majorId,
    );
    updateCurriculumJob(jobId, {
      message: '正在调用模型生成课程体系内容',
    });

    const contextMarkdown = buildCurriculumContextMarkdown(major, jobs, competencies);
    const markdown = await generateCurriculumMarkdown(contextMarkdown, job.customPrompt);

    updateCurriculumJob(jobId, {
      message: '正在生成 DOCX 文件',
    });
    const fileName = `${major.name}_课程体系设计_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.docx`;
    await runPandoc(markdown, tempDocxPath);

    updateCurriculumJob(jobId, {
      message: '正在上传文档到 OSS',
    });
    const downloadUrl = await uploadFileToOss(tempDocxPath);

    updateCurriculumJob(jobId, {
      status: 'succeeded',
      message: '课程体系文档生成成功',
      completedAt: isoNow(),
      result: {
        downloadUrl,
        fileName,
        markdownPreview: buildSafeMarkdownPreview(markdown),
      },
    });
  } catch (error) {
    console.error('[Curriculum Job] failed:', error);
    updateCurriculumJob(jobId, {
      status: 'failed',
      message: '课程体系文档生成失败',
      completedAt: isoNow(),
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await fs.rm(tempDocxPath, { force: true }).catch(() => undefined);
  }
}

// Helper function for retrying OSS uploads with exponential backoff
async function uploadWithRetry(
  client: OSS,
  filename: string,
  buffer: Buffer,
  maxRetries: number = 2,
  baseTimeout: number = 2000
) {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Upload attempt ${attempt + 1}/${maxRetries + 1} for file: ${filename}`);

      // Add timeout to the upload request
      const uploadPromise = client.put(filename, buffer);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout')), baseTimeout * (attempt + 1));
      });

      const result = await Promise.race([uploadPromise, timeoutPromise]);
      console.log(`Upload successful on attempt ${attempt + 1} for: ${filename}`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Upload attempt ${attempt + 1} failed for ${filename}:`, lastError.message);

      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const delay = baseTimeout * Math.pow(2, attempt); // Exponential backoff with jitter
        console.log(`Waiting ${Math.round(delay)}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

// Enable CORS globally
app.use('/*', cors());

// ===== API ROUTES - MUST COME BEFORE STATIC FILES =====

// Proxy RPC requests to the backend service
app.all('/rpc/*', async (c) => {
  const url = new URL(c.req.url);
  const targetUrl = `${BACKEND_BASE_URL}${url.pathname}${url.search}`;

  console.log(`Proxying ${c.req.method} ${url.pathname} -> ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.raw.blob() : undefined,
    });

    // Create new headers without compression-related headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');

    // Get the response body (this automatically decompresses if needed)
    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return c.json(
      {
        error: 'Proxy request failed',
        details: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }
});

app.post('/api/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const fileName = file.name || 'unknown-file';
    const originalName = decodeOctalFilename(fileName);
    console.log('Uploading file:', originalName, 'size:', file.size, 'type:', file.type);

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a safe filename using timestamp
    const timestamp = Date.now();
    const fileExtension = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
    const safeFilename = `${timestamp}${fileExtension}`;

    // Determine max retries based on file size (larger files get more retries)
    const maxRetries = file.size > 10 * 1024 * 1024 ? 5 : 3; // 5 retries for >10MB, 3 for smaller
    const baseTimeout = Math.max(5000, Math.min(30000, (file.size / 1024) * 100)); // 5-30s based on size

    console.log(`Starting upload with ${maxRetries} retries and ${baseTimeout}ms base timeout`);

    // Upload to OSS with retry and timeout
    const result = await uploadWithRetry(client, originalName, buffer, maxRetries, baseTimeout);

    return c.json({
      success: true,
      url: (result as any).url,
      filename: safeFilename,
      originalName: originalName,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));

    // Determine appropriate error message and status
    let errorMessage = 'Upload failed';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Upload timeout - file may be too large or connection slow';
        statusCode = 408;
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error - please check your connection';
        statusCode = 503;
      } else if (error.message.includes('OSS')) {
        errorMessage = 'OSS storage error - please try again';
      } else {
        errorMessage = `Upload failed: ${error.message}`;
      }
    }

    return c.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: statusCode as any }
    );
  }
});

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/curriculum/jobs', async (c) => {
  try {
    const body = await c.req.json<{
      orgSchema?: string;
      majorId?: string;
      customPrompt?: string;
    }>();

    if (!body.orgSchema?.trim()) {
      return c.json({ success: false, message: 'orgSchema is required' }, { status: 400 });
    }

    if (!body.majorId?.trim()) {
      return c.json({ success: false, message: 'majorId is required' }, { status: 400 });
    }

    const jobId = randomUUID();
    const now = isoNow();

    curriculumJobs.set(jobId, {
      id: jobId,
      orgSchema: body.orgSchema.trim(),
      majorId: body.majorId.trim(),
      customPrompt: body.customPrompt?.trim() || '',
      status: 'queued',
      message: '任务已创建，等待处理',
      createdAt: now,
      updatedAt: now,
    });

    void executeCurriculumJob(jobId, new Headers(c.req.raw.headers));

    return c.json(
      {
        success: true,
        message: '课程体系文档生成任务已创建',
        data: {
          jobId,
          status: 'queued',
        },
      },
      { status: 202 },
    );
  } catch (error) {
    console.error('[Curriculum Job] create failed:', error);
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '创建任务失败',
      },
      { status: 500 },
    );
  }
});

app.get('/api/curriculum/jobs/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const job = curriculumJobs.get(jobId);

  if (!job) {
    return c.json(
      {
        success: false,
        message: '任务不存在或已过期',
      },
      { status: 404 },
    );
  }

  return c.json({
    success: true,
    data: {
      jobId: job.id,
      status: job.status,
      message: job.error || job.message,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      result: job.result,
    },
  });
});

// ===== AGENT API PROXY =====
// Direct agent API proxy - routes /agent/* to the C# agent service
// Uses AGENT_URL environment variable for production configuration
app.all('/agent/*', async (c) => {
  const reqPath = c.req.path.replace(/^\/agent\//, '');
  const targetUrl = `${AGENT_API_BASE_URL}/${reqPath}`;

  console.log(`[Agent] Proxying ${c.req.method} to: ${targetUrl}`);

  try {
    const headers = new Headers();
    c.req.raw.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    });

    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.blob() : undefined,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    const responseBody = await response.arrayBuffer();

    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Agent] Proxy error:`, error);
    return c.json(
      {
        error: 'Agent request failed',
        details: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }
});

// Proxy SignalR requests through to C# Agent (for development)
app.all('/api/copilotkit/hubs/*', async (c) => {
  const fullPath = c.req.path;
  const path = fullPath.replace('/api/copilotkit/hubs/', '');
  const targetUrl = `${AGENT_SERVICE_BASE_URL}/hubs/${path}`;

  console.log(`[SignalR] Proxying ${c.req.method} ${fullPath} to: ${targetUrl}`);

  try {
    const headers = new Headers();
    c.req.raw.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    });

    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.blob() : undefined,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    const responseBody = await response.arrayBuffer();

    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[SignalR] Proxy error:`, error);
    return c.json(
      {
        error: 'SignalR proxy failed',
        details: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }
});

// ===== AG-UI PROTOCOL ENDPOINTS =====
// These endpoints proxy requests to external agents using the AG-UI protocol
// Reference: https://github.com/copilotkit/ag-ui

// Generic AG-UI agent endpoint - proxies to configured agent URLs
app.all('/api/ag-ui/:agentName/*', async (c) => {
  const agentName = c.req.param('agentName');
  const path = c.req.param('*');

  // Get agent endpoint URL
  const agentUrl =
    AGENT_ENDPOINTS[agentName as keyof typeof AGENT_ENDPOINTS] || AGENT_ENDPOINTS.default;
  const targetUrl = `${agentUrl}/${path}`;

  console.log(`[AG-UI] Proxying ${c.req.method} to ${agentName}: ${targetUrl}`);

  try {
    // Prepare headers
    const headers = new Headers();
    c.req.raw.headers.forEach((value, key) => {
      // Skip host header to avoid conflicts
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    });

    // Make request to agent
    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.blob() : undefined,
    });

    // For streaming responses (SSE), return directly
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    }

    // For regular responses, handle compression
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');

    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[AG-UI] Proxy error for ${agentName}:`, error);
    return c.json(
      {
        error: 'AG-UI agent request failed',
        agent: agentName,
        details: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }
});

// ===== COPILOTKIT RUNTIME =====
// CopilotKit runtime with AG-UI agent support
// Uses HttpAgent to connect to the F# AG-UI backend

const serviceAdapter = new ExperimentalEmptyAdapter();

// Custom HttpAgent that forwards headers from request context
class ForwardingHttpAgent extends HttpAgent {
  constructor(config: ConstructorParameters<typeof HttpAgent>[0]) {
    super(config);
  }

  protected override requestInit(input: RunAgentInput): RequestInit {
    const baseInit = super.requestInit(input);

    // Get headers from AsyncLocalStorage context
    const contextHeaders = requestContextStorage.getStore();

    if (contextHeaders) {
      const headers = new Headers(baseInit.headers as HeadersInit);

      // Forward specific headers from the request context
      const headersToForward = ['x-org-schema', 'authorization', 'orgschema'];
      for (const [key, value] of contextHeaders.entries()) {
        if (headersToForward.includes(key.toLowerCase())) {
          headers.set(key, value);
          console.log(`[ForwardingHttpAgent] Forwarding header: ${key}`);
        }
      }

      return { ...baseInit, headers };
    }

    return baseInit;
  }
}

// Create HttpAgent that connects to F# AG-UI backend
const remoteAgent = new ForwardingHttpAgent({
  url: AGENT_ENDPOINTS.default,
});

// Create the CopilotKit runtime with the remote agent
const runtime = new CopilotRuntime({
  agents: {
    "my_agent": remoteAgent,
  },
});

// Create endpoint handler using Node.js HTTP endpoint
const copilotKitHandler = copilotRuntimeNodeHttpEndpoint({
  runtime,
  serviceAdapter,
  endpoint: '/api/copilotkit',
});

// Helper function to convert Web Request/Response to Node.js streams
async function handleCopilotKitWithStreams(request: Request): Promise<Response> {
  // Extract headers to forward and store in context
  const headersToForward = new Map<string, string>();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (['x-org-schema', 'authorization', 'orgschema', 'x-system-prompt', 'x-user-prompt', 'x-assistant-example'].includes(lowerKey)) {
      headersToForward.set(key, value);
      console.log(`[handleCopilotKitWithStreams] Storing header for forwarding: ${key}`);
    }
  });

  // Run within AsyncLocalStorage context so headers are available to ForwardingHttpAgent
  return requestContextStorage.run(headersToForward, () => {
    return new Promise((resolve, reject) => {
      const url = new URL(request.url);

      // Create Node.js readable stream from request body
      const bodyChunks: Buffer[] = [];
      let bodyEnded = false;

    // Create a mock Node.js IncomingMessage
    const req = new Readable({
      read() {
        // Push body chunks
        if (bodyChunks.length > 0) {
          this.push(Buffer.concat(bodyChunks));
          bodyChunks.length = 0;
        }
        if (bodyEnded) {
          this.push(null);
        }
      }
    }) as IncomingMessage;

    // Set request properties
    req.method = request.method;
    req.url = url.pathname + url.search;
    req.headers = Object.fromEntries(request.headers);
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;
    req.socket = {
      encrypted: url.protocol === 'https:',
      remoteAddress: '127.0.0.1',
      remotePort: 3000,
    } as any;

    // Get request body
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      request.arrayBuffer().then((buffer) => {
        bodyChunks.push(Buffer.from(buffer));
        bodyEnded = true;
        req.emit('data', Buffer.from(buffer));
        req.emit('end');
      }).catch(reject);
    } else {
      bodyEnded = true;
      req.emit('end');
    }

    // Create response chunks collector
    const resChunks: Buffer[] = [];
    const statusCode = 200;
    const resHeaders: Record<string, string> = {};

    // Create a mock Node.js ServerResponse
    const res = {
      statusCode: 200,
      statusMessage: 'OK',
      _headers: {} as Record<string, string>,
      finished: false,
      headersSent: false,
      writableEnded: false,

      setHeader(name: string, value: string) {
        this._headers[name.toLowerCase()] = value;
        return this;
      },
      getHeader(name: string) {
        return this._headers[name.toLowerCase()];
      },
      removeHeader(name: string) {
        delete this._headers[name.toLowerCase()];
      },
      writeHead(code: number, headers?: Record<string, string>) {
        this.statusCode = code;
        if (headers) {
          Object.assign(this._headers, headers);
        }
        this.headersSent = true;
        return this;
      },
      write(chunk: any, encoding?: any, cb?: any) {
        resChunks.push(Buffer.from(chunk));
        if (cb) cb();
        return true;
      },
      end(chunk: any, encoding?: any, cb?: any) {
        if (chunk) {
          resChunks.push(Buffer.from(chunk));
        }
        this.finished = true;
        this.writableEnded = true;

        const body = Buffer.concat(resChunks);
        const headers = new Headers();
        Object.entries(this._headers).forEach(([k, v]) => {
          headers.set(k, v);
        });

        resolve(new Response(body, {
          status: this.statusCode,
          headers,
        }));

        if (cb) cb();
        return this;
      },
      on(event: string, listener: any) {
        return this;
      },
      once(event: string, listener: any) {
        return this;
      },
      emit(event: string, ...args: any[]) {
        return false;
      },
    } as unknown as ServerResponse;

    // Call the handler
    copilotKitHandler(req, res, (err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(new Response('Not Found', { status: 404 }));
      }
    });
    });
  });
}

// Handle /info endpoint directly - return JSON for agent discovery
app.all('/api/copilotkit/info', async (c) => {
  const response = {
    version: "1.51.4",
    agents: {
      "my_agent": {
        name: "my_agent",
        description: "教育知识管理助手 - 帮助教师管理课程、生成练习题和试卷",
      }
    },
    audioFileTranscriptionEnabled: false
  };
  return c.json(response);
});

// Handle CopilotKit requests using Node.js stream adapter
app.all('/api/copilotkit/*', async (c) => {
  const path = c.req.param('*') || '';
  console.log(`[CopilotKit] Handling ${c.req.method} /api/copilotkit/${path}`);

  try {
    const response = await handleCopilotKitWithStreams(c.req.raw);
    return response;
  } catch (error) {
    console.error(`[CopilotKit] Error:`, error);
    return c.json(
      {
        error: 'CopilotKit request failed',
        details: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }
});

app.all('/api/copilotkit', async (c) => {
  console.log(`[CopilotKit] Handling ${c.req.method} /api/copilotkit`);

  try {
    const response = await handleCopilotKitWithStreams(c.req.raw);
    return response;
  } catch (error) {
    console.error(`[CopilotKit] Error:`, error);
    return c.json(
      {
        error: 'CopilotKit request failed',
        details: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }
});

// STS endpoint for getting temporary OSS credentials
app.post('/api/sts-token', async (c) => {
  try {
    const body = await c.req.json();
    const { fileName, fileSize, fileType } = body;

    if (!fileName) {
      return c.json({ error: 'fileName is required' }, 400);
    }

    // Create STS client using ali-oss
    const sts = new STS({
      accessKeyId: 'LTAI5tA3M63FNf9qJPGwHGMU',
      accessKeySecret: 'Y481c9cjNvloxWTC0WOkLw8qWM9FMI',
      endpoint: 'https://sts.cn-beijing.aliyuncs.com',
    });

    // Generate a unique role session name
    const roleSessionName = `oss-upload-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Define role ARN (replace with your actual role ARN)
    const roleArn = 'acs:ram::1254089347973916:role/ossuploadrole';

    // Define custom policy for upload permissions
    const policy = JSON.stringify({
      Version: '1',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['oss:PutObject', 'oss:PutObjectAcl'],
          Resource: [`acs:oss:*:*:kg-edu/uploads/*`, `acs:oss:*:*:kg-edu/uploads/*`],
        },
      ],
    });

    // Assume the role
    const result = await sts.assumeRole(roleArn, ``, '3600', roleSessionName);

    console.log('STS Result:', JSON.stringify(result, null, 2));

    if (!result || !result.credentials) {
      throw new Error('Invalid credentials received from STS');
    }

    // Generate upload path with date prefix
    const now = new Date();
    const datePrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const uploadPath = `uploads/${datePrefix}/${fileName}`;

    // Return temporary credentials and upload info
    return c.json({
      success: true,
      credentials: {
        accessKeyId: result.credentials.AccessKeyId,
        accessKeySecret: result.credentials.AccessKeySecret,
        securityToken: result.credentials.SecurityToken,
        expiration: result.credentials.Expiration,
      },
      uploadConfig: {
        region: 'cn-beijing',
        bucket: 'kg-edu',
        endpoint: 'https://oss-cn-beijing.aliyuncs.com',
        uploadPath: uploadPath,
        fileName: fileName,
        fileSize: fileSize,
        fileType: fileType,
      },
    });
  } catch (error) {
    console.error('STS token generation error:', error);

    let errorMessage = 'Failed to generate STS token';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('InvalidAccessKeyId')) {
        errorMessage = 'Invalid access key configuration';
        statusCode = 401;
      } else if (error.message.includes('InvalidRole')) {
        errorMessage = 'Invalid role configuration - check Role ARN';
        statusCode = 400;
      } else {
        errorMessage = `STS error: ${error.message}`;
      }
    }

    return c.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error),
      },
      statusCode
    );
  }
});

// ===== ASSISTANT-UI AG-UI PROXY =====
// New stable chat entry point for assistant-ui migration
// Phase 1: Forward to existing .NET AG-UI agent
app.all('/api/assistant/ag-ui', async (c) => {
  if (ASSISTANT_AGENT_MODE === 'pi') {
    console.log(`[Assistant-UI] Handling ${c.req.method} with Pi gateway`);

    try {
      const body =
        c.req.method !== 'GET' && c.req.method !== 'HEAD'
          ? await c.req.json()
          : {};

      const stream = await runPiAgentAsAgUi(c.req.raw.headers, body);
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (error) {
      console.error('[Assistant-UI] Pi gateway error:', error);
      return c.json(
        {
          error: 'Assistant Pi gateway failed',
          details: error instanceof Error ? error.message : String(error),
        },
        502
      );
    }
  }

  const targetUrl = AGENT_ENDPOINTS.default;
  console.log(`[Assistant-UI] Proxying ${c.req.method} to legacy AG-UI: ${targetUrl}`);

  try {
    const headers = new Headers();
    c.req.raw.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    });

    const body = c.req.method !== 'GET' && c.req.method !== 'HEAD'
      ? await c.req.blob()
      : undefined;

    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers,
      body,
    });

    // For streaming responses (SSE), return directly
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    // Stream SSE responses directly
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // For regular responses
    const responseBody = await response.arrayBuffer();
    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[Assistant-UI] Proxy error:', error);
    return c.json(
      {
        error: 'Assistant AG-UI proxy failed',
        details: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }
});

// ===== STATIC FILES - MUST COME LAST =====

// Helper function to serve index.html for SPA routing
async function serveIndexHTML(c: any) {
  const filePath = `${process.cwd()}/dist/index.html`;
  const file = Bun.file(filePath);
  return new Response(file);
}

// Serve static files from dist directory (but NOT for /api/* or /rpc/*)
app.use('/assets/*', serveStatic({ root: './dist' }));
app.use('/logo.png', serveStatic({ path: './dist/logo.png' }));
app.use('/logo-light.png', serveStatic({ path: './dist/logo-light.png' }));
app.use('/logo.svg', serveStatic({ path: './dist/logo.svg' }));
app.use('/logo-light.svg', serveStatic({ path: './dist/logo-light.svg' }));
app.use('/vite.svg', serveStatic({ path: './dist/vite.svg' }));
app.use('/favicon.ico', serveStatic({ path: './dist/favicon.ico' }));

// Fallback for SPA routing - catch all remaining GET requests
app.get('/*', async (c) => {
  // Skip if it's an API route
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/rpc/')) {
    return c.text('Not Found', 404);
  }
  // Serve index.html for all other routes (SPA routing)
  return serveIndexHTML(c);
});

const port = process.env.PORT || 3000;
console.log(`Server running on http://127.0.0.1:${port}`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 240,
};
