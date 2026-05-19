/**
 * DOCX 生成服务
 * 使用 pandoc 将 Markdown 转为 DOCX，然后上传到 OSS
 * 与 .NET Agent 的 PandocService.cs 保持一致
 */

import { tmpdir } from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { uploadFileToOss, saveFileRecord } from "./oss.js";

/**
 * 使用 pandoc 将 Markdown 转为 DOCX
 */
export async function convertMarkdownToDocx(
  markdown: string,
  outputPath: string
): Promise<void> {
  const tempMdPath = path.join(tmpdir(), `${randomUUID()}.md`);
  await fs.promises.writeFile(tempMdPath, markdown, "utf-8");

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("pandoc", [tempMdPath, "-o", outputPath], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `pandoc exited with code ${code}`));
      });
    });
  } finally {
    await fs.promises.unlink(tempMdPath).catch(() => {});
  }
}

/**
 * 生成 DOCX 并上传到 OSS，保存文件记录
 */
export async function generateDocxAndUpload(
  content: string,
  orgSchema: string,
  courseId: string,
  fileName?: string,
  userId?: string,
  knowledgeResourceId?: string
): Promise<{ success: boolean; fileUrl?: string; fileId?: string; error?: string }> {
  if (!courseId) {
    return { success: false, error: "无法保存教案：缺少课程ID。请先选择要创建教案的课程。" };
  }

  const tempDocxPath = path.join(tmpdir(), `${randomUUID()}.docx`);
  const finalFileName = fileName || `document_${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}.docx`;

  try {
    // 1. Markdown → DOCX
    await convertMarkdownToDocx(content, tempDocxPath);

    // 2. 上传到 OSS
    const ossUrl = await uploadFileToOss(tempDocxPath);

    // 3. 保存文件记录
    const stat = fs.statSync(tempDocxPath);
    const fileId = await saveFileRecord(
      orgSchema, finalFileName, ossUrl, stat.size, "docx",
      userId, courseId, knowledgeResourceId
    );

    return { success: true, fileUrl: ossUrl, fileId: fileId || undefined };
  } catch (err: any) {
    console.error("[docx] Generation failed:", err);
    return { success: false, error: err.message };
  } finally {
    await fs.promises.unlink(tempDocxPath).catch(() => {});
  }
}
