/**
 * 课程体系生成任务管理
 * 使用内存存储 Job 状态，支持轮询查询
 */

interface Job {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: {
    curriculumId: string;
    title: string;
    downloadUrl: string;
    fileName: string;
    markdownPreview: string;
  };
  error?: string;
}

// 内存存储 Jobs
const jobs = new Map<string, Job>();

/**
 * 创建新的 Job
 */
export function createJob(tenant: string, majorId: string): string {
  const jobId = `curriculum_${tenant}_${majorId}_${Date.now()}`;
  const job: Job = {
    id: jobId,
    status: "queued",
    message: "任务已创建，等待处理",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);
  
  // 限制 jobs 数量，防止内存泄漏（保留最近 100 个）
  if (jobs.size > 100) {
    const oldest = [...jobs.keys()][0];
    jobs.delete(oldest);
  }
  
  return jobId;
}

/**
 * 获取 Job 状态
 */
export function getJob(jobId: string): Job | null {
  return jobs.get(jobId) || null;
}

/**
 * 更新 Job 状态
 */
export function updateJob(jobId: string, updates: Partial<Job>): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;
  
  const updated: Job = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  if (updates.status === "succeeded" || updates.status === "failed") {
    updated.completedAt = new Date().toISOString();
  }
  
  jobs.set(jobId, updated);
  return true;
}

/**
 * 删除 Job（可选，保留一段时间后自动清理）
 */
export function deleteJob(jobId: string): boolean {
  return jobs.delete(jobId);
}