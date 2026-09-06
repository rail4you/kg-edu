# 首页样式规范 (Homepage Style Guide)

## 品牌名称
- **智慧教学系统** (专业教育平台)

## 配色方案 (专业简洁风格)

### 主色调
```typescript
const colors = {
  primary: "#0066CC",        // 蓝色 - 主色调
  primaryHover: "#0052A3",    // 深蓝色悬停
  primaryLight: "#3399FF",    // 亮蓝色
  accent: "#FF6600",          // 橙色强调
  success: "#52C41A",         // 成功/已选课
  background: "#FFFFFF",       // 页面背景 (白色)
  cardBg: "#FFFFFF",           // 卡片背景
  textPrimary: "#1F1F1F",      // 主要文字
  textSecondary: "#666666",    // 次要文字
  border: "#E6E6E6",           // 边框
};
```

### 渐变背景
- **Header**: `linear-gradient(135deg, #0066CC 0%, #3399FF 100%)`
- **Hero 叠加**: `linear-gradient(135deg, rgba(0,102,204,0.9) 0%, rgba(51,153,255,0.8) 100%)`
- **Footer**: `#1F1F1F`

## Header 导航栏

### 样式规格
- 高度: 56px (+ 48px tab栏)
- 背景: 渐变蓝色 (primary → primaryLight)
- 内边距: 0 40px
- 阴影: `0 2px 12px rgba(0,102,204,0.15)`
- 定位: sticky top: 0, z-index: 1000

### Logo 区域
- 图片高度: 40px
- 文字: 智慧教学系统
- 字号: 20px
- 字重: 700
- 颜色: #FFFFFF

### Tab 导航
- 高度: 48px
- 背景: rgba(255,255,255,0.08)
- 字号: 13px
- 圆角: 16px
- 选中背景: rgba(255,255,255,0.25)
- 选中字重: 600
- 分隔线: rgba(255,255,255,0.15) 每4个tab

### 搜索框
- 宽度: 280px
- 圆角: 20px
- 背景: rgba(255,255,255,0.2)
- 边框: 1px solid rgba(255,255,255,0.3)

### 用户区域
- AI按钮: 36x36 圆形, rgba(255,255,255,0.2) 背景
- 通知铃铛: 白色图标 #fff
- 用户卡片: 圆角20px, 白色半透明背景

## Hero 区域

### 样式规格
- 背景: 图片 + 渐变叠加
- 内边距: 100px 24px 80px

### 主标题
- 字号: 52px
- 字重: 800
- 颜色: #FFFFFF

### 按钮
- 主按钮: accent (#FF6600) 背景

## 课程卡片

### 布局
- 栅格: xs={24} sm={12} md={8} lg={6} xl={6}
- 圆角: 12px
- 边框: 1px solid #E6E6E6
- 阴影: 0 2px 8px rgba(0,0,0,0.04)

## Footer 页脚

### 样式规格
- 背景: #1F1F1F
- 内边距: 48px 24px 24px

## 动画效果

### 过渡效果
- 卡片悬停: all 0.3s ease
- Tab切换: all 0.2s ease