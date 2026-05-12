// slide-11.js — Content: 信息化与创新
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'content',
  index: 11,
  title: '信息化建设与创新应用'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Title
  slide.addText("信息化建设与创新应用", {
    x: 0.6, y: 0.35, w: 8, h: 0.6,
    fontSize: 30, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 0.95, w: 1.5, h: 0.04,
    fill: { color: theme.accent }
  });

  // Left column - 4 innovation items (timeline style)
  const innovations = [
    { title: "电子健康档案", desc: "居民全生命周期健康数据管理，实现信息互通共享" },
    { title: "远程医疗服务", desc: "连接上级医院专家资源，优质医疗资源下沉社区" },
    { title: "AI辅助诊断", desc: "人工智能辅助疾病筛查与风险评估，提升诊疗效率" },
    { title: "智能健康管理", desc: "可穿戴设备实时监测，个性化健康干预方案推送" }
  ];

  innovations.forEach((item, i) => {
    const yPos = 1.3 + i * 1.0;

    // Timeline dot
    slide.addShape(pres.shapes.OVAL, {
      x: 0.75, y: yPos + 0.12, w: 0.3, h: 0.3,
      fill: { color: theme.primary }
    });

    // Connecting line
    if (i < innovations.length - 1) {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0.88, y: yPos + 0.42, w: 0.03, h: 0.58,
        fill: { color: "83c5be", transparency: 40 }
      });
    }

    // Title
    slide.addText(item.title, {
      x: 1.3, y: yPos, w: 3.5, h: 0.35,
      fontSize: 15, fontFace: "Microsoft YaHei",
      color: theme.primary, bold: true
    });

    // Description
    slide.addText(item.desc, {
      x: 1.3, y: yPos + 0.38, w: 3.5, h: 0.35,
      fontSize: 11, fontFace: "Microsoft YaHei",
      color: "4a5568"
    });
  });

  // Right column - Pie chart showing digital health adoption
  slide.addChart(pres.charts.DOUGHNUT, [{
    name: "信息化覆盖率",
    labels: ["电子健康档案", "远程医疗", "AI应用", "其他"],
    values: [85, 45, 30, 15]
  }], {
    x: 5.5, y: 1.3, w: 3.8, h: 3.0,
    showTitle: true,
    title: "社区卫生信息化覆盖情况",
    titleColor: "006d77",
    titleFontSize: 11,
    titleFontFace: "Microsoft YaHei",
    chartColors: ["006d77", "83c5be", "e29578", "ffddd2"],
    showPercent: true,
    dataLabelColor: "2d3748",
    dataLabelFontSize: 10,
    showLegend: true,
    legendPos: "b",
    legendColor: "4a5568",
    legendFontSize: 9,
    legendFontFace: "Microsoft YaHei"
  });

  // Bottom insight bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 4.7, w: 8.8, h: 0.6,
    fill: { color: theme.primary }
  });
  slide.addText('💡 核心洞察：信息化建设正从"工具辅助"向"智慧赋能"转型，全面提升社区卫生服务效能', {
    x: 0.8, y: 4.7, w: 8.4, h: 0.6,
    fontSize: 12, fontFace: "Microsoft YaHei",
    color: "FFFFFF", valign: "middle"
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("11", {
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
  pres.writeFile({ fileName: "slide-11-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
