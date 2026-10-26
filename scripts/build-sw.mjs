// Genera dist/sw.js con la lista de archivos a precargar y una versión basada en su contenido.
// Se ejecuta después de `vite build` (ver "build" en package.json).

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const SKIP = new Set(['sw.js', '.nojekyll']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(DIST)
  .map((p) => relative(DIST, p).split(sep).join('/'))
  .filter((p) => !SKIP.has(p) && !p.startsWith('screenshots/')) // las capturas solo se usan en el diálogo de instalación
  .sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(DIST, f)));
const version = hash.digest('hex').slice(0, 12);

const assets = ['./', ...files.map((f) => `./${f}`)];
const template = readFileSync('sw/sw.js', 'utf8');
const out = template
  .replace("const VERSION = '__VERSION__';", `const VERSION = ${JSON.stringify(version)};`)
  .replace('const ASSETS = __ASSETS__;', `const ASSETS = ${JSON.stringify(assets, null, 2)};`);
if (out.includes('= __ASSETS__') || out.includes("= '__VERSION__'")) throw new Error('No se pudo generar sw.js');
writeFileSync(join(DIST, 'sw.js'), out);
// GitHub Pages: sin Jekyll para que no ignore archivos.
writeFileSync(join(DIST, '.nojekyll'), '');

const kb = files.reduce((n, f) => n + statSync(join(DIST, f)).size, 0) / 1024;
console.log(`sw.js generado · versión ${version} · ${assets.length} recursos · ${kb.toFixed(0)} KB precargados`);
