// slide-02.js — Table of Contents
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'toc',
  index: 2,
  title: '目录'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Left accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color: theme.primary }
  });

  // Page title
  slide.addText("目 录", {
    x: 0.6, y: 0.4, w: 3, h: 0.7,
    fontSize: 36, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });

  // Underline
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.1, w: 1.2, h: 0.05,
    fill: { color: theme.accent }
  });

  const sections = [
    { num: "01", title: "社区卫生服务概述", desc: "定义、意义与发展历程" },
    { num: "02", title: "公共卫生体系构建", desc: "服务体系框架与核心功能" },
    { num: "03", title: "社区支持策略与机制", desc: "多方协同与资源整合" },
    { num: "04", title: "未来展望与总结", desc: "信息化建设与发展趋势" }
  ];

  sections.forEach((sec, i) => {
    const yPos = 1.55 + i * 0.95;

    // Number circle
    slide.addShape(pres.shapes.OVAL, {
      x: 0.8, y: yPos + 0.05, w: 0.55, h: 0.55,
      fill: { color: theme.primary }
    });
    slide.addText(sec.num, {
      x: 0.8, y: yPos + 0.05, w: 0.55, h: 0.55,
      fontSize: 16, fontFace: "Georgia",
      color: "FFFFFF", bold: true,
      align: "center", valign: "middle"
    });

    // Section title
    slide.addText(sec.title, {
      x: 1.6, y: yPos, w: 5, h: 0.35,
      fontSize: 20, fontFace: "Microsoft YaHei",
      color: theme.primary, bold: true
    });

    // Section description
    slide.addText(sec.desc, {
      x: 1.6, y: yPos + 0.38, w: 5, h: 0.3,
      fontSize: 13, fontFace: "Microsoft YaHei",
      color: "83c5be"
    });

    // Connecting line
    if (i < sections.length - 1) {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 1.05, y: yPos + 0.65, w: 0.02, h: 0.3,
        fill: { color: "83c5be", transparency: 50 }
      });
    }
  });

  // Right decorative shape
  slide.addShape(pres.shapes.OVAL, {
    x: 7.8, y: 0.5, w: 3.0, h: 3.0,
    fill: { color: "83c5be", transparency: 85 }
  });
  slide.addShape(pres.shapes.OVAL, {
    x: 8.5, y: 3.0, w: 2.0, h: 2.0,
    fill: { color: "ffddd2", transparency: 80 }
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("2", {
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
  pres.writeFile({ fileName: "slide-02-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
