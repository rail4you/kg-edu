// slide-05.js — Content: 核心服务内容 (icon + text rows layout)
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'content',
  index: 5,
  title: '社区卫生六大核心服务'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Title
  slide.addText("社区卫生六大核心服务", {
    x: 0.6, y: 0.35, w: 8, h: 0.6,
    fontSize: 30, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 0.95, w: 1.5, h: 0.04,
    fill: { color: theme.accent }
  });

  // 6 service cards in 2x3 grid
  const services = [
    { title: "预防服务", desc: "传染病防控、免疫接种、慢病管理", icon: "🛡", color: "006d77" },
    { title: "保健服务", desc: "妇女儿童保健、老年人健康管理", icon: "❤", color: "83c5be" },
    { title: "医疗服务", desc: "常见病诊治、双向转诊、家庭医生", icon: "⚕", color: "e29578" },
    { title: "康复服务", desc: "社区康复指导、功能训练评估", icon: "♿", color: "006d77" },
    { title: "健康教育", desc: "健康知识普及、生活方式干预", icon: "📖", color: "83c5be" },
    { title: "计生指导", desc: "计划生育技术咨询与指导服务", icon: "👨‍👩‍👧", color: "e29578" }
  ];

  services.forEach((svc, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const xPos = 0.6 + col * 3.1;
    const yPos = 1.25 + row * 2.05;

    // Card background
    slide.addShape(pres.shapes.RECTANGLE, {
      x: xPos, y: yPos, w: 2.8, h: 1.8,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "006d77", blur: 4, offset: 1, angle: 135, opacity: 0.06 }
    });

    // Top color bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x: xPos, y: yPos, w: 2.8, h: 0.06,
      fill: { color: svc.color }
    });

    // Icon circle
    slide.addShape(pres.shapes.OVAL, {
      x: xPos + 0.2, y: yPos + 0.25, w: 0.5, h: 0.5,
      fill: { color: svc.color, transparency: 85 }
    });

    // Icon text
    slide.addText(svc.icon, {
      x: xPos + 0.2, y: yPos + 0.25, w: 0.5, h: 0.5,
      fontSize: 18, align: "center", valign: "middle"
    });

    // Title
    slide.addText(svc.title, {
      x: xPos + 0.85, y: yPos + 0.22, w: 1.7, h: 0.4,
      fontSize: 16, fontFace: "Microsoft YaHei",
      color: theme.primary, bold: true, valign: "middle"
    });

    // Description
    slide.addText(svc.desc, {
      x: xPos + 0.2, y: yPos + 0.9, w: 2.4, h: 0.7,
      fontSize: 11, fontFace: "Microsoft YaHei",
      color: "4a5568", lineSpacingMultiple: 1.4
    });
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("5", {
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
  pres.writeFile({ fileName: "slide-05-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
