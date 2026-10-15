/**
 * Build: bundles src/ into
 *   dist/web/index.html         single self-contained page (GitHub Pages, or open from disk)
 *   dist/web/data/*.json        the generated dataset, for transparency
 *   dist/apps-script/*          files for `clasp push` (Index.html, Code.gs, Generator.gs, appsscript.json)
 * Apps Script's HtmlService does not support ES modules, so everything is inlined.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const ui = path.join(src, 'ui');
const dist = path.join(root, 'dist');

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };

let html = read(path.join(ui, 'index.html'));
html = html.replace(/<!-- build:css -->[\s\S]*?<!-- \/build:css -->/, () => '<style>\n' + read(path.join(ui, 'styles.css')) + '\n</style>');
html = html.replace(/<!-- build:js -->([\s\S]*?)<!-- \/build:js -->/, (_, block) => {
  const files = Array.from(block.matchAll(/src="([^"]+)"/g)).map((m) => path.resolve(ui, m[1]));
  return files.map((f) => '<script>\n/* ' + path.relative(src, f) + ' */\n' + read(f) + '\n</script>').join('\n');
});
if (/<script src="\.\.?\//.test(html)) throw new Error('Unbundled local script left in output');

fs.rmSync(dist, { recursive: true, force: true });
write(path.join(dist, 'web', 'index.html'), html);
write(path.join(dist, 'web', '.nojekyll'), '');

require(path.join(src, 'data', 'generator.js'));
write(path.join(dist, 'web', 'data', 'fernvale-dataset.json'), JSON.stringify(globalThis.PT.generator.generate(), null, 1));

write(path.join(dist, 'apps-script', 'Index.html'), html);
write(path.join(dist, 'apps-script', 'Code.gs'), read(path.join(root, 'apps-script', 'Code.gs')));
write(path.join(dist, 'apps-script', 'Generator.gs'), read(path.join(src, 'data', 'generator.js')));
write(path.join(dist, 'apps-script', 'appsscript.json'), read(path.join(root, 'apps-script', 'appsscript.json')));

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0) + ' KB';
console.log('Built dist/web/index.html (' + kb(path.join(dist, 'web', 'index.html')) + ') and dist/apps-script/ (4 files)');
