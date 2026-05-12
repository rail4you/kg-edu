// slide-12.js — Summary / Closing Page
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'summary',
  index: 12,
  title: '总结与展望'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();

  // Background
  slide.background = { color: theme.primary };

  // Decorative circles
  slide.addShape(pres.shapes.OVAL, {
    x: -1.5, y: -1, w: 4, h: 4,
    fill: { color: "83c5be", transparency: 70 }
  });
  slide.addShape(pres.shapes.OVAL, {
    x: 8, y: 3, w: 3, h: 3,
    fill: { color: "ffddd2", transparency: 70 }
  });

  // Title
  slide.addText("总结与展望", {
    x: 0.8, y: 0.5, w: 8, h: 0.8,
    fontSize: 38, fontFace: "Microsoft YaHei",
    color: "FFFFFF", bold: true
  });

  // Decorative line
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 1.3, w: 1.5, h: 0.04,
    fill: { color: "ffddd2" }
  });

  // Key takeaways - 4 items in 2x2 grid
  const takeaways = [
    { num: "01", text: "社区卫生服务是公共卫生体系的基石，覆盖预防、保健、医疗、康复、健康教育及计生六大领域" },
    { num: "02", text: "公共卫生体系由疾病防控、卫生监督、妇幼保健三大支柱构成，政府主导、多方参与" },
    { num: "03", text: "建立政府、医疗机构、社会组织、企业四方协同机制，以社区居民健康为核心目标" },
    { num: "04", text: "推进信息化与智慧赋能，实现从\"以治病为中心\"向\"以健康为中心\"的根本转变" }
  ];

  takeaways.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xPos = 0.8 + col * 4.5;
    const yPos = 1.7 + row * 1.5;

    // Card background
    slide.addShape(pres.shapes.RECTANGLE, {
      x: xPos, y: yPos, w: 4.1, h: 1.2,
      fill: { color: "FFFFFF", transparency: 85 }
    });

    // Number
    slide.addText(t.num, {
      x: xPos + 0.15, y: yPos + 0.1, w: 0.5, h: 0.4,
      fontSize: 22, fontFace: "Georgia",
      color: "ffddd2", bold: true
    });

    // Text
    slide.addText(t.text, {
      x: xPos + 0.15, y: yPos + 0.5, w: 3.8, h: 0.6,
      fontSize: 11, fontFace: "Microsoft YaHei",
      color: "FFFFFF", lineSpacingMultiple: 1.4
    });
  });

  // Bottom tagline
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 2.5, y: 4.9, w: 5.0, h: 0.4,
    fill: { color: "e29578" },
    rectRadius: 0.2
  });
  slide.addText("建设健康社区  ·  守护公共安全  ·  共筑美好未来", {
    x: 2.5, y: 4.9, w: 5.0, h: 0.4,
    fontSize: 13, fontFace: "Microsoft YaHei",
    color: "FFFFFF", bold: true,
    align: "center", valign: "middle"
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: "e29578" }
  });
  slide.addText("12", {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fontSize: 11, fontFace: "Georgia",
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
  pres.writeFile({ fileName: "slide-12-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
