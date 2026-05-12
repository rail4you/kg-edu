// slide-08.js — Content: 数据展示 (Data Visualization with chart)
const pptxgen = require("pptxgenjs");

const slideConfig = {
  type: 'content',
  index: 8,
  title: '社区卫生服务关键数据'
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Title
  slide.addText("社区卫生服务关键数据", {
    x: 0.6, y: 0.35, w: 8, h: 0.6,
    fontSize: 30, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 0.95, w: 1.5, h: 0.04,
    fill: { color: theme.accent }
  });

  // Bar Chart - 社区卫生服务机构数量增长趋势
  slide.addChart(pres.charts.BAR, [{
    name: "机构数量（万家）",
    labels: ["2019", "2020", "2021", "2022", "2023"],
    values: [3.4, 3.5, 3.6, 3.7, 3.8]
  }], {
    x: 0.6, y: 1.2, w: 4.8, h: 3.3,
    barDir: "col",
    chartColors: ["006d77"],
    showTitle: true,
    title: "社区卫生服务机构数量增长",
    titleColor: "006d77",
    titleFontSize: 12,
    titleFontFace: "Microsoft YaHei",
    catAxisLabelColor: "4a5568",
    catAxisLabelFontSize: 10,
    valAxisLabelColor: "4a5568",
    valAxisLabelFontSize: 10,
    valGridLine: { color: "e2e8f0", size: 0.5 },
    catGridLine: { style: "none" },
    showValue: true,
    dataLabelPosition: "outEnd",
    dataLabelColor: "006d77",
    dataLabelFontSize: 10,
    showLegend: false,
    chartArea: { fill: { color: "FFFFFF" }, roundedCorners: true },
    valAxisMinVal: 3.0
  });

  // Right side - key stats
  const stats = [
    { num: "3.8万", label: "社区卫生服务机构", sublabel: "截至2023年底" },
    { num: "72.3%", label: "家庭医生签约率", sublabel: "重点人群覆盖率" },
    { num: "45万", label: "全科医生总数", sublabel: "较上年增长8%" }
  ];

  stats.forEach((s, i) => {
    const yPos = 1.3 + i * 1.35;

    // Stat card
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 5.8, y: yPos, w: 3.6, h: 1.15,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "006d77", blur: 4, offset: 1, angle: 135, opacity: 0.06 }
    });

    // Left color bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 5.8, y: yPos, w: 0.06, h: 1.15,
      fill: { color: i === 0 ? theme.primary : i === 1 ? "83c5be" : theme.accent }
    });

    // Number
    slide.addText(s.num, {
      x: 6.1, y: yPos + 0.1, w: 2.0, h: 0.55,
      fontSize: 26, fontFace: "Georgia",
      color: i === 0 ? theme.primary : i === 1 ? "83c5be" : theme.accent,
      bold: true, valign: "middle"
    });

    // Label
    slide.addText(s.label, {
      x: 8.1, y: yPos + 0.1, w: 1.2, h: 0.3,
      fontSize: 12, fontFace: "Microsoft YaHei",
      color: theme.primary, bold: true, valign: "bottom"
    });

    // Sublabel
    slide.addText(s.sublabel, {
      x: 8.1, y: yPos + 0.4, w: 1.2, h: 0.25,
      fontSize: 10, fontFace: "Microsoft YaHei",
      color: "83c5be"
    });
  });

  // Source note
  slide.addText("数据来源：国家卫生健康委员会年度统计公报", {
    x: 0.6, y: 5.0, w: 5, h: 0.3,
    fontSize: 9, fontFace: "Microsoft YaHei",
    color: "83c5be"
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("8", {
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
  pres.writeFile({ fileName: "slide-08-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
