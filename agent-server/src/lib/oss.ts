/**
 * OSS 文件上传服务
 * 与 .NET Agent 的 OssUploadService 保持一致的配置和行为
 */

import OSS from "ali-oss";
import path from "node:path";
import fs from "node:fs";

const OSS_CONFIG = {
  bucket: process.env.OSS_BUCKET || "kg-edu",
  region: process.env.OSS_REGION || "cn-beijing",
  endpoint: process.env.OSS_ENDPOINT || "oss-cn-beijing.aliyuncs.com",
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || "LTAI5tA3M63FNf9qJPGwHGMU",
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || "Y481c9cjNvloxWTC0WOkLw8qWM9FMI",
};

let ossClient: OSS | null = null;

function getOssClient(): OSS {
  if (!ossClient) {
    ossClient = new OSS({
      bucket: OSS_CONFIG.bucket,
      region: OSS_CONFIG.region,
      endpoint: OSS_CONFIG.endpoint,
      accessKeyId: OSS_CONFIG.accessKeyId,
      accessKeySecret: OSS_CONFIG.accessKeySecret,
    });
  }
  return ossClient;
}

/**
 * 上传本地文件到 OSS
 * 返回公开访问 URL
 */
export async function uploadFileToOss(filePath: string): Promise<string> {
  const client = getOssClient();
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const objectKey = `uploads/${timestamp}/${fileName}`;

  const result = await client.put(objectKey, filePath);
  const ossUrl = `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.endpoint}/${objectKey}`;
  return ossUrl;
}

/**
 * 上传 Buffer 到 OSS
 */
export async function uploadBufferToOss(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const client = getOssClient();
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const objectKey = `uploads/${timestamp}/${fileName}`;

  await client.put(objectKey, buffer);
  const ossUrl = `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.endpoint}/${objectKey}`;
  return ossUrl;
}

/**
 * 保存文件记录到数据库（通过 RPC）
 */
export async function saveFileRecord(
  orgSchema: string,
  fileName: string,
  fileUrl: string,
  fileSize: number,
  fileType: string,
  userId?: string,
  courseId?: string,
  knowledgeResourceId?: string
): Promise<string | null> {
  try {
    const { callRpc } = await import("./api-client.js");
    const result = await callRpc("create_file", {
      tenant: orgSchema,
      input: {
        filename: fileName,
        path: fileUrl,
        size: fileSize,
        fileType,
        purpose: "ai_generated",
        source: "ai_generated",
        createdById: userId,
        courseId,
        knowledgeResourceId,
      },
      fields: ["id"],
    });
    return result?.id || null;
  } catch (err) {
    console.warn("[oss] Failed to save file record:", err);
    return null;
  }
}
