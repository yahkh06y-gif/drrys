// Runs after `expo export -p web`.
// Expo puts fonts and icons from npm packages under dist/assets/node_modules/…, but Vercel drops every
// folder named node_modules when it uploads — so on the website the fonts fall back and icons vanish.
// Move that folder to dist/assets/vendor and point the JS bundle at the new path.
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const from = path.join(dist, 'assets', 'node_modules');
const to = path.join(dist, 'assets', 'vendor');

if (fs.existsSync(from)) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(js|html|css|json)$/.test(e.name) ? [p] : [];
  });

let changed = 0;
for (const file of walk(dist)) {
  const src = fs.readFileSync(file, 'utf8');
  const out = src.split('/assets/node_modules/').join('/assets/vendor/');
  if (out !== src) {
    fs.writeFileSync(file, out);
    changed++;
  }
}
console.log(`fix-web-assets: moved assets/node_modules → assets/vendor, updated ${changed} file(s)`);
