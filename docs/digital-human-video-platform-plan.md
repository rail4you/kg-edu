# 数字人视频处理技术方案

> 目标：在现有「数字人视频生成」核心功能（图片 + 音频 → wan2.2-s2v 对口型视频）基础上，扩展为完整的**数字人演播/视频演示平台**，覆盖竞赛验收项 3.6 全部要求：镜头脚本、PPT/TXT 文稿导入、广播级抠像、多格式导出（MP4/MOV/TS/MKV、MPEG-2/MPEG-4/H264/H265、1~100Mbps 码率）。

---

## 1. 总体架构

```
┌────────────────────────────── 前端（React + antd） ─────────────────────────────┐
│  数字人演播台：                                                        │
│    Tab1 视频生成（图片+音频 → 数字人视频）           ← 已实现              │
│    Tab2 任务管理（Oban 异步任务进度/预览/下载）       ← 已实现              │
│    Tab3 镜头脚本（无限添加镜头，TXT 分段导入 / PPT 一键导入）              │
│    Tab4 广播级抠像（蓝/绿/白/黑/红/自定义色 + 4参数可调）                 │
│    Tab5 导出设置（格式/编码/码率/帧率）                                  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ /api/digital-human/*
┌────────────────────────────────────▼────────────────────────────────────┐
│                      Phoenix 后端（Elixir）                             │
│  DigitalHumanController（任务 CRUD）          ← 已实现                    │
│  DigitalHumanWorker（Oban，DashScope 轮询）   ← 已实现                    │
│  VideoProcessor（ffmpeg 封装：抠像/合成/转码/拼接/抽帧）   ← 本期新增       │
│  ScriptProcessor（TXT/PPT 解析 → 镜头脚本）              ← 本期新增       │
│  TTSClient（CosyVoice 文字转语音）                     ← 本期新增       │
│  SceneComposer（文字背景 + 人像抠像合成）               ← 本期新增       │
└──────────────────────────────────────────────────────────────────────────┘
```

**核心链路（一键出片）**：

```
PPT/TXT 导入
   │  ScriptProcessor：逐页解析（页面文字/备注/分页）
   ▼
镜头脚本列表（无限添加、可拖拽排序、每镜头 = 一页内容）
   │  每镜头：
   │    ① TTSClient：文字 → 语音（CosyVoice，wav）
   │    ② SceneComposer：文字渲染为背景 + 人像抠像 PNG 合成 → 场景图
   │    ③ wan2.2-s2v：场景图 + 语音 → 该镜头视频片段
   ▼
每镜头视频片段（mp4）
   │  VideoProcessor.concat：多段拼接 → 完整视频
   ▼
导出（VideoProcessor.transcode）：
   格式 MP4/MOV/TS/MKV × 编码 MPEG-2/MPEG-4/H264/H265 × 码率 1~100Mbps × 帧率
```

---

## 2. 视频格式处理（ffmpeg）

### 2.1 封装模块

新增 `KgEdu.Agent.VideoProcessor`，封装 ffmpeg/ffprobe：

| 函数 | 用途 | 核心命令 |
|------|------|----------|
| `probe/1` | 读取时长/分辨率/编码/码率/帧率 | `ffprobe -print_format json -show_format -show_streams` |
| `chroma_key/2` | 一键抠像（图片） | `ffmpeg -i in -vf "chromakey=...:similarity:blend" -c:v png out.png` |
| `compose/3` | 背景图 + 人像 PNG 合成场景图 | `ffmpeg -i bg -i person -filter_complex "[1]format=rgba[fg];[0][fg]overlay=..." out.jpg` |
| `concat/2` | 多段视频拼接 | `ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4` |
| `transcode/2` | 格式/编码/码率/帧率转换 | `ffmpeg -i in -c:v <codec> -b:v <bitrate> -r <fps> -c:a aac out.<fmt>` |
| `extract_frame/2` | 视频抽帧（PPT 页面作为画面） | `ffmpeg -i in -ss 0 -frames:v 1 out.jpg` |

### 2.2 导出参数映射

| 目标格式 | 容器 | 支持的编码 | ffmpeg 参数 |
|----------|------|-----------|-------------|
| MP4 | mp4 | H264 (`libx264`) / H265 (`libx265`) | `-f mp4` |
| MOV | mov | H264 / H265 / MPEG-4 (`mpeg4`) | `-f mov` |
| TS | mpegts | H264 / H265 / MPEG-2 (`mpeg2video`) | `-f mpegts` |
| MKV | matroska | 全部 | `-f matroska` |

- **码率**：`-b:v 1M ~ 100M`（`-minrate/-maxrate/-bufsize` 可选，竞赛项 4 要求 1~100Mbps 可调）
- **帧率**：`-r 24/25/30/60`（可自定义）
- **音频**：统一 `-c:a aac -b:a 128k`
- **H265 兼容性**：`-tag:v hvc1`（保证浏览器/播放器兼容）
- **清晰度**：默认保持原分辨率；导出时可选 `-vf scale=...` 缩放档位

### 2.3 当前阶段实现策略

1. **本期（前端先行）**：前端完成导出设置 UI（格式/编码/码率/帧率下拉与滑块），**MP4 + 原始编码 = 直接导出**（即现有生成的 mp4，无需转码）；其余格式/编码/码率选择在前端可选，后端 transcode 端点返回「开发中」占位，待 ffmpeg 端点就绪后无缝启用。
2. **下期**：`VideoProcessor.transcode` 接入 Oban worker（转码同样耗时，走异步任务），任务表扩展 `export_format/export_codec/bitrate/fps` 字段。

---

## 3. 广播级一键抠像

### 3.1 需求映射（竞赛项 3）

> 除支持蓝绿幕外，还可对白色、黑色、红色等自定义颜色抠像，且界面不少于 4 个参数可自定义调整。

### 3.2 技术选型

用 ffmpeg `chromakey` 滤镜（YUV 色彩空间，广播级更稳）+ `colorkey`（RGB）双实现：

```
chromakey=color=<color>:similarity=<0.00-1.00>:blend=<0.00-1.00>:yuv=<0/1>
colorkey=<color>:<similarity>:<blend>
```

- 颜色支持：green/blue/white/black/red + 任意 hex 颜色（`0xRRGGBB`）
- 输出：透明通道 PNG（`-c:v png -vf "chromakey..."`），供后续合成

### 3.3 可调参数（≥4）

| # | 参数 | 默认 | 说明 |
|---|------|------|------|
| 1 | 抠像颜色 | 绿色 | 绿/蓝/白/黑/红/自定义色板 |
| 2 | 相似度 similarity | 0.4 | 与目标色的相似容差（越高抠得越多） |
| 3 | 混合度 blend | 0.1 | 边缘混合/羽化程度 |
| 4 | YUV 模式 yuv | 1 | 0=RGB(colorkey) 1=YUV(chromakey) |
| 5 | 边缘去除 despill | 0 | 0/1 去溢色（绿色反射到人脸上的绿边） |

（前 4 个为界面必选可调参数，despill 为增强项）

### 3.4 处理流程

```
上传图片 → POST /api/digital-human/chroma-key
  → 后端下载图片到临时目录
  → VideoProcessor.chroma_key(img, %{color, similarity, blend, yuv})
  → 透明 PNG 上传 OSS → 返回 resultUrl（前端可预览/合成）
```

### 3.5 合成场景图

```
背景（PPT 页面截图 / 纯色 / 文字渲染图）+ 人像透明 PNG
→ overlay 合成 → 场景图 jpg → 作为 wan2.2-s2v 的 image_url
```

---

## 4. 镜头脚本（TXT / PPT 导入）

### 4.1 需求映射（竞赛项 2）

> 支持无限添加镜头脚本，可分段导入 txt 文稿内容，也可一键导入 PPT，页面作为画面使用，备注内容作为脚本分段。

### 4.2 脚本模型

```
CameraScript {
  id, title,
  scenes: [                    # 无限添加镜头
    { id, pageText,           # 页面文字（作为背景画面）
      scriptText,             # 台词脚本（TTS 输入）
      bgColor / bgImageUrl,   # 背景（PPT 页面 / 纯色 / 图片）
      personImageUrl,         # 人像图
      voice,                  # TTS 音色
      duration_estimate }
  ]
}
```

### 4.3 TXT 分段导入

- 前端 `Upload` 读取 txt → 按 `\n\n`（空行）或 `---` 分隔为段落 → 每段生成一个镜头脚本
- 每段文字同时作为「台词」输入 TTS；默认背景为纯色渐变

### 4.4 PPT 一键导入

| 步骤 | 说明 |
|------|------|
| 上传 .pptx | 前端 `Upload` → 后端 `POST /api/digital-human/scripts/import-pptx` |
| 后端解析 | **页面文字**作为画面背景；**备注（notes）文字**作为台词分段（竞赛项 2 要求） |
| 逐页生成 | 每页 = 一个镜头：PPT 页面渲染为背景图 + 备注文字 TTS |
| 渲染页面 | 用 LibreOffice `soffice --headless --convert-to png/pdf` 将每页转为图片；或用 pdf → png |

- `.pptx` 解包（zip）读取 `ppt/slides/slideN.xml` 的文本 + `ppt/notesSlides/notesSlideN.xml` 的备注
- 依赖：`soffice`（LibreOffice）或 Elixir `pptx` 解析库（解 XML 取文本；页面渲染建议 soffice）

### 4.5 每镜头生成视频（复用现有链路）

```
镜头脚本 → ① TTS(台词) → wav
        → ② 合成场景图（背景 + 抠像人像）
        → ③ POST /api/digital-human/tasks (imageUrl=场景图, audioUrl=语音)
        → ④ Oban worker → wan2.2-s2v → 该镜头视频
多个镜头视频 → VideoProcessor.concat → 完整视频
```

---

## 5. 文字转语音（CosyVoice TTS）

### 5.1 API（官方，华北2-北京地域）

```bash
curl -X POST https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cosyvoice-v3-flash",
    "input": {"text": "我家的后面有一个很大的花园。", "voice": "longanyang", "format": "wav", "sample_rate": 24000}
  }'
```

- 返回：音频二进制（wav）或 `oss://` URL（大文本）
- 音色：`longanyang`（龙颜仰，男）等 cosyvoice 系列音色，可在脚本中按镜头指定
- 语速/音量：`input.text` 前缀控制或 `parameters`（见官方文档）

### 5.2 集成方式

- 新增 `KgEdu.Agent.TTSClient.synthesize(text, voice, opts)` → `{:ok, url | binary}`
- Oban worker 内调用（TTS 有 QPS 限制，走队列）；输出音频上传 OSS 后作为 wan2.2-s2v 的 `audio_url`
- 音频长度限制：wan2.2-s2v 要求音频 <20s → 长台词自动按句切分为多镜头

---

## 6. 后端接口设计

```
POST /api/digital-human/tasks              ← 已实现（扩展参数）
GET  /api/digital-human/tasks              ← 已实现
GET  /api/digital-human/tasks/:id          ← 已实现
DELETE /api/digital-human/tasks/:id        ← 已实现
POST /api/digital-human/chroma-key         # 抠像：{ imageUrl, color, similarity, blend, yuv }
POST /api/digital-human/compose            # 合成场景图：{ bgUrl|bgColor|text, personUrl }
POST /api/digital-human/scripts/import-txt # TXT 分段 → 脚本
POST /api/digital-human/scripts/import-pptx# PPT 导入 → 脚本（每页+备注）
POST /api/digital-human/scripts            # 保存镜头脚本
GET  /api/digital-human/scripts/:id        # 读取脚本
POST /api/digital-human/scripts/:id/render # 一键渲染：逐镜头生成→拼接→导出
POST /api/digital-human/export             # 导出：{ videoUrl, format, codec, bitrate, fps }
```

### 任务表扩展（DigitalHumanTask）

新增字段（下期随导出/渲染落地）：
`script_id`（关联镜头脚本）、`export_format`（mp4/mov/ts/mkv）、`export_codec`（h264/h265/mpeg4/mpeg2）、`bitrate_mbps`、`fps`、`segment_count`。

---

## 7. 开发计划

| 阶段 | 内容 | 状态 |
|------|------|------|
| P0 | 数字人核心：图片+音频→视频（Oban+轮询） | ✅ 已上线 |
| P1 | 前端导出设置 UI（格式/编码/码率/帧率，MP4 直出 + 其余占位） | 本期 |
| P1 | 图片抠像（chroma-key，4 参数可调）后端 + 前端 tab | 本期 |
| P1 | 镜头脚本 tab（TXT 导入可用；PPT 导入占位） | 本期 |
| P2 | VideoProcessor.transcode 接入异步导出（多格式/编码/码率） | 下期 |
| P2 | PPT 解析（soffice 渲染页面 + 备注读取） | 下期 |
| P2 | CosyVoice TTS 接入脚本渲染链路 | 下期 |
| P3 | 一键渲染：多镜头 → 逐段生成 → concat 拼接 → 导出 | 下期 |

---

## 8. 验收对照（竞赛项 3.6）

| 竞赛项 | 方案落点 |
|--------|----------|
| (1) 平台控制器架构图/产品设计图 | 本文档 §1 架构图 + 前端页面（架构/设计说明页） |
| (2) 无限镜头脚本 / TXT 分段导入 / PPT 一键导入（页面为画面、备注为脚本） | §4 镜头脚本模型 + import-txt/import-pptx |
| (3) 广播级一键抠像：蓝绿幕 + 白/黑/红/自定义色，≥4 参数 | §3 chromakey/colorkey 双实现 + 5 参数 UI |
| (4) 多格式导出 MP4/MOV/TS/MKV + MPEG-2/MPEG-4/H264/H265 + 1~100Mbps | §2 ffmpeg transcode 参数映射 + 导出 UI |
| (5) 核心设计逻辑 + 关键操作场景视频 | 各 tab 操作视频（录屏导出）+ 文档 |
