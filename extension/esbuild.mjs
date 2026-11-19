import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
  target: 'node20',
});

if (watch) {
  await ctx.watch();
  console.log('watching…');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('extension compiled → dist/extension.js');
}
