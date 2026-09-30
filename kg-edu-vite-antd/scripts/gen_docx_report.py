#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成《智慧课程演示功能对照说明》docx 文档"""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

doc = Document()

# 中文字体
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(11)
style._element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')

def set_cn(run, size=None, bold=None, color=None):
    run.font.name = 'Calibri'
    run._element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')
    if size: run.font.size = Pt(size)
    if bold is not None: run.font.bold = bold
    if color: run.font.color.rgb = color

def heading(text, level=1):
    h = doc.add_heading(text, level=level)
    for r in h.runs:
        set_cn(r, size={0:22,1:16,2:13,3:12}.get(level,12), bold=True, color=RGBColor(0x0A,0x24,0x63))
    return h

def para(text, bold=False, size=11, color=None):
    p = doc.add_paragraph()
    r = p.add_run(text)
    set_cn(r, size=size, bold=bold, color=color)
    return p

def bullet(text, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    if bold_prefix:
        r = p.add_run(bold_prefix)
        set_cn(r, bold=True)
    r = p.add_run(text)
    set_cn(r)
    return p

def status_tag(text):
    color = {'已实现': RGBColor(0x1E,0x88,0x3A), '已实现（本次增强）': RGBColor(0xEF,0x6C,0x00),
             '本次开发': RGBColor(0x0A,0x24,0x63), '部分匹配': RGBColor(0xD3,0x9D,0x1F)}
    return color.get(text, RGBColor(0x33,0x33,0x33))

import os
SCREENSHOT_DIR = '/Users/bai/projects/kg-edu/kg-edu-vite-antd/docs/screenshots'

def add_screenshot(section_key):
    """按需求序号在对应小节末尾插入截图；找不到则保留文字占位。"""
    fname = IMAGE_MAP.get(section_key)
    if not fname:
        return
    path = os.path.join(SCREENSHOT_DIR, fname)
    if not os.path.exists(path):
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(path, width=Cm(16))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = cap.add_run(CAPTION_MAP.get(section_key, ''))
    set_cn(r, size=9, color=RGBColor(0x88,0x88,0x88))

# 需求序号 -> 截图文件名 / 图注
IMAGE_MAP = {
    '1': '1_AI语音合成.png',
    '2': '2_人脸抓拍.png',
    '3': '3_AI实践.png',
    '4': '11_考试管理.png',
    '7': '4_自定义表单.png',
    '10': '5_助教插件.png',
    '12': '6_学术追踪.png',
    '13': '7_数据智能.png',
    '14': '12_数据报表.png',
    '15': '12_数据报表.png',
    '11': '8_智慧门户.png',
    '9': '9_课程图谱.png',
    '6': '10_视频解析.png',
}
CAPTION_MAP = {
    '1': '图：AI 语音合成（听力题 / 口语测评题）',
    '2': '图：人脸识别与抓拍',
    '3': '图：AI 实践（6 类场景实时评估）',
    '4': '图：考试管理（智能组卷入口）',
    '7': '图：移动端自定义表单',
    '10': '图：AI 助教插件',
    '12': '图：AI 追踪（学术追踪）',
    '13': '图：AI 数据问答（数据智能）',
    '14': '图：AI 数据报告 / 数据报表（数据智能）',
    '15': '图：AI 数据报表（数据智能）',
    '11': '图：智慧门户',
    '9': '图：课程知识图谱',
    '6': '图：AI 章节视频解析',
}

# ============ 封面 ============
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('智慧课程演示功能对照说明'); set_cn(r, size=26, bold=True, color=RGBColor(0x0A,0x24,0x63))
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('—— 15 项演示功能与系统实现对照 · 缺失功能开发 ——'); set_cn(r, size=14, color=RGBColor(0x66,0x66,0x66))
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('文档生成日期：2026年'); set_cn(r, size=11, color=RGBColor(0x99,0x99,0x99))
doc.add_page_break()

# ============ 一、说明 ============
heading('一、文档说明', 1)
para('本文档对照智慧课程演示的 15 项功能需求，逐项核对系统的实现情况，分为三类：')
bullet('已实现：系统已具备该功能，给出具体菜单位置与操作路径，供演示时向用户展示。')
bullet('已实现（本次增强）：功能基础已具备，本次按需求补齐了缺失的子能力。')
bullet('本次开发：系统原本缺失、本次基于已有数据与 AI 能力新开发完成的功能。')
para('对于已实现但与需求存在个别差异的功能，文中以「差异说明」标注。菜单路径以「教师端」侧边栏导航为准。')

# ============ 二、总体对照表 ============
heading('二、总体功能对照表', 1)
rows = [
    ('序号','演示功能','实现状态','菜单位置 / 说明'),
    ('1','AI 语音合成（听力题）','本次开发','教师端 → 智慧课程演示 → AI 语音合成'),
    ('2','人脸识别与抓拍','已实现','教师端 → 教学资源 → 考试管理 → 人脸抓拍'),
    ('3','AI 实践（6 类场景）','已实现','教师端 → 智慧课程演示 → AI 实践'),
    ('4','AI 组卷与试卷分析','已实现','教师端 → 教学资源 → 考试管理（智能组卷 / 试卷分析）'),
    ('5','试卷自定义导出','已实现','教师端 → 考试管理 → 试卷导出 / 打印'),
    ('6','AI 章节视频解析','已实现','教师端 → 教学资源 → 视频（AI 解析）'),
    ('7','移动端自定义表单','已实现','教师端 → 智慧课程演示 → 自定义表单；学生端 → 数据表单'),
    ('8','审批：AI 填表 + AI 公式','已实现','自定义表单 / 数据表单'),
    ('9','课程章节转知识图谱','部分匹配','教师端 → 知识图谱 → 课程图谱'),
    ('10','AI 助教插件','已实现','教师端 → 智慧课程演示 → 助教插件'),
    ('11','智慧门户','已实现','首页 → /portal-showcase；管理端 → 门户配置'),
    ('12','AI 追踪（兴趣/学者/期刊）','已实现','教师端 → 智慧课程演示 → 学术追踪'),
    ('13','AI 数据问答','已实现','教师端 → 智慧课程演示 → 数据智能'),
    ('14','AI 数据报告','已实现（本次增强）','教师端 → 智慧课程演示 → 数据智能'),
    ('15','AI 数据报表','本次开发','教师端 → 智慧课程演示 → 数据智能'),
]
table = doc.add_table(rows=len(rows), cols=4)
table.style = 'Light Grid Accent 1'
table.alignment = WD_TABLE_ALIGNMENT.CENTER
widths = (Cm(1.2), Cm(5.2), Cm(2.6), Cm(7.5))
for i, row in enumerate(rows):
    for j, cell_text in enumerate(row):
        cell = table.cell(i, j)
        cell.width = widths[j]
        cp = cell.paragraphs[0]; cp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = cp.add_run(cell_text)
        set_cn(r, size=9.5, bold=(i==0))
        if i>0 and j==2:
            r.font.color.rgb = status_tag(cell_text)
doc.add_page_break()

# ============ 三、逐项说明 ============
heading('三、逐项功能对照说明', 1)

items = [
    {
        'no':'1','title':'AI 语音合成（听力题 / 口语测评题）','status':'本次开发',
        'impl':'后端已具备完整的 AI 语音合成服务（TtsService），支持多音色（男声/女声）、多语言（中文/英语/日语/西班牙语）、语速（0.5~2.0）、音量（0~100）及情感指令，合成音频自动落盘至资源库并返回公网 URL。',
        'dev':'本次在教师端新增「AI 语音合成」页面，补齐了前端演示与使用入口：输入文本 → 选择音色 → 设置语速/音量/语言/情感 → 一键合成并在线试听，音频链接提供「复制链接」按钮（隐藏原始长 URL）供听力题 / 口语测评题引用。',
        'menu':'教师端 → 智慧课程演示 → AI 语音合成（/teacher/dashboard/tts）',
        'diff':'原系统仅有后端能力、无前端使用界面；本次已开发完成并修复请求格式（voice 置于 input 内、rate/volume/format 参数）使合成正常，功能与需求一致。',
        'shot':'【截图】AI 语音合成页：文本输入、音色/语速/音量/语言/情感参数、合成试听与复制链接按钮。',
    },
    {
        'no':'2','title':'人脸识别与抓拍','status':'已实现',
        'impl':'教师端提供「人脸抓拍」演示：覆盖进入课程、视频起始、播放中、暂停再播放、视频结束等节点抓拍，支持 10 分钟定时抓拍与随机抓拍；识别失败可配置「记录并继续学习 / 不允许学习」两种处理模式，并展示抓拍记录与快照。',
        'menu':'教师端 → 教学资源 → 考试管理 → 人脸抓拍（/teacher/dashboard/face-check）',
        'diff':'演示采用摄像头呈现性检测 + 快照存证；真实 1:N 身份比对需对接人脸厂商 SDK（接口已预留 result/note 字段）。',
        'shot':'【截图】人脸抓拍页：实时画面、节点抓拍按钮、定时/随机策略配置、失败处理模式、抓拍记录列表。',
    },
    {
        'no':'3','title':'AI 实践（6 类场景实时评估）','status':'已实现',
        'impl':'教师端「AI 实践」提供 6 类场景：情景对话、上传作品、思维阶梯、思辨擂台、代码编辑、互动故事；支持 AI 实时对话、按场景配置角色/主题、AI 实时评估并生成评分报告。',
        'menu':'教师端 → 智慧课程演示 → AI 实践（/teacher/dashboard/ai-practice）',
        'diff':'上传作品场景为文本粘贴点评（非真实文件上传）；代码编辑为文本区粘贴审查（非真实 IDE）。',
        'shot':'【截图】AI 实践页：6 场景 Tab、角色设定、实时对话、AI 实时评估报告。',
    },
    {
        'no':'4','title':'AI 组卷与试卷分析','status':'已实现',
        'impl':'考试编辑内支持「智能组卷」：粘贴组卷大纲后一键填充题型/难度/知识点配置，预览组卷结果，可编辑修改，支持对单题「重新出题」。出卷后可进行「试卷分析」：题型统计分析、难易度统计分析（按题量与分数分布）、题目明细（题号/题干/题型/难易度/知识点/正确率（跨考试）/题目分数）。',
        'menu':'教师端 → 教学资源 → 考试管理 → 考试编辑（智能组卷/预览/单题重出）；试卷分析：考试管理 → 试卷统计（/teacher/dashboard/exam-statistics）',
        'diff':'功能与需求一致。',
        'shot':'【截图】智能组卷配置、组卷预览；试卷分析页：题型统计、难易度统计、题目明细表。',
    },
    {
        'no':'5','title':'试卷自定义导出','status':'已实现',
        'impl':'「试卷导出/打印」支持 A3、A4、B4 三种版式；模板配置包含密封线（位置可左/右）、考试承诺书（可编辑文字）、课程信息、学生信息（学院/班级/姓名/学号）；所见即所得纸张预览，打印即导出效果。',
        'menu':'教师端 → 考试管理 → 试卷详情 → 导出/打印（/teacher/dashboard/exam-print/:examId）',
        'diff':'功能与需求一致。',
        'shot':'【截图】试卷导出页：版式选择、密封线/承诺书/课程信息/学生信息配置、纸张预览。',
    },
    {
        'no':'6','title':'AI 章节视频解析','status':'已实现',
        'impl':'教师端「视频」页对章节视频发起 AI 解析，生成视频摘要、分段总结、思维导图、知识点词云，并按知识点在视频对应时间点自动打点；学生观看时可点击打点/分段「定位/观看」跳到对应时间点。',
        'menu':'教师端 → 教学资源 → 视频（/teacher/dashboard/video）→ 选中视频 → AI 解析抽屉',
        'diff':'功能与需求一致。',
        'shot':'【截图】视频解析抽屉：摘要、分段总结、思维导图、知识点词云、时间打点与定位观看。',
    },
    {
        'no':'7','title':'移动端自定义表单','status':'已实现',
        'impl':'教师端「自定义表单」支持创建含单行/多行文本、数字、日期、单选、多选、下拉框、图片上传、附件上传、计算字段的表单；可设置字段必填；支持分配到学生（含截止时间）并配置「学生提交-教师审核」审批流。学生端「数据表单」/「我的表单」可填写并跟踪审批状态。',
        'menu':'教师端 → 智慧课程演示 → 自定义表单（/teacher/dashboard/custom-form）；学生端 → 数据表单（/dashboard/data-forms）',
        'diff':'功能与需求一致（含图片/附件上传、必填、审批流）。',
        'shot':'【截图】表单模板列表/新建器（含元素与必填）、分配记录、学生提交审核；学生端填写页。',
    },
    {
        'no':'8','title':'审批：AI 填表 + AI 公式','status':'已实现',
        'impl':'学生端填写表单时支持「AI 填表」：输入自然语言描述（如请假事由）自动识别并回填至对应字段；教师端表单编辑器支持「AI 公式生成」：描述计算目标即可生成计算字段表达式，并可验算。适用于请假、报销、申请、报修、信息采集等场景。',
        'menu':'AI 填表：学生端 → 数据表单 → 填写页；AI 公式：教师端 → 自定义表单 → 新建/编辑表单 → 计算字段',
        'diff':'AI 填表目前支持自然语言文本回填；图片/附件识别已预留接口（imageUrl），真实 OCR 需接入外部 MCP 服务。',
        'shot':'【截图】学生端 AI 填表（自然语言回填）；教师端 AI 生成公式及验算。',
    },
    {
        'no':'9','title':'课程章节转知识图谱','status':'部分匹配',
        'impl':'教师端「知识图谱」按课程生成知识图谱，支持树形图谱、环形图谱、知识关系图谱、问题图谱四种视图，图谱节点关联知识点及其教学资源。',
        'menu':'教师端 → 知识图谱 → 课程图谱（/teacher/dashboard/graph-course）',
        'diff':'需求为「选择任意章节一键转化生成图谱并联动章节视频/文档」；当前为课程级知识图谱（含多种视图与资源关联），并非严格意义上的「章节→图谱一键转化」。如需完全对齐，可在后续将转化粒度细化到章节级，并一键关联该章节的视频/文档资源。',
        'shot':'【截图】课程图谱：课程选择、四种图谱视图、节点资源关联。',
    },
    {
        'no':'10','title':'AI 助教插件','status':'已实现',
        'impl':'教师端「助教插件」支持：大模型兜底回复开关、联网搜索开关；维护单个智能体的应用池、自建插件与 MCP 服务；内置插件覆盖移动端通知推送、富文本/Word 导出、生成图表、地图工具、发送邮件、Excel 导出、PPT 生成、任务流外部历史消息、网页解析、知识点双率统计、共享课程搜索等；MCP 工具目录覆盖网页解析、联网搜索、图片 OCR、天气预报、办公写作、教育教学、工作汇报、文案助手。',
        'menu':'教师端 → 智慧课程演示 → 助教插件（/teacher/dashboard/assistant-plugins）',
        'diff':'MCP 中图片 OCR、天气等通过应用池注册外部 MCP（填 endpoint）接入；前两项（网页解析、联网搜索）已在本页演示运行。',
        'shot':'【截图】助教插件页：大模型开关、插件试运行控制台、应用池/自建插件/MCP 服务列表、MCP 工具目录。',
    },
    {
        'no':'11','title':'智慧门户','status':'已实现',
        'impl':'提供门户展示页，覆盖图标列表、图文列表、轮播图、多图列表、搜索、文本列表、图表、表格、搜索列表、文本、图片、按钮、视频、搜索条、天气、日期、插件、IP、地图等 18 种基础模块；管理端「门户配置」支持门户模块与页面配置，可生成网站应用页面。',
        'menu':'门户演示：/portal-showcase；管理端 → 门户配置（/admin/dashboard/portal-config）',
        'diff':'门户演示页为全模块预览；管理端门户配置支持真实模块/页面配置。',
        'shot':'【截图】智慧门户演示页：搜索条/日期/天气/IP、轮播图、图标列表、图文列表、图表、表格、图片/按钮、视频、地图等模块。',
    },
    {
        'no':'12','title':'AI 追踪（兴趣 / 学者 / 期刊）','status':'已实现',
        'impl':'教师端「学术追踪」支持：输入研究兴趣 → 科学导航推荐相关方向并支持点击「追踪」关注最新文章；学者追踪基于科研成果构建「学者数字分身」，支持智能对话把握其研究方向与学术观点；期刊追踪由 AI 提炼文章要点、对比观点、识别技术趋势。',
        'menu':'教师端 → 智慧课程演示 → 学术追踪（/teacher/dashboard/research-track）',
        'diff':'功能与需求一致。',
        'shot':'【截图】学术追踪页：研究兴趣搜索/推荐/追踪、学者数字分身对话、期刊提炼分析、我的追踪列表。',
    },
    {
        'no':'13','title':'AI 数据问答','status':'已实现',
        'impl':'教师端「数据智能」通过 AI 智能体进行教学数据问答，如「各院系资源上传量」「课程签到率」等，查询结果以表格 + 统计图呈现，并附 AI 解读；数据总览提供 KPI 卡片。',
        'menu':'教师端 → 智慧课程演示 → 数据智能（/teacher/dashboard/data-insight）',
        'diff':'功能与需求一致。',
        'shot':'【截图】数据智能页：数据总览 KPI、AI 数据问答（表格+图表+AI 解读）。',
    },
    {
        'no':'14','title':'AI 数据报告','status':'已实现（本次增强）',
        'impl':'自定义分析主题后由 AI 生成包含文本解读、统计图、数据表的专业分析报告，支持导出 PDF。本次增强：支持对 AI 生成的大纲进行调整（增删改章节）后重新生成，并可将报告保存为模板复用。',
        'menu':'教师端 → 智慧课程演示 → 数据智能（/teacher/dashboard/data-insight）→ AI 数据报告',
        'diff':'已补齐需求中的「大纲生成并允许调整」「模板保存」能力。',
        'shot':'【截图】数据智能 → AI 数据报告：主题输入、生成报告（文本/图表/数据表）、调整大纲、保存模板、导出 PDF。',
    },
    {
        'no':'15','title':'AI 数据报表','status':'本次开发',
        'impl':'本次在「数据智能」新增「AI 数据报表」：选择数据集（资源上传量、签到、课堂活动、课程、作业、考试、知识点等 7 类），自定义统计时间范围（近 N 天）、导出字段、排序方式，生成报表表格，支持导出 CSV，并可将报表配置保存为模板、应用或删除模板，实现报表生成的灵活性与复用性。对应「各院系资源上传量统计报表」演示。',
        'menu':'教师端 → 智慧课程演示 → 数据智能（/teacher/dashboard/data-insight）→ AI 数据报表',
        'diff':'本次新开发完成，功能与需求一致。',
        'shot':'【截图】数据智能 → AI 数据报表：数据集/时间范围/导出字段/排序配置、报表表格、导出 CSV、模板保存与应用。',
    },
]

for it in items:
    heading(f"{it['no']}. {it['title']}", 2)
    p = doc.add_paragraph()
    r = p.add_run('实现状态：'); set_cn(r, bold=True)
    r = p.add_run(it['status']); set_cn(r, bold=True, color=status_tag(it['status']))
    if it.get('status') in ('已实现','部分匹配','已实现（本次增强）'):
        para('实现情况：' + it.get('impl',''), size=11)
    if it.get('status') == '本次开发':
        para('开发内容：' + it.get('dev',''), size=11)
    para('菜单位置：' + it.get('menu',''), size=11)
    para(it.get('diff',''), size=11)
    para(it.get('shot',''), size=11, color=RGBColor(0x99,0x99,0x99))
    add_screenshot(it['no'])
    doc.add_paragraph()

# ============ 四、缺失功能开发总结 ============
heading('四、本次开发工作总结', 1)
para('对照 15 项需求，系统绝大多数功能已具备。本次主要完成了以下 3 处开发/增强：')
bullet('AI 语音合成（需求 1）：', '补齐后端已有 TTS 服务的前端使用界面，教师端新增「AI 语音合成」页，支持多音色/多语言/语速/音量/情感指令合成并试听，用于听力题与口语测评题。')
bullet('AI 数据报表（需求 15）：', '在「数据智能」新增报表功能，支持数据集选择、时间范围、导出字段、排序、导出 CSV 与模板保存/复用。')
bullet('AI 数据报告增强（需求 14）：', '补齐全提纲调整与模板保存能力。')
para('对于「课程章节转知识图谱」（需求 9），当前以课程级知识图谱呈现，如演示需严格对齐「章节一键转化 + 资源联动」，建议后续将转化粒度细化到章节级。')

out = '/Users/bai/projects/kg-edu/kg-edu-vite-antd/智慧课程演示功能对照说明.docx'
doc.save(out)
print('saved:', out)