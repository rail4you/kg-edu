// slide-07.js — Content: 公共卫生服务体系框架 (Timeline/Process layout)
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'content',
  index: 7,
  title: '公共卫生服务体系框架'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Title
  slide.addText("公共卫生服务体系框架", {
    x: 0.6, y: 0.35, w: 8, h: 0.6,
    fontSize: 30, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 0.95, w: 1.5, h: 0.04,
    fill: { color: theme.accent }
  });

  // Top row - 3 pillars
  const pillars = [
    {
      title: "疾病预防控制",
      items: ["传染病监测预警", "慢性病综合防控", "免疫规划实施", "健康危害因素监测"],
      color: "006d77"
    },
    {
      title: "卫生监督执法",
      items: ["公共卫生监督", "医疗卫生监督", "食品安全监测", "环境卫生监管"],
      color: "83c5be"
    },
    {
      title: "妇幼保健服务",
      items: ["孕产期保健", "儿童健康管理", "出生缺陷防控", "生殖健康服务"],
      color: "e29578"
    }
  ];

  pillars.forEach((p, i) => {
    const xPos = 0.6 + i * 3.1;

    // Card
    slide.addShape(pres.shapes.RECTANGLE, {
      x: xPos, y: 1.25, w: 2.8, h: 2.5,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "006d77", blur: 4, offset: 1, angle: 135, opacity: 0.06 }
    });

    // Top bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x: xPos, y: 1.25, w: 2.8, h: 0.45,
      fill: { color: p.color }
    });

    // Pillar title
    slide.addText(p.title, {
      x: xPos, y: 1.25, w: 2.8, h: 0.45,
      fontSize: 14, fontFace: "Microsoft YaHei",
      color: "FFFFFF", bold: true,
      align: "center", valign: "middle"
    });

    // Items
    const itemTexts = p.items.map((item, idx) => ({
      text: item,
      options: idx < p.items.length - 1 ? { bullet: true, breakLine: true } : { bullet: true }
    }));
    slide.addText(itemTexts, {
      x: xPos + 0.25, y: 1.85, w: 2.3, h: 1.7,
      fontSize: 11, fontFace: "Microsoft YaHei",
      color: "4a5568", lineSpacingMultiple: 1.5
    });
  });

  // Bottom section - governance framework
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 4.05, w: 8.8, h: 1.2,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "006d77", blur: 4, offset: 1, angle: 135, opacity: 0.06 }
  });

  slide.addText("治理体系", {
    x: 0.9, y: 4.1, w: 1.5, h: 0.35,
    fontSize: 14, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });

  // 4 connected boxes
  const govItems = ["政府主导", "部门协作", "社会参与", "法制保障"];
  const arrowPositions = [];
  govItems.forEach((item, i) => {
    const xPos = 0.9 + i * 2.15;

    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: xPos, y: 4.55, w: 1.6, h: 0.5,
      fill: { color: i === 0 ? theme.primary : "83c5be" },
      rectRadius: 0.08
    });
    slide.addText(item, {
      x: xPos, y: 4.55, w: 1.6, h: 0.5,
      fontSize: 12, fontFace: "Microsoft YaHei",
      color: "FFFFFF", bold: true,
      align: "center", valign: "middle"
    });

    // Arrow between boxes
    if (i < govItems.length - 1) {
      slide.addText("→", {
        x: xPos + 1.6, y: 4.55, w: 0.55, h: 0.5,
        fontSize: 16, color: theme.accent,
        align: "center", valign: "middle"
      });
    }
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("7", {
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
  pres.writeFile({ fileName: "slide-07-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
