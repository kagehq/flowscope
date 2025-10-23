#!/usr/bin/env node
/**
 * Sync compiled CSS into enhanced-panel.ts
 * This reads dist/panel.css and injects it into the TypeScript file
 */

const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../dist/panel.css');
const tsPath = path.join(__dirname, '../src/ui/enhanced-panel.ts');

try {
  // Read the compiled CSS
  const css = fs.readFileSync(cssPath, 'utf8');

  // Minify: remove newlines and compress spaces
  const minified = css
    .replace(/\n/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Read the TypeScript file
  let tsContent = fs.readFileSync(tsPath, 'utf8');

  // Find and replace the CSS content between the backticks
  const styleContentRegex = /(style\.textContent = `)(.*)(`;\s*document\.head\.appendChild)/s;

  if (!styleContentRegex.test(tsContent)) {
    console.error('❌ Could not find style.textContent in enhanced-panel.ts');
    process.exit(1);
  }

  tsContent = tsContent.replace(
    styleContentRegex,
    `$1${minified}$3`
  );

  // Write back
  fs.writeFileSync(tsPath, tsContent, 'utf8');

  console.log('✅ CSS synced to enhanced-panel.ts');
  console.log(`   Size: ${minified.length} bytes`);

} catch (error) {
  console.error('❌ Error syncing CSS:', error.message);
  process.exit(1);
}

