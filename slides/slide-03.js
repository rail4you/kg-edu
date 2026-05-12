// slide-03.js — Section Divider: 社区卫生服务概述
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'section',
  index: 3,
  title: '社区卫生服务概述'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();

  // Left color block
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 3.5, h: 5.625,
    fill: { color: theme.primary }
  });

  // Large number
  slide.addText("01", {
    x: 0.5, y: 1.2, w: 2.5, h: 1.8,
    fontSize: 96, fontFace: "Georgia",
    color: "83c5be", bold: true,
    align: "center", valign: "middle"
  });

  // Decorative line on left block
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 1.2, y: 3.2, w: 1.1, h: 0.04,
    fill: { color: "ffddd2" }
  });

  // Section title (right side)
  slide.addText("社区卫生服务概述", {
    x: 4.0, y: 1.8, w: 5.5, h: 1.0,
    fontSize: 38, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });

  // Subtitle
  slide.addText("定义 · 意义 · 发展历程", {
    x: 4.0, y: 2.9, w: 5.5, h: 0.5,
    fontSize: 18, fontFace: "Microsoft YaHei",
    color: "83c5be"
  });

  // Brief intro
  slide.addText("社区卫生服务是公共卫生体系的基石，是实现全民健康覆盖的重要途径。", {
    x: 4.0, y: 3.7, w: 5.0, h: 0.8,
    fontSize: 13, fontFace: "Microsoft YaHei",
    color: theme.secondary
  });

  // Right background decoration
  slide.background = { color: theme.bg };

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("3", {
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
  pres.writeFile({ fileName: "slide-03-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
