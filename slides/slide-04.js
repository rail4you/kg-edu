// slide-04.js — Content: 社区卫生服务的定义与意义
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'content',
  index: 4,
  title: '社区卫生服务的定义与意义'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Title
  slide.addText("社区卫生服务的定义与意义", {
    x: 0.6, y: 0.35, w: 8, h: 0.6,
    fontSize: 30, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });

  // Title underline
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 0.95, w: 1.5, h: 0.04,
    fill: { color: theme.accent }
  });

  // Definition card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.3, w: 4.2, h: 2.0,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "006d77", blur: 6, offset: 2, angle: 135, opacity: 0.08 }
  });
  // Card accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.3, w: 0.06, h: 2.0,
    fill: { color: theme.primary }
  });

  slide.addText("定 义", {
    x: 0.9, y: 1.4, w: 3, h: 0.4,
    fontSize: 16, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });
  slide.addText("社区卫生服务是以社区为基础，以居民健康为中心，由社区卫生服务机构提供的综合性卫生服务，涵盖预防、保健、医疗、康复、健康教育及计划生育技术指导等六大功能。", {
    x: 0.9, y: 1.85, w: 3.7, h: 1.2,
    fontSize: 12, fontFace: "Microsoft YaHei",
    color: "4a5568", lineSpacingMultiple: 1.4
  });

  // Significance card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 5.2, y: 1.3, w: 4.2, h: 2.0,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "006d77", blur: 6, offset: 2, angle: 135, opacity: 0.08 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 5.2, y: 1.3, w: 0.06, h: 2.0,
    fill: { color: theme.accent }
  });

  slide.addText("核心意义", {
    x: 5.5, y: 1.4, w: 3, h: 0.4,
    fontSize: 16, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });
  slide.addText([
    { text: "▸ 实现医疗资源下沉，缓解看病难问题", options: { breakLine: true } },
    { text: "▸ 推动以治疗为中心向以健康为中心转变", options: { breakLine: true } },
    { text: "▸ 构建分级诊疗制度的重要基础", options: { breakLine: true } },
    { text: "▸ 促进基本公共卫生服务均等化", options: {} }
  ], {
    x: 5.5, y: 1.85, w: 3.7, h: 1.2,
    fontSize: 12, fontFace: "Microsoft YaHei",
    color: "4a5568", lineSpacingMultiple: 1.5
  });

  // Bottom section - 3 key metrics
  const metrics = [
    { num: "98.0%", label: "社区卫生服务\n覆盖率", color: theme.primary },
    { num: "6 大", label: "核心服务\n功能模块", color: "83c5be" },
    { num: "1.5 亿", label: "年度服务\n居民人次", color: theme.accent }
  ];

  metrics.forEach((m, i) => {
    const xPos = 0.6 + i * 3.1;
    // Card
    slide.addShape(pres.shapes.RECTANGLE, {
      x: xPos, y: 3.7, w: 2.8, h: 1.5,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "006d77", blur: 4, offset: 1, angle: 135, opacity: 0.06 }
    });
    // Top accent
    slide.addShape(pres.shapes.RECTANGLE, {
      x: xPos, y: 3.7, w: 2.8, h: 0.05,
      fill: { color: m.color }
    });
    // Number
    slide.addText(m.num, {
      x: xPos, y: 3.85, w: 2.8, h: 0.6,
      fontSize: 28, fontFace: "Georgia",
      color: m.color, bold: true,
      align: "center", valign: "middle"
    });
    // Label
    slide.addText(m.label, {
      x: xPos, y: 4.5, w: 2.8, h: 0.6,
      fontSize: 11, fontFace: "Microsoft YaHei",
      color: "4a5568", align: "center", valign: "top"
    });
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("4", {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fontSize: 12, fontFace: "Georgia",
    color: "FFFFFF", bold: true,
    align: "center", valign: "middle"
  });

  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  const theme = { primary: "006d77", secondary: "83c5be", accent: "e29578", light: "ffddd2", bg: "edf6f9" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-04-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
