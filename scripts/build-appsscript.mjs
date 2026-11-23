import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import { build as viteBuild } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const tempOutDir = path.resolve(rootDir, '.dist-appsscript');
const appsScriptDir = path.resolve(rootDir, 'appsscript');
const publicAppsScriptDir = path.resolve(rootDir, 'public', 'appsscript');

/**
 * Plugin esbuild khusus untuk Google Apps Script:
 * 1. Membuang seluruh SDK Firebase (~850 KB+) karena GAS memakai Code.gs + Google Spreadsheet.
 * 2. Mengarahkan pustaka besar (React, ReactDOM, D3, jsPDF, XLSX) ke skrip CDN global
 *    sehingga berkas tunggal index.html menjadi ringan, cepat dimuat, dan mudah disalin.
 */
function createAppsScriptSlimPlugin() {
  const VIRTUAL_NS = 'gas-shim';

  const firebaseStubs = {
    'firebase/app': `
      export function initializeApp() { return {}; }
    `,
    'firebase/auth': `
      export function getAuth() { return {}; }
      export class GoogleAuthProvider {}
      export function getRedirectResult() { return Promise.resolve(null); }
      export function onAuthStateChanged(_auth, cb) {
        if (typeof cb === 'function') setTimeout(() => cb(null), 0);
        return () => {};
      }
      export function signInWithPopup() { return Promise.reject(new Error('Mode GAS aktif')); }
      export function signInWithRedirect() { return Promise.reject(new Error('Mode GAS aktif')); }
      export function signOut() { return Promise.resolve(); }
    `,
    'firebase/firestore': `
      const noop = () => {};
      const emptySnap = { docs: [], empty: true, size: 0, exists: () => false, data: () => ({}) };
      export function getFirestore() { return {}; }
      export function collection() { return {}; }
      export function doc() { return {}; }
      export function query() { return {}; }
      export function where() { return {}; }
      export function limit() { return {}; }
      export function serverTimestamp() { return new Date().toISOString(); }
      export function onSnapshot() { return noop; }
      export function getDoc() { return Promise.resolve(emptySnap); }
      export function getDocs() { return Promise.resolve(emptySnap); }
      export function getDocFromServer() { return Promise.resolve(emptySnap); }
      export function addDoc() { return Promise.resolve({ id: 'gas_noop' }); }
      export function setDoc() { return Promise.resolve(); }
      export function updateDoc() { return Promise.resolve(); }
      export function deleteDoc() { return Promise.resolve(); }
      export function writeBatch() {
        return { set: noop, update: noop, delete: noop, commit: () => Promise.resolve() };
      }
    `,
  };

  const cdnGlobals = {
    react: 'module.exports = window.React;',
    'react-dom': 'module.exports = window.ReactDOM;',
    'react-dom/client': 'module.exports = window.ReactDOM;',
    'react/jsx-runtime': `
      const R = window.React;
      export const Fragment = R.Fragment;
      export function jsx(type, props, key) {
        if (key !== undefined) {
          return R.createElement(type, Object.assign({}, props, { key }));
        }
        return R.createElement(type, props);
      }
      export const jsxs = jsx;
    `,
    'react/jsx-dev-runtime': `
      const R = window.React;
      export const Fragment = R.Fragment;
      export function jsxDEV(type, props, key) {
        if (key !== undefined) {
          return R.createElement(type, Object.assign({}, props, { key }));
        }
        return R.createElement(type, props);
      }
    `,
    xlsx: 'module.exports = window.XLSX;',
    jspdf: `
      const J = (window.jspdf && (window.jspdf.jsPDF || window.jspdf.default)) || window.jsPDF;
      export const jsPDF = J;
      export default J;
    `,
    'jspdf-autotable': `
      export default function autoTable(doc, options) {
        if (doc && typeof doc.autoTable === 'function') {
          return doc.autoTable(options);
        }
        if (typeof window.jspdfAutoTable === 'function') {
          return window.jspdfAutoTable(doc, options);
        }
      }
    `,
  };

  return {
    name: 'appsscript-slim-plugin',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (firebaseStubs[args.path]) {
          return { path: args.path, namespace: `${VIRTUAL_NS}-fb` };
        }
        if (cdnGlobals[args.path]) {
          return { path: args.path, namespace: `${VIRTUAL_NS}-cdn` };
        }
        if (args.path.endsWith('.css')) {
          return { path: args.path, namespace: `${VIRTUAL_NS}-css` };
        }
        if (args.path.endsWith('firebase-applet-config.json')) {
          return { path: 'firebase-applet-config', namespace: `${VIRTUAL_NS}-cfg` };
        }
        return null;
      });

      build.onLoad({ filter: /.*/, namespace: `${VIRTUAL_NS}-fb` }, (args) => ({
        contents: firebaseStubs[args.path],
        loader: 'js',
      }));

      build.onLoad({ filter: /.*/, namespace: `${VIRTUAL_NS}-cdn` }, (args) => ({
        contents: cdnGlobals[args.path],
        loader: 'js',
      }));

      build.onLoad({ filter: /.*/, namespace: `${VIRTUAL_NS}-css` }, () => ({
        contents: '',
        loader: 'js',
      }));

      build.onLoad({ filter: /.*/, namespace: `${VIRTUAL_NS}-cfg` }, () => ({
        contents: '{}',
        loader: 'json',
      }));
    },
  };
}

async function buildTailwindCssOnly() {
  fs.rmSync(tempOutDir, { recursive: true, force: true });

  await viteBuild({
    root: rootDir,
    configFile: path.resolve(rootDir, 'vite.config.ts'),
    logLevel: 'silent',
    build: {
      outDir: tempOutDir,
      emptyOutDir: true,
      rolldownOptions: {
        input: path.resolve(rootDir, 'src', 'index.css'),
      },
    },
  });

  const assetsDir = path.resolve(tempOutDir, 'assets');
  const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
  const cssFiles = assetFiles.filter((f) => f.endsWith('.css'));

  const cssContent = cssFiles
    .map((f) => fs.readFileSync(path.resolve(assetsDir, f), 'utf8'))
    .join('\n')
    .trim();

  fs.rmSync(tempOutDir, { recursive: true, force: true });

  if (!cssContent) {
    throw new Error('Gagal mengompilasi CSS Tailwind untuk bundel Apps Script.');
  }
  return cssContent;
}

async function main() {
  console.log('Membangun index.html ringkas untuk Google Apps Script...');

  const [cssContent, jsResult] = await Promise.all([
    buildTailwindCssOnly(),
    esbuild.build({
      entryPoints: [path.resolve(rootDir, 'src', 'main.tsx')],
      bundle: true,
      minify: true,
      write: false,
      format: 'iife',
      globalName: 'SimsAppBundle',
      platform: 'browser',
      target: ['es2020'],
      jsx: 'automatic',
      legalComments: 'none',
      drop: ['console', 'debugger'],
      plugins: [createAppsScriptSlimPlugin()],
    }),
  ]);

  if (!jsResult.outputFiles || jsResult.outputFiles.length === 0) {
    throw new Error('Output bundel JavaScript dari esbuild kosong.');
  }

  const jsContent = jsResult.outputFiles[0].text;
  const safeJs = jsContent
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '\\x3C!--');
  const safeCss = cssContent.replace(/<\/style/gi, '<\\/style');

  const cdnScripts = [
    '<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>',
    '<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>',
  ].join('\n  ');

  const outputHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SIMS SMA Darul Ulum Kepohbaru — Sistem Informasi Manajemen Sekolah</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
${safeCss}
  </style>
</head>
<body>
  <div id="root"></div>
  ${cdnScripts}
  <script>
${safeJs}
  </script>
</body>
</html>
`;

  fs.mkdirSync(appsScriptDir, { recursive: true });
  const targetHtmlPath = path.resolve(appsScriptDir, 'index.html');
  fs.writeFileSync(targetHtmlPath, outputHtml, 'utf8');

  fs.mkdirSync(publicAppsScriptDir, { recursive: true });
  const codeGsPath = path.resolve(appsScriptDir, 'Code.gs');
  if (fs.existsSync(codeGsPath)) {
    fs.copyFileSync(codeGsPath, path.resolve(publicAppsScriptDir, 'Code.gs'));
  }
  fs.copyFileSync(targetHtmlPath, path.resolve(publicAppsScriptDir, 'index.html'));

  const sizeKb = (fs.statSync(targetHtmlPath).size / 1024).toFixed(1);
  console.log(`Selesai! appsscript/index.html ringkas berhasil dibuat (${sizeKb} KB).`);
}

main().catch((err) => {
  console.error('Gagal membangun index.html Apps Script:', err);
  process.exit(1);
});
