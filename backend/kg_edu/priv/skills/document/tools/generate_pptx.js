#!/usr/bin/env node
/**
 * generate_pptx.js — Professional PPTX generator using pptxgenjs.
 *
 * Mirrors the quality and styling of the original agent-server/src/lib/pptx.ts.
 * Called by ScriptToolFactory via System.cmd("node", [script, jsonInput]).
 *
 * Input (JSON via argv[2]):
 * {
 *   "courseName": "课程名称",
 *   "slides": "[{\"title\":\"Slide 1\",\"content\":\"...\",\"bullets\":[\"point 1\"]}]",
 *   "knowledgePoints": ["知识点1", "知识点2"],
 *   "author": "Author",
 *   "outputDir": "/tmp"
 * }
 *
 * Output (JSON to stdout):
 * {"filePath": "/tmp/xxx.pptx", "slideCount": 5}
 */

// pptxgenjs is resolved via NODE_PATH (set by document_tools.ex)
const PptxGenJS = require("pptxgenjs");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ── Parse input ─────────────────────────────────────────────────────────
const input = JSON.parse(process.argv[2] || "{}");

const courseName = input.courseName || "Untitled";
const author = input.author || "KgEdu AI";
const outputDir = input.outputDir || "/tmp";

let slides = [];
try {
  slides = typeof input.slides === "string" ? JSON.parse(input.slides) : input.slides;
} catch(e) {
  slides = [];
}
if (!Array.isArray(slides) || slides.length === 0) {
  slides = [{ title: courseName, content: "课程内容概述" }];
}

let knowledgePoints = input.knowledgePoints || [];
if (!Array.isArray(knowledgePoints)) knowledgePoints = [];
if (knowledgePoints.length === 0) {
  knowledgePoints = slides.map(s => s.title).filter(Boolean).slice(0, 5);
}

// ── Theme ───────────────────────────────────────────────────────────────
const theme = {
  primary: "1E3A5F",
  secondary: "2E5A88",
  accent: "4A90D9",
  light: "F5F7FA",
  text: "2C3E50",
  textLight: "7F8C8D",
  white: "FFFFFF",
};

// ── Build presentation ──────────────────────────────────────────────────
const pres = new PptxGenJS();
pres.layout = "LAYOUT_16x9";
pres.title = courseName;
pres.author = author;

// === Title Slide ===
const titleSlide = pres.addSlide();
titleSlide.background = { color: theme.primary };

titleSlide.addText(courseName, {
  x: 0.5, y: 2.5, w: 9, h: 1.2,
  fontSize: 44, fontFace: "Microsoft YaHei", color: theme.white, bold: true, align: "center",
});

const kpDisplay = knowledgePoints.slice(0, 5).join(", ") +
  (knowledgePoints.length > 5 ? ` 等${knowledgePoints.length}个知识点` : "");
titleSlide.addText(`知识点: ${kpDisplay}`, {
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

  contentSlide.addText(slide.title || `Slide ${idx + 1}`, {
    x: 0.5, y: 0.15, w: 9, h: 0.5,
    fontSize: 24, fontFace: "Microsoft YaHei", color: theme.white, bold: true,
  });

  // Content body
  const contentLines = [];
  if (slide.content && slide.content.trim()) {
    contentLines.push(slide.content.trim());
  }
  if (Array.isArray(slide.bullets)) {
    slide.bullets.forEach(b => {
      if (b && b.trim()) contentLines.push("• " + b.trim());
    });
  }

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

endSlide.addText("谢谢！", {
  x: 0.5, y: 2, w: 9, h: 1,
  fontSize: 48, fontFace: "Microsoft YaHei", color: theme.white, bold: true, align: "center",
});

endSlide.addText(courseName, {
  x: 0.5, y: 3.5, w: 9, h: 0.5,
  fontSize: 20, fontFace: "Microsoft YaHei", color: theme.light, align: "center",
});

// ── Save ────────────────────────────────────────────────────────────────
const safeName = courseName.replace(/[/\\ ]/g, "_").slice(0, 40);
const fileName = `${safeName}_${crypto.randomBytes(4).toString("hex")}.pptx`;
const filePath = path.join(outputDir, fileName);

pres.writeFile({ fileName: filePath })
  .then(() => {
    console.log(JSON.stringify({
      filePath: filePath,
      slideCount: pres.slides.length,
    }));
  })
  .catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
