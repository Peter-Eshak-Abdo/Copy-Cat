const fs = require('fs');

function htmlToJsx(str) {
  return str
    .replace(/class=/g, 'className=')
    .replace(/for=/g, 'htmlFor=')
    .replace(/<input([^>]*[^\/])>/g, '<input$1 />')
    .replace(/<img([^>]*[^\/])>/g, '<img$1 />')
    .replace(/<br([^>]*[^\/])>/g, '<br$1 />')
    .replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}')
    .replace(/style="([^"]*)"/g, (match, p1) => {
      const rules = p1.split(';').filter(Boolean);
      const styleObj = {};
      rules.forEach(rule => {
        const [k, v] = rule.split(':');
        if (k && v) {
          const camelKey = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          styleObj[camelKey] = v.trim();
        }
      });
      return `style={${JSON.stringify(styleObj)}}`;
    });
}

const html = fs.readFileSync('stitch_ocr_document_platform_redesign/multi_stage_ocr/code.html', 'utf8');
const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)[1];
const jsx = htmlToJsx(main);
if (!fs.existsSync('scratch')) fs.mkdirSync('scratch', { recursive: true });
fs.writeFileSync('scratch/multi_stage_ocr.jsx', jsx);
console.log('Converted multi_stage_ocr to scratch/multi_stage_ocr.jsx');

const html1 = fs.readFileSync('stitch_ocr_document_platform_redesign/_1/code.html', 'utf8');
const main1 = html1.match(/<main[^>]*>([\s\S]*?)<\/main>/i)[1];
const jsx1 = htmlToJsx(main1);
fs.writeFileSync('scratch/_1.jsx', jsx1);
console.log('Converted _1 to scratch/_1.jsx');
