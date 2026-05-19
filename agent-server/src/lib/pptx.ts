/**
 * PPTX 生成服务
 * 使用 pptxgenjs，逻辑从 .NET Agent 的 generate_pptx.js 迁移
 */

import PptxGenJS from "pptxgenjs";
import { tmpdir } from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { uploadFileToOss, saveFileRecord } from "../lib/oss.js";

interface SlideContent {
  title: string;
  content: string;
  type?: string;
}

interface PptxGenerateOptions {
  courseName: string;
  knowledgePoints: string[];
  slides: SlideContent[];
  author?: string;
}

/**
 * 生成 PPTX 文件到指定路径
 */
export function generatePptxFile(options: PptxGenerateOptions, outputPath: string): Promise<string> {
  const { courseName, knowledgePoints, slides, author } = options;

  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = courseName;
  pres.author = author || "AI Assistant";

  const theme = {
    primary: "1E3A5F",
    secondary: "2E5A88",
    accent: "4A90D9",
    light: "F5F7FA",
    text: "2C3E50",
    textLight: "7F8C8D",
    white: "FFFFFF",
  };

  // === Title Slide ===
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: theme.primary };

  titleSlide.addText(courseName, {
    x: 0.5, y: 2.5, w: 9, h: 1.2,
    fontSize: 44, fontFace: "Microsoft YaHei", color: theme.white, bold: true, align: "center",
  });

  titleSlide.addText(`知识点: ${knowledgePoints.join(", ")}`, {
    x: 0.5, y: 4, w: 9, h: 0.6,
    fontSize: 20, fontFace: "Microsoft YaHei", color: theme.light, align: "center",
  });

  titleSlide.addShape(pres.shapes.RECTANGLE, {
    x: 3, y: 4.8, w: 4, h: 0.05,
    fill: { color: theme.accent },
  });

  // === Content Slides ===
  slides.forEach((slide, idx) => {
    const contentSlide = pres.addSlide();
    contentSlide.background = { color: theme.white };

    // Header bar
    contentSlide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.8,
      fill: { color: theme.primary },
    });

    contentSlide.addText(slide.title, {
      x: 0.5, y: 0.15, w: 9, h: 0.5,
      fontSize: 24, fontFace: "Microsoft YaHei", color: theme.white, bold: true,
    });

    // Content
    const contentLines = slide.content.split("\n").filter((l) => l.trim());
    if (contentLines.length > 0) {
      contentSlide.addText(contentLines.join("\n"), {
        x: 0.5, y: 1.2, w: 9, h: 4,
        fontSize: 18, fontFace: "Microsoft YaHei", color: theme.text,
        valign: "top", lineSpacing: 32,
      });
    }

    // Footer
    contentSlide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 5.4, w: 10, h: 0.03,
      fill: { color: theme.accent },
    });

    contentSlide.addText(`${idx + 1} / ${slides.length}`, {
      x: 9, y: 5.45, w: 0.8, h: 0.3,
      fontSize: 10, fontFace: "Microsoft YaHei", color: theme.textLight, align: "right",
    });
  });

  // === Thank You Slide ===
  const endSlide = pres.addSlide();
  endSlide.background = { color: theme.primary };

  endSlide.addText("谢谢!", {
    x: 0.5, y: 2, w: 9, h: 1,
    fontSize: 48, fontFace: "Microsoft YaHei", color: theme.white, bold: true, align: "center",
  });

  endSlide.addText(courseName, {
    x: 0.5, y: 3.5, w: 9, h: 0.5,
    fontSize: 20, fontFace: "Microsoft YaHei", color: theme.light, align: "center",
  });

  return pres.writeFile({ fileName: outputPath }) as unknown as Promise<string>;
}

/**
 * 生成 PPTX 并上传到 OSS，保存文件记录
 */
export async function generatePptxAndUpload(
  options: PptxGenerateOptions,
  orgSchema: string,
  userId?: string,
  courseId?: string,
  knowledgeResourceId?: string
): Promise<{ success: boolean; fileUrl?: string; fileId?: string; error?: string }> {
  const tempDir = path.join(tmpdir(), `pptx_${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const baseName = options.knowledgePoints.length > 0 && options.knowledgePoints[0] !== "概述"
    ? `${options.courseName}_${options.knowledgePoints[0]}_幻灯片`
    : `${options.courseName}_幻灯片`;
  const outputPath = path.join(tempDir, `${baseName}.pptx`);

  try {
    // 1. 生成 PPTX
    await generatePptxFile(options, outputPath);

    // 2. 上传到 OSS
    const ossUrl = await uploadFileToOss(outputPath);

    // 3. 保存文件记录
    const stat = fs.statSync(outputPath);
    const fileId = await saveFileRecord(
      orgSchema, `${baseName}.pptx`, ossUrl, stat.size, "pptx",
      userId, courseId, knowledgeResourceId
    );

    return { success: true, fileUrl: ossUrl, fileId: fileId || undefined };
  } catch (err: any) {
    console.error("[pptx] Generation failed:", err);
    return { success: false, error: err.message };
  } finally {
    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
