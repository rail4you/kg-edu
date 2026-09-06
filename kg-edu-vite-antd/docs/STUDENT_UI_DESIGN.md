# 学生端 UI 设计规范文档

## 目录
1. [设计概述](#1-设计概述)
2. [配色方案](#2-配色方案)
3. [Coursera 设计分析](#3-coursera-设计分析)
4. [导航栏设计规范](#4-导航栏设计规范)
5. [页面布局规范](#5-页面布局规范)
6. [组件规范](#6-组件规范)
7. [学生端页面清单与改造计划](#7-学生端页面清单与改造计划)
8. [实施步骤](#8-实施步骤)

---

## 1. 设计概述

### 1.1 设计目标
- 采用 Coursera 风格的现代专业 UI 设计
- 统一学生端所有页面的视觉风格
- 提升用户体验和交互一致性

### 1.2 设计原则
- **简洁专业**: 减少视觉噪音，聚焦核心内容
- **一致性**: 统一的配色、排版和交互模式
- **响应式**: 适配不同屏幕尺寸
- **可访问性**: 确保良好的可读性和可操作性

### 1.3 适用范围
- 学生端所有页面（不含 `/dashboard` 路由）
- 首页 `/`
- 课程详情页 `/dashboard/front`
- 学生布局页面 `/dashboard/*`

---

## 2. 配色方案

### 2.1 核心色板

| 用途 | 颜色名称 | 色值 | 使用场景 |
|------|----------|------|----------|
| 主色 | Coursera Blue | `#0056D2` | 主要按钮、链接、选中状态 |
| 主色悬停 | Deep Blue | `#0043A8` | 按钮悬停状态 |
| 成功色 | Success Green | `#18842C` | 成功状态、完成标识 |
| 警告色 | Warning Orange | `#E65100` | 警告、重要提示 |
| 错误色 | Error Red | `#D32F2F` | 错误状态 |

### 2.2 中性色板

| 用途 | 颜色名称 | 色值 | 使用场景 |
|------|----------|------|----------|
| 背景 | Light Gray | `#F8F9FA` | 页面主背景 |
| 卡片背景 | White | `#FFFFFF` | 卡片、容器背景 |
| 文字主色 | Near Black | `#1F1F1F` | 标题、重要文字 |
| 文字次色 | Medium Gray | `#5E5E5E` | 描述文字、次要信息 |
| 边框 | Light Border | `#E0E0E0` | 卡片边框、分割线 |
| 禁用 | Disabled Gray | `#BDBDBD` | 禁用状态 |

### 2.3 难度标签色

| 级别 | 颜色 | 色值 |
|------|------|------|
| 初级 | 绿色 | `#18842C` |
| 中级 | 蓝色 | `#0056D2` |
| 高级 | 橙色 | `#E65100` |

### 2.4 CSS 变量定义

```css
:root {
  /* 主色调 */
  --theme-primary: #0056D2;
  --theme-primary-hover: #0043A8;
  --theme-success: #18842C;
  --theme-warning: #E65100;
  --theme-error: #D32F2F;

  /* 背景色 */
  --theme-background: #F8F9FA;
  --theme-card-bg: #FFFFFF;

  /* 文字色 */
  --theme-text-primary: #1F1F1F;
  --theme-text-secondary: #5E5E5E;
  --theme-text-disabled: #BDBDBD;

  /* 边框色 */
  --theme-border: #E0E0E0;

  /* 评级颜色 */
  --theme-star: #F5C518;
}
```

---

## 3. Coursera 设计分析

### 3.1 整体设计风格

| 特征 | 描述 |
|------|------|
| 设计系统 | CDS (Coursera Design System) |
| 字体 | Source Sans Pro, OpenSans, Merriweather |
| 布局 | 基于 flexbox 的模块化系统 |
| 响应式断点 | 600px, 1024px, 1440px, 1920px |

### 3.2 导航栏设计

**特点**:
- 简洁的顶部导航，高度固定
- 搜索框位于导航栏中心或显著位置
- 响应式宽度: 280px (移动端) → 440px (桌面端)
- 搜索框圆角 4px，带阴影

**移动端适配**:
- 搜索框显示为全宽
- 带放大镜图标按钮

### 3.3 课程卡片设计

**特点**:
- 简洁边框设计 (1px solid #E0E0E0)
- 圆角 8px
- 悬停时边框变蓝，添加阴影
- 封面图 16:9 比例

**悬停效果**:
```css
.rc-Card {
  transition: all .45s cubic-bezier(.23,1,.32,1)
}
.rc-Card[data-interactive=true]:hover {
  box-shadow: 0 3px 10px rgba(0,0,0,0.15)
}
```

### 3.4 页面布局结构

**Hero 区域**:
- 简洁白色背景或渐变背景
- 大标题 + 副标题
- 搜索框位于下方

**内容区域**:
- 白色卡片容器
- 适当的内边距 (16px - 24px)
- 卡片间距 24px

### 3.5 可借鉴的设计模式

1. **搜索框**: 圆角 4px，左侧图标，右侧按钮
2. **卡片**: 简洁边框，悬停变蓝
3. **筛选栏**: 横向标签 + 下拉选择器
4. **评分显示**: 星级 + 数字 + 评价人数
5. **空白状态**: 简洁插图 + 提示文字

---

## 4. 导航栏设计规范

### 4.1 学生端导航结构

**当前菜单项** (需要保留):
- 学习中心 (首页)
- 邮件问答
- 学习推荐
- 教师团队
- 课程概述
- 课程概览
- 认知目标
- 教学资源
- 考试系统
- 实验系统
- 使用手册

**下拉菜单**:
- 图谱: 图谱总览、课程知识体系、知识节点、图谱层级
- 课程内容: 课程相册、课程视频、课程总结

### 4.2 顶部导航栏样式

```css
/* 导航栏 */
height: 64px;
background: #FFFFFF;
border-bottom: 1px solid #E0E0E0;
padding: 0 32px;
position: sticky;
top: 0;
z-index: 1000;

/* Logo */
font-size: 28px;
color: #0056D2;

/* 标题 */
font-weight: 600;
color: #1F1F1F;

/* 菜单项 */
color: #5E5E5E;
hover: #1F1F1F;
active: #0056D2 + 底部边框
```

### 4.3 侧边菜单 (如需要)

- 宽度: 240px (可折叠)
- 背景: #FFFFFF
- 菜单项高度: 48px
- 选中状态: 左侧蓝色边框 + 浅蓝背景

---

## 5. 页面布局规范

### 5.1 通用页面结构

```
+--------------------------------------------------+
|  顶部导航栏 (64px height)                        |
+--------------------------------------------------+
|                                                  |
|  页面标题区域 (可选)                              |
|  - 页面标题                                     |
|  - 面包屑导航                                   |
|                                                  |
+--------------------------------------------------+
|                                                  |
|  主内容区域                                      |
|  - 卡片式布局                                   |
|  - 网格系统                                     |
|                                                  |
+--------------------------------------------------+
```

### 5.2 内容容器

```css
/* 通用容器 */
max-width: 1400px;
margin: 0 auto;
padding: 0 24px;

/* 移动端 */
@media (max-width: 768px) {
  padding: 0 16px;
}
```

### 5.3 卡片样式

```css
/* 基础卡片 */
background: #FFFFFF;
border: 1px solid #E0E0E0;
border-radius: 8px;
padding: 16px / 24px;

/* 悬停效果 */
:hover {
  border-color: #0056D2;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 可点击卡片 */
cursor: pointer;
transition: all 0.2s ease;
```

### 5.4 间距系统

| 用途 | 间距 |
|------|------|
| 页面边距 | 24px (桌面) / 16px (移动) |
| 卡片间距 | 24px |
| 卡片内边距 | 16px / 24px |
| 元素间距 | 8px / 12px / 16px |
| 区块间距 | 24px / 32px |

---

## 6. 组件规范

### 6.1 按钮

**主要按钮**:
```css
background: #0056D2;
color: #FFFFFF;
border: none;
border-radius: 4px;
padding: 8px 16px;
font-weight: 500;

:hover {
  background: #0043A8;
}
```

**次要按钮**:
```css
background: #FFFFFF;
color: #0056D2;
border: 1px solid #0056D2;
border-radius: 4px;

:hover {
  background: #F8F9FA;
}
```

### 6.2 搜索框

```css
/* 容器 */
display: flex;
border: 1px solid #E0E0E0;
border-radius: 4px;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

/* 输入框 */
flex: 1;
border: none;
padding: 14px 16px;
font-size: 16px;

/* 搜索按钮 */
background: #0056D2;
color: #FFFFFF;
border-radius: 0;
padding: 0 32px;
```

### 6.3 筛选标签

```css
/* 未选中 */
color: #5E5E5E;
border-bottom: 3px solid transparent;

/* 选中 */
color: #0056D2;
font-weight: 600;
border-bottom: 3px solid #0056D2;

/* 悬停 */
color: #1F1F1F;
```

### 6.4 课程卡片

```css
/* 封面图 */
height: 160px;  /* 16:9 比例 */
background-size: cover;
background-position: center;

/* 标题 */
font-size: 15px;
font-weight: 500;
line-height: 1.4;
min-height: 42px;  /* 2行 */

/* 机构/描述 */
font-size: 13px;
color: #5E5E5E;

/* 评分 */
font-size: 12px;
```

### 6.5 标签/徽章

```css
/* 难度标签 */
border-radius: 4px;
font-size: 11px;
font-weight: 500;
padding: 2px 8px;

/* 状态标签 */
border-radius: 12px;
font-size: 12px;
```

### 6.6 树状视图 (知识图谱)

参考现有 ECharts 实现，保持一致性:

```css
/* 节点样式 */
节点根据类型区分颜色:
- 学科: #0056D2 (蓝色)
- 知识单元: #18842C (绿色)
- 知识点: #E65100 (橙色)

/* 连接线 */
color: #E0E0E0;

/* 悬停效果 */
显示详细信息卡片
```

### 6.7 表格

```css
/* 表头 */
background: #F8F9FA;
font-weight: 600;
color: #1F1F1F;

/* 行 */
border-bottom: 1px solid #E0E0E0;

/* 悬停 */
background: #F8F9FA;
```

### 6.8 表单

```css
/* 输入框 */
border: 1px solid #E0E0E0;
border-radius: 4px;
padding: 8px 12px;

:focus {
  border-color: #0056D2;
  box-shadow: 0 0 0 2px rgba(0, 86, 210, 0.1);
}
```

---

## 7. 学生端页面清单与改造计划

### 7.1 需要保留的页面

| 路由 | 页面名称 | 优先级 | 备注 |
|------|----------|--------|------|
| `/` | 首页 (课程列表) | 高 | 已完成 Coursera 风格 |
| `/dashboard/front` | 课程详情页 | 高 | 已完成 Coursera 风格 |
| `/dashboard` | 学生布局入口 | - | 需要重新设计导航 |
| `/dashboard/overview` | 课程概述 | 中 | 需要改造 |
| `/dashboard/intro` | 课程概览 | 中 | 需要改造 |
| `/dashboard/knowledge-cognitive-goals` | 认知目标 | 中 | 需要改造 |
| `/dashboard/resource` | 教学资源 | 中 | 需要改造 |
| `/dashboard/exam-courses` | 考试系统 | 中 | 需要改造 |
| `/dashboard/exam-list` | 考试列表 | 中 | 需要改造 |
| `/dashboard/exam-taking` | 考试答题 | 中 | 需要改造 |
| `/dashboard/experiment-courses` | 实验系统 | 中 | 需要改造 |
| `/dashboard/experiment-detail` | 实验详情 | 中 | 需要改造 |
| `/dashboard/graph` | 图谱总览 | 中 | 需要改造 |
| `/dashboard/graph-category` | 课程知识体系 | 中 | 需要改造 |
| `/dashboard/knowledge` | 知识节点 | 中 | 需要改造 |
| `/dashboard/graph-layer` | 图谱层级 | 中 | 需要改造 |
| `/dashboard/teacher` | 教师团队 | 低 | 需要改造 |
| `/dashboard/email-qa` | 邮件问答 | 低 | 需要改造 |
| `/dashboard/learning-recommendations` | 学习推荐 | 低 | 需要改造 |
| `/dashboard/course-info` | 课程信息 | 低 | 需要改造 |
| `/dashboard/course-summary` | 课程总结 | 低 | 需要改造 |
| `/dashboard/course-album` | 课程相册 | 低 | 需要改造 |
| `/dashboard/course-video` | 课程视频 | 低 | 需要改造 |
| `/dashboard/chat` | 聊天 | 低 | 需要改造 |
| `/dashboard/manual` | 使用手册 | 低 | 需要改造 |
| `/dashboard/check-in/:tenantSchema/:token` | 签到 | 低 | 需要改造 |

### 7.2 需要删除的页面/功能

- ~~`/dashboard` (学习中心首页)~~ - **已删除**，自动跳转到 `/dashboard/overview` (课程概述)

### 7.3 改造优先级

**第一阶段 (高优先级)**:
1. 统一导航栏样式 - 已完成
2. 统一首页 (`/`) 和课程详情页 (`/dashboard/front`) - 已完成
3. 统一布局容器和间距 - 已完成
4. 通用 CSS 组件样式 - 已完成

**第二阶段 (中优先级)**:
1. 课程概述页面 - 已完成
2. 知识图谱相关页面 - 已完成
3. 考试/实验系统页面 - 已完成

### 8.5 全局主题配置

已在 `main.tsx` 中通过 ConfigProvider 全局配置 Ant Design 主题：

```typescript
<ConfigProvider
  theme={{
    token: {
      colorPrimary: "#0056D2",
      colorSuccess: "#18842C",
      colorWarning: "#E65100",
      colorError: "#D32F2F",
      colorBgLayout: "#F8F9FA",
      colorBgContainer: "#FFFFFF",
      colorBorder: "#E0E0E0",
      colorText: "#1F1F1F",
      colorTextSecondary: "#5E5E5E",
      borderRadius: 8,
    },
    components: {
      Button: { borderRadius: 4 },
      Card: { borderRadius: 8 },
      Input: { borderRadius: 4 },
      Select: { borderRadius: 4 },
    },
  }}
>
```

所有 Ant Design 组件现在会自动使用统一的主题色。

**第三阶段 (低优先级)**:
1. 其他功能页面
2. 细节优化

---

## 8. 实施步骤

### 8.1 步骤一: 更新通用样式

1. 完善 `src/styles/coursera-theme.css`
   - 添加所有组件样式
   - 添加响应式样式
   - 添加动画效果

### 8.2 步骤二: 改造导航栏

1. 更新 `src/layouts/student-layout.tsx`
   - 使用新的配色方案
   - 优化菜单样式
   - 保持功能不变

### 8.3 步骤三: 逐页面改造

按优先级顺序改造各页面:
1. 统一卡片样式
2. 统一按钮样式
3. 统一表单样式
4. 统一表格样式

### 8.4 步骤四: 测试与优化

1. 响应式测试
2. 交互测试
3. 性能优化

---

## 附录: 常用样式类名

| 类名 | 用途 |
|------|------|
| `.theme-layout` | 页面布局容器 |
| `.theme-header` | 顶部导航栏 |
| `.theme-hero` | Hero 区域 |
| `.theme-container` | 内容容器 |
| `.theme-card` | 通用卡片 |
| `.theme-card-hoverable` | 可悬停卡片 |
| `.theme-course-card` | 课程卡片 |
| `.theme-filter-bar` | 筛选栏 |
| `.theme-search-box` | 搜索框 |
| `.theme-btn-primary` | 主要按钮 |
| `.theme-loading` | 加载状态 |
| `.theme-empty` | 空状态 |
| `.theme-grid-4` | 4列网格 |
| `.theme-grid-3` | 3列网格 |
| `.theme-grid-2` | 2列网格 |

---

*文档版本: 1.0*
*最后更新: 2026-02-25*
