// slide-10.js — Content: 多方协同支持机制 (Comparison layout)
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'content',
  index: 10,
  title: '多方协同支持机制'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Title
  slide.addText("多方协同支持机制", {
    x: 0.6, y: 0.35, w: 8, h: 0.6,
    fontSize: 30, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 0.95, w: 1.5, h: 0.04,
    fill: { color: theme.accent }
  });

  // Center circle - 社区居民
  slide.addShape(pres.shapes.OVAL, {
    x: 4.0, y: 2.2, w: 2.0, h: 2.0,
    fill: { color: theme.primary }
  });
  slide.addText("社区\n居民健康", {
    x: 4.0, y: 2.2, w: 2.0, h: 2.0,
    fontSize: 16, fontFace: "Microsoft YaHei",
    color: "FFFFFF", bold: true,
    align: "center", valign: "middle"
  });

  // Surrounding 4 stakeholders
  const stakeholders = [
    { title: "政府机构", desc: "政策制定、资金保障、考核监督", x: 1.0, y: 1.2, color: "83c5be" },
    { title: "医疗机构", desc: "技术支持、双向转诊、人才培养", x: 7.0, y: 1.2, color: "e29578" },
    { title: "社会组织", desc: "志愿服务、健康宣教、社区动员", x: 1.0, y: 3.5, color: "e29578" },
    { title: "企业力量", desc: "技术赋能、资金捐助、健康产品", x: 7.0, y: 3.5, color: "83c5be" }
  ];

  stakeholders.forEach((s) => {
    // Connector line
    const centerX = 5.0, centerY = 3.2;
    const boxCenterX = s.x + 1.0, boxCenterY = s.y + 0.45;
    
    slide.addShape(pres.shapes.LINE, {
      x: Math.min(centerX, boxCenterX),
      y: Math.min(centerY, boxCenterY),
      w: Math.abs(boxCenterX - centerX),
      h: Math.abs(boxCenterY - centerY),
      line: { color: "83c5be", width: 1.5, dashType: "dash" }
    });

    // Stakeholder card
    slide.addShape(pres.shapes.RECTANGLE, {
      x: s.x, y: s.y, w: 2.0, h: 1.1,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "006d77", blur: 4, offset: 1, angle: 135, opacity: 0.06 }
    });

    // Color dot
    slide.addShape(pres.shapes.OVAL, {
      x: s.x + 0.15, y: s.y + 0.15, w: 0.25, h: 0.25,
      fill: { color: s.color }
    });

    // Title
    slide.addText(s.title, {
      x: s.x + 0.5, y: s.y + 0.1, w: 1.4, h: 0.35,
      fontSize: 13, fontFace: "Microsoft YaHei",
      color: theme.primary, bold: true, valign: "middle"
    });

    // Description
    slide.addText(s.desc, {
      x: s.x + 0.15, y: s.y + 0.5, w: 1.7, h: 0.5,
      fontSize: 9, fontFace: "Microsoft YaHei",
      color: "4a5568", lineSpacingMultiple: 1.3
    });
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("10", {
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
  pres.writeFile({ fileName: "slide-10-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
