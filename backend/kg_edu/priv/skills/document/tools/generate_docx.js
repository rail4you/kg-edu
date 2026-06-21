#!/usr/bin/env node
/**
 * generate_docx.js — Convert Markdown to DOCX using pandoc.
 *
 * Mirrors the original agent-server/src/lib/docx.ts approach.
 * Called by ScriptToolFactory via System.cmd("node", [script, jsonInput]).
 *
 * Input (JSON via argv[2]):
 *   {"content": "# Title\\n\\nParagraph...", "fileName": "doc", "outputDir": "/tmp"}
 *
 * Output (JSON to stdout):
 *   {"filePath": "/tmp/doc_xxx.docx"}
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const input = JSON.parse(process.argv[2] || "{}");
const content = input.content || "";
const fileName = input.fileName || "document";
const outputDir = input.outputDir || "/tmp";

if (!content.trim()) {
  console.error(JSON.stringify({ error: "content is required" }));
  process.exit(1);
}

// Write markdown to temp file
const safeName = fileName.replace(/[/\\ ]/g, "_").slice(0, 40);
const hex = crypto.randomBytes(4).toString("hex");
const mdPath = path.join(outputDir, `${safeName}_${hex}.md`);
const docxPath = path.join(outputDir, `${safeName}_${hex}.docx`);

fs.writeFileSync(mdPath, content, "utf-8");

try {
  execSync(`pandoc "${mdPath}" -o "${docxPath}"`, { stdio: "pipe" });
  console.log(JSON.stringify({ filePath: docxPath }));
} catch (err) {
  console.error(JSON.stringify({ error: err.message || String(err) }));
  process.exit(1);
} finally {
  // Clean up temp markdown
  try { fs.unlinkSync(mdPath); } catch (e) {}
}
