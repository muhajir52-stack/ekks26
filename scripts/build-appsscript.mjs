import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const tempOutDir = path.resolve(rootDir, '.dist-appsscript');
const appsScriptDir = path.resolve(rootDir, 'appsscript');
const publicAppsScriptDir = path.resolve(rootDir, 'public', 'appsscript');

async function main() {
  console.log('Membangun bundel tunggal index.html untuk Google Apps Script...');
  fs.rmSync(tempOutDir, { recursive: true, force: true });

  await build({
    root: rootDir,
    configFile: path.resolve(rootDir, 'vite.config.ts'),
    base: './',
    build: {
      outDir: tempOutDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
      rolldownOptions: {
        output: {
          codeSplitting: false,
          inlineDynamicImports: true,
          format: 'iife',
          name: 'SimsAppBundle',
        },
      },
    },
  });

  const assetsDir = path.resolve(tempOutDir, 'assets');
  const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];

  const cssFiles = assetFiles.filter((f) => f.endsWith('.css'));
  const jsFiles = assetFiles.filter((f) => f.endsWith('.js'));

  if (jsFiles.length !== 1) {
    throw new Error(
      `Diharapkan tepat 1 berkas JS bundel tunggal, ditemukan ${jsFiles.length}: ${jsFiles.join(', ')}`
    );
  }

  const cssContent = cssFiles
    .map((f) => fs.readFileSync(path.resolve(assetsDir, f), 'utf8'))
    .join('\n');
  const jsContent = fs.readFileSync(path.resolve(assetsDir, jsFiles[0]), 'utf8');

  // Escape </script and <!-- inside JS bundle so HTML parser never breaks
  const safeJs = jsContent
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '\\x3C!--');
  const safeCss = cssContent.replace(/<\/style/gi, '<\\/style');

  const sourceHtml = fs.readFileSync(path.resolve(rootDir, 'index.html'), 'utf8');
  let outputHtml = sourceHtml
    .replace(/<script\s+type="module"\s+src="\/src\/main\.tsx"><\/script>/i, () => '')
    .replace(/<\/head>/i, () => `  <style>\n${safeCss}\n  </style>\n</head>`)
    .replace(/<\/body>/i, () => `  <script>\n${safeJs}\n  </script>\n</body>`);

  if (!outputHtml.includes(safeJs.slice(0, 64))) {
    throw new Error('Gagal menyisipkan skrip bundel ke index.html Apps Script.');
  }

  fs.mkdirSync(appsScriptDir, { recursive: true });
  const targetHtmlPath = path.resolve(appsScriptDir, 'index.html');
  fs.writeFileSync(targetHtmlPath, outputHtml, 'utf8');

  // Copy Code.gs and index.html to public/appsscript for 1-click download inside web app
  fs.mkdirSync(publicAppsScriptDir, { recursive: true });
  const codeGsPath = path.resolve(appsScriptDir, 'Code.gs');
  if (fs.existsSync(codeGsPath)) {
    fs.copyFileSync(codeGsPath, path.resolve(publicAppsScriptDir, 'Code.gs'));
  }
  fs.copyFileSync(targetHtmlPath, path.resolve(publicAppsScriptDir, 'index.html'));

  // Clean up temporary directory
  fs.rmSync(tempOutDir, { recursive: true, force: true });

  const sizeKb = (fs.statSync(targetHtmlPath).size / 1024).toFixed(1);
  console.log(`Selesai! appsscript/index.html berhasil dibuat (${sizeKb} KB).`);
}

main().catch((err) => {
  console.error('Gagal membangun index.html Apps Script:', err);
  process.exit(1);
});
