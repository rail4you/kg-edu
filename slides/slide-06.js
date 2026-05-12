// slide-06.js — Section Divider: 公共卫生体系构建
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'section',
  index: 6,
  title: '公共卫生体系构建'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();

  // Full background
  slide.background = { color: theme.primary };

  // Large decorative number
  slide.addText("02", {
    x: 0.5, y: 0.5, w: 9, h: 3.5,
    fontSize: 120, fontFace: "Georgia",
    color: "83c5be", transparency: 70,
    align: "center", valign: "middle", bold: true
  });

  // Horizontal line
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 3.5, y: 2.5, w: 3.0, h: 0.04,
    fill: { color: "ffddd2" }
  });

  // Section title
  slide.addText("公共卫生体系构建", {
    x: 1.0, y: 2.8, w: 8.0, h: 1.0,
    fontSize: 42, fontFace: "Microsoft YaHei",
    color: "FFFFFF", bold: true, align: "center"
  });

  // Subtitle
  slide.addText("服务体系框架 · 核心功能 · 运行机制", {
    x: 1.0, y: 3.9, w: 8.0, h: 0.5,
    fontSize: 18, fontFace: "Microsoft YaHei",
    color: "ffddd2", align: "center"
  });

  // Decorative circles
  slide.addShape(pres.shapes.OVAL, {
    x: -1, y: -0.5, w: 2.5, h: 2.5,
    fill: { color: "83c5be", transparency: 70 }
  });
  slide.addShape(pres.shapes.OVAL, {
    x: 8.2, y: 3.8, w: 2.5, h: 2.5,
    fill: { color: "ffddd2", transparency: 70 }
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: "e29578" }
  });
  slide.addText("6", {
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
  pres.writeFile({ fileName: "slide-06-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
