// Bundles the client with esbuild into dist/ (index.html + assets).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'dist';
fs.rmSync(OUT, { recursive: true, force: true });

await esbuild.build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'esm',
  splitting: false,
  target: ['es2019'],
  jsx: 'automatic',
  loader: { '.jsx': 'jsx', '.css': 'css' },
  outdir: OUT,
  entryNames: 'assets/app',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});

const js = fs.readFileSync(path.join(OUT, 'assets/app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.existsSync(path.join(OUT, 'assets/app.css'))
  ? fs.readFileSync(path.join(OUT, 'assets/app.css'), 'utf8')
  : '';

const html =
  '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
  '  <meta charset="UTF-8" />\n' +
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
  '  <title>HashLab — GPU Hash Cracking Benchmark</title>\n' +
  '  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />\n' +
  '  <style>\n' + css + '\n  </style>\n' +
  '</head>\n<body>\n  <div id="root"></div>\n  <script type="module">\n' + js + '\n  </script>\n</body>\n</html>\n';

fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.rmSync(path.join(OUT, 'assets'), { recursive: true, force: true });
console.log('built dist/index.html ·', (html.length / 1024).toFixed(1), 'kB');
