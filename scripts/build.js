#!/usr/bin/env node
/**
 * build.js — PulseOps Control Center build script
 *
 * Copies static assets and onboarding metadata into the dist/ output directory.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Clean and recreate dist/
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(DIST, { recursive: true });

// Copy trio metadata into dist/trio/
const trioSrc = path.join(ROOT, 'trio');
const trioDest = path.join(DIST, 'trio');
fs.mkdirSync(trioDest, { recursive: true });

for (const file of fs.readdirSync(trioSrc)) {
  const src = path.join(trioSrc, file);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, path.join(trioDest, file));
    console.log(`Copied trio/${file} → dist/trio/${file}`);
  }
}

// Emit a minimal index.html
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let onboarding;
try {
  onboarding = JSON.parse(fs.readFileSync(path.join(trioSrc, 'onboarding.json'), 'utf8'));
} catch (err) {
  console.error('ERROR: trio/onboarding.json is missing or contains invalid JSON.');
  console.error(err.message);
  process.exit(1);
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${onboarding.name}</title>
</head>
<body>
  <h1>${onboarding.name}</h1>
  <p>${onboarding.description}</p>
  <p>Status: <strong>${onboarding.status}</strong></p>
</body>
</html>
`;

fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');
console.log('Written dist/index.html');
console.log(`\nBuild complete — output in dist/  (v${pkg.version})`);
