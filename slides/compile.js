// slides/compile.js — Combine all slide modules into final PPTX
const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = 'AI Assistant';
pres.title = '社区与公共卫生支持体系';
pres.subject = 'Community & Public Health Support System';

const theme = {
  primary: "006d77",    // deep teal - titles, dark elements
  secondary: "83c5be",  // light teal - secondary elements
  accent: "e29578",     // warm coral - highlights, badges
  light: "ffddd2",      // light pink - decorative accents
  bg: "edf6f9"          // very light blue - backgrounds
};

for (let i = 1; i <= 12; i++) {
  const num = String(i).padStart(2, '0');
  const slideModule = require(`./slide-${num}.js`);
  slideModule.createSlide(pres, theme);
}

pres.writeFile({ fileName: './output/社区与公共卫生支持体系.pptx' })
  .then(() => console.log('✅ PPTX generated: output/社区与公共卫生支持体系.pptx'))
  .catch(err => console.error('❌ Error:', err));
