import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });
await cp('public', 'dist', { recursive: true });
await cp('FORMAT.md', 'dist/FORMAT.md');

const options = {
  bundle: true,
  minify: true,
  target: ['es2022', 'safari15.4'],
  outdir: 'dist/assets',
  entryNames: '[name]-[hash]',
  metafile: true,
};
const reader = await build({ ...options, entryPoints: ['src/reader-worker.js'], format: 'iife' });
const [readerPath] = Object.keys(reader.metafile.outputs);
const app = await build({
  ...options,
  entryPoints: ['src/app.js'],
  format: 'esm',
  define: { SR_READER_WORKER_PATH: JSON.stringify('./' + basename(readerPath)) },
});
const [appPath] = Object.keys(app.metafile.outputs);
const html = await readFile('public/index.html', 'utf8');
await writeFile('dist/index.html', html.replace('./assets/app.js', './assets/' + basename(appPath)));
console.log('Built dist — bundled app and on-demand reader.');
