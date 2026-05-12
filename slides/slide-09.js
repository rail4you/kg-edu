// slide-09.js — Section Divider: 社区支持策略与机制
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'section',
  index: 9,
  title: '社区支持策略与机制'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Large diagonal-ish color block (right side)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 6.5, y: 0, w: 3.5, h: 5.625,
    fill: { color: theme.primary }
  });

  // Section number on colored block
  slide.addText("03", {
    x: 6.8, y: 1.0, w: 2.8, h: 1.5,
    fontSize: 80, fontFace: "Georgia",
    color: "83c5be", bold: true,
    align: "center", valign: "middle"
  });

  // Decorative line on colored block
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 7.3, y: 2.6, w: 1.8, h: 0.04,
    fill: { color: "ffddd2" }
  });

  // Section title (left side)
  slide.addText("社区支持策略\n与机制", {
    x: 0.8, y: 1.5, w: 5.2, h: 1.5,
    fontSize: 38, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true,
    lineSpacingMultiple: 1.2
  });

  // Subtitle
  slide.addText("多方协同 · 资源整合 · 信息化建设", {
    x: 0.8, y: 3.2, w: 5.2, h: 0.5,
    fontSize: 16, fontFace: "Microsoft YaHei",
    color: "83c5be"
  });

  // Brief intro
  slide.addText("构建政府主导、多部门协作、全社会参与的社区卫生支持体系，推动健康治理现代化。", {
    x: 0.8, y: 3.9, w: 4.8, h: 0.8,
    fontSize: 12, fontFace: "Microsoft YaHei",
    color: "4a5568", lineSpacingMultiple: 1.4
  });

  // Decorative circle
  slide.addShape(pres.shapes.OVAL, {
    x: -0.5, y: -0.3, w: 1.8, h: 1.8,
    fill: { color: "ffddd2", transparency: 70 }
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("9", {
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
  pres.writeFile({ fileName: "slide-09-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
