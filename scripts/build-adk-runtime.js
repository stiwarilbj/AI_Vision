const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const projectRoot = path.resolve(__dirname, '..');
const entryPoint = path.join(projectRoot, 'src/background/adk-runtime-entry.js');
const outputPath = path.join(projectRoot, 'src/background/adk-runtime.js');
const shims = path.join(projectRoot, 'scripts/adk-browser-shims');

const exactShim = (name) => path.join(shims, name);

const plugin = {
  name: 'ai-vision-adk-browser-compatibility',
  setup(build) {
    build.onResolve({ filter: /^module$/ }, () => ({ path: exactShim('module.js') }));
    build.onResolve({ filter: /(?:^|\/)utils\/env_aware_utils\.js$/ }, () => ({ path: exactShim('env-aware-utils.js') }));
    build.onResolve({ filter: /(?:^|\/)utils\/client_labels\.js$/ }, () => ({ path: exactShim('client-labels.js') }));
    build.onResolve({ filter: /(?:^|\/)logger\.js$/ }, () => ({ path: exactShim('logger.js') }));
    build.onResolve({ filter: /(?:^|\/)apigee_llm\.js$/ }, () => ({ path: exactShim('apigee-llm.js') }));
    build.onResolve({ filter: /^node:crypto$/ }, () => ({ path: exactShim('env-aware-utils.js') }));
    build.onResolve({ filter: /^node:async_hooks$/ }, () => ({ path: exactShim('async-hooks.js') }));
  }
};

async function build() {
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    outfile: outputPath,
    format: 'iife',
    globalName: 'AIVisionAdkRuntime',
    platform: 'browser',
    target: ['chrome102'],
    minify: true,
    legalComments: 'eof',
    treeShaking: true,
    plugins: [plugin],
    banner: {
      js: [
        '/* Google ADK browser bundle; generated from @google/adk under its Apache-2.0 license. */',
        'if (typeof globalThis.window === "undefined") globalThis.window = { navigator: globalThis.navigator || { userAgent: "Chrome Extension" }, btoa: globalThis.btoa, atob: globalThis.atob };',
        'if (typeof globalThis.process === "undefined") globalThis.process = { env: {}, version: "browser" };'
      ].join('\n')
    },
    footer: {
      js: 'globalThis.AIVisionAdkRuntime = AIVisionAdkRuntime;'
    }
  });
  const stat = fs.statSync(outputPath);
  console.log(`Built ${path.relative(projectRoot, outputPath)} (${stat.size} bytes) from @google/adk web modules.`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
