// slide-01.js — Cover Page: 社区与公共卫生支持体系
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'cover',
  index: 1,
  title: '社区与公共卫生支持体系'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();

  // Full background - soft teal
  slide.background = { color: "006d77" };

  // Decorative large circle (top-right)
  slide.addShape(pres.shapes.OVAL, {
    x: 7.0, y: -1.2, w: 4.5, h: 4.5,
    fill: { color: "83c5be", transparency: 60 }
  });

  // Decorative small circle (bottom-left)
  slide.addShape(pres.shapes.OVAL, {
    x: -0.8, y: 3.8, w: 2.5, h: 2.5,
    fill: { color: "ffddd2", transparency: 50 }
  });

  // Decorative accent line
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 1.8, w: 1.0, h: 0.06,
    fill: { color: "ffddd2" }
  });

  // Main Title
  slide.addText("社区与公共卫生\n支持体系", {
    x: 0.8, y: 2.0, w: 6.0, h: 2.0,
    fontSize: 44, fontFace: "Microsoft YaHei",
    color: "FFFFFF", bold: true, align: "left",
    valign: "top", lineSpacingMultiple: 1.2
  });

  // Subtitle
  slide.addText("Community & Public Health Support System", {
    x: 0.8, y: 4.1, w: 6.0, h: 0.5,
    fontSize: 18, fontFace: "Georgia",
    color: "edf6f9", align: "left"
  });

  // Decorative bottom bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.2, w: 10, h: 0.425,
    fill: { color: "83c5be", transparency: 40 }
  });

  // Bottom info
  slide.addText("构建健康社区 · 守护公共安全", {
    x: 0.8, y: 5.25, w: 5, h: 0.35,
    fontSize: 12, fontFace: "Microsoft YaHei",
    color: "edf6f9", align: "left", valign: "middle"
  });

  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  const theme = { primary: "006d77", secondary: "83c5be", accent: "e29578", light: "ffddd2", bg: "edf6f9" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-01-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
