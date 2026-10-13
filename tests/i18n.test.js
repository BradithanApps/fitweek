import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import es from '../src/i18n/es.js';
import pt from '../src/i18n/pt.js';
import en from '../src/i18n/en.js';

test('los 3 idiomas tienen exactamente las mismas claves', () => {
  const k = (d) => Object.keys(d).sort();
  assert.deepEqual(k(pt), k(es), 'pt.js difiere de es.js');
  assert.deepEqual(k(en), k(es), 'en.js difiere de es.js');
});

test('los parámetros {x} coinciden entre idiomas', () => {
  const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const key of Object.keys(es)) {
    assert.equal(params(pt[key]), params(es[key]), `pt: ${key}`);
    assert.equal(params(en[key]), params(es[key]), `en: ${key}`);
  }
});

test('toda clave usada en el código existe en es.js', () => {
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js') && !p.includes('i18n')) files.push(p);
    }
  };
  walk('src');
  const missing = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z]+\.[a-zA-Z]+)'(\s*,\s*\{\s*count\b)?/g)) {
      const key = m[1];
      const plural = !!m[2];
      const ok = plural ? `${key}_one` in es && `${key}_other` in es : key in es;
      if (!ok) missing.push(`${key} (${f})`);
    }
    for (const m of src.matchAll(/'((?:backup|errors)\.[a-zA-Z]+)'/g)) if (!(m[1] in es)) missing.push(`${m[1]} (${f})`);
  }
  assert.deepEqual(missing, []);
});
