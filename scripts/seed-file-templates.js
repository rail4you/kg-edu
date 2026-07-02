#!/usr/bin/env node
/**
 * 文件模板种子脚本
 *
 * 用途：将所有模板 URL 整理到 file_templates 表中，确保每个 section 都有对应模板。
 * 如果某个 section 在数据库中不存在，则用默认模板填充。
 *
 * 使用方法：
 *   1. 查看当前状态（dry-run）:
 *      node scripts/seed-file-templates.js
 *
 *   2. 真正执行写入:
 *      node scripts/seed-file-templates.js --apply
 *
 * 环境变量：
 *   API_URL     - RPC 端点地址（默认 http://123.57.141.233/rpc/run）
 */

const API_URL = process.env.API_URL || 'http://123.57.141.233/rpc/run';

// ── 所有已知模板定义 ──────────────────────────────────────────────────────────
// 每个 section 可以有多个模板 URL。
// NOTE: URL 必须与数据库中存储的完全一致（有的 URL-encoded，有的含中文）。
const DEFAULT_TEMPLATE_URL =
  'https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-25/template.xlsx';

const KNOWN_SECTIONS = {
  manual: {
    label: '操作手册',
    urls: [
      // 存储为 URL-encoded
      'http://kg-edu.oss-cn-beijing.aliyuncs.com/%E8%AF%BE%E5%A0%82%E6%98%9F%E6%99%BA%E6%85%A7%E6%95%99%E5%AD%A6%E5%B9%B3%E5%8F%B0%E6%93%8D%E4%BD%9C%E6%89%8B%E5%86%8C%EF%BC%88%E7%AC%AC%E4%BA%8C%E6%9C%9F%EF%BC%89.docx',
      'http://kg-edu.oss-cn-beijing.aliyuncs.com/%E8%AE%BE%E7%BD%AE%E8%AF%BE%E7%A8%8B.docx',
    ],
  },
  xmind: {
    label: 'XMind 脑图',
    urls: ['http://kg-edu.oss-cn-beijing.aliyuncs.com/xmind.xmind'],
  },
  llm: {
    label: 'LLM 导入',
    urls: ['http://kg-edu.oss-cn-beijing.aliyuncs.com/llm.txt'],
  },
  knowledge: {
    label: '知识点导入',
    urls: [
      // 存储为中文路径
      'https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/知识点导入模版.xlsx',
    ],
  },
  homework: {
    label: '作业导入',
    urls: [
      'https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/作业导入模版.xlsx',
    ],
  },
  teacher_manual: {
    label: '教师端使用手册',
    urls: [
      'https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-25/教师端使用手册.docx',
    ],
  },
  student_manual: {
    label: '学生端使用手册',
    urls: [
      'https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-25/学生端使用手册.docx',
    ],
  },
  relation: {
    label: '知识点关系导入',
    urls: [
      'https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-25/template.xlsx',
    ],
  },
  user: {
    label: '用户导入',
    urls: [
      'https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/用户.xlsx',
    ],
  },
  chapter: {
    label: '章节导入',
    urls: [
      'https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/章节导入模版.xlsx',
    ],
  },
  knowledge_question: {
    label: '问题图谱导入',
    urls: [
      'https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/问题图谱导入模版.xlsx',
    ],
  },
  exercise: {
    label: '习题导入',
    urls: [
      'https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/2026-03-30/习题导入模版.xlsx',
    ],
  },
};

// ── RPC 调用封装 ──────────────────────────────────────────────────────────────

async function rpc(action, input = {}, fields = []) {
  const body = { action, input, fields };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`RPC ${action} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────────

/** 从 URL 中提取文件名（处理中文和 URL-encoded） */
function extractFilename(url) {
  const raw = url.split('/').pop() || url;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// ── 主逻辑 ────────────────────────────────────────────────────────────────────

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('='.repeat(70));
  console.log('  文件模板种子脚本');
  console.log('  模式:', apply ? '🟢 写入模式 (--apply)' : '🔵 预览模式 (dry-run)');
  console.log('  API:', API_URL);
  console.log('='.repeat(70));
  console.log();

  // 1. 查询当前数据库中的模板
  console.log('📡 查询当前模板列表...');
  let existingTemplates;
  try {
    const resp = await rpc('list_file_templates', {}, ['id', 'section', 'filePath']);
    existingTemplates = resp.data || [];
    console.log(`   ✅ 当前共有 ${existingTemplates.length} 个模板记录\n`);
  } catch (err) {
    console.error(`   ❌ 查询失败: ${err.message}`);
    process.exit(1);
  }

  // 2. 按 section 分组现有记录
  const existingBySection = {};
  for (const t of existingTemplates) {
    if (!existingBySection[t.section]) existingBySection[t.section] = [];
    existingBySection[t.section].push(t);
  }

  // 3. 检查每个 section
  const stats = { matched: 0, partial: 0, missing: 0 };

  for (const [section, info] of Object.entries(KNOWN_SECTIONS)) {
    const existing = existingBySection[section] || [];
    const expectedUrls = info.urls;
    const label = info.label;

    const matchedUrls = [];
    const unmatchedUrls = [...expectedUrls];

    for (const ex of existing) {
      const idx = unmatchedUrls.findIndex((u) => u === ex.filePath);
      if (idx !== -1) {
        matchedUrls.push(unmatchedUrls[idx]);
        unmatchedUrls.splice(idx, 1);
      }
    }

    if (matchedUrls.length === expectedUrls.length) {
      stats.matched++;
      console.log(`   ✅ [${section}] (${label}) — ${expectedUrls.length} 个模板全部存在`);
    } else if (existing.length > 0) {
      stats.partial++;
      console.log(`   ⚠️  [${section}] (${label}) — 已存在 ${matchedUrls.length}/${expectedUrls.length} 个`);
      for (const url of unmatchedUrls) {
        const name = extractFilename(url);
        if (apply) {
          try {
            await rpc('create_file_template', { section, file_path: url }, ['id']);
            console.log(`      ✅ 已创建: ${name}`);
          } catch (err) {
            console.error(`      ❌ 创建失败 [${name}]: ${err.message}`);
          }
        } else {
          console.log(`      🔵 待创建: ${name}`);
        }
      }
    } else {
      stats.missing++;
      console.log(`   ❌ [${section}] (${label}) — 无任何模板`);
      for (const url of expectedUrls) {
        const name = extractFilename(url);
        if (apply) {
          try {
            await rpc('create_file_template', { section, file_path: url }, ['id']);
            console.log(`      ✅ 已创建: ${name}`);
          } catch (err) {
            console.error(`      ❌ 创建失败 [${name}]: ${err.message}`);
          }
        } else {
          console.log(`      🔵 待创建: ${name}`);
        }
      }
    }
    console.log();
  }

  // 4. 检查数据库中是否有未知 section
  const knownSections = Object.keys(KNOWN_SECTIONS);
  const unknownSections = Object.keys(existingBySection).filter(
    (s) => !knownSections.includes(s)
  );
  if (unknownSections.length > 0) {
    console.log('⚠️  数据库中存在但未在 KNOWN_SECTIONS 中定义的 section:');
    for (const s of unknownSections) {
      for (const e of existingBySection[s]) {
        console.log(`   [${s}] ${e.filePath}`);
      }
    }
    console.log();
  }

  // 5. 汇总
  console.log('='.repeat(70));
  console.log('  汇总');
  console.log('='.repeat(70));
  console.log(`  完整匹配的 section:   ${stats.matched}`);
  console.log(`  部分缺失的 section:   ${stats.partial}`);
  console.log(`  完全缺失的 section:   ${stats.missing}`);

  if (!apply) {
    const totalNeeded = Object.entries(KNOWN_SECTIONS).reduce((sum, [section]) => {
      const existing = existingBySection[section] || [];
      return sum + Math.max(0, KNOWN_SECTIONS[section].urls.length - existing.length);
    }, 0);
    console.log(`\n  🔵 共需创建 ${totalNeeded} 个模板记录`);
    console.log('  🔵 使用 --apply 参数执行写入');
  } else {
    console.log('\n  🟢 写入完成');
  }
  console.log();
}

main().catch((err) => {
  console.error('脚本异常:', err);
  process.exit(1);
});
