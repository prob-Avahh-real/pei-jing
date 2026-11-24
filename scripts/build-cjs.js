const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = __dirname.replace(/\/scripts$/, '');
const src = path.join(root, 'src');

for (const mod of ['store', 'calibrate', 'acuity', 'astigmatism', 'subjective', 'prescription']) {
  esbuild.buildSync({
    entryPoints: [path.join(src, `${mod}.js`)],
    bundle: true,
    format: 'cjs',
    outfile: path.join(src, `${mod}.cjs.js`),
    platform: 'node',
    target: ['node18'],
  });
}

console.log('Built CJS test bundles');
