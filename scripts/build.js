#!/usr/bin/env node
/**
 * build.js — PulseOps Control Center build script
 *
 * Copies static assets and onboarding metadata into the dist/ output directory,
 * and generates an HTML page for every screen defined in PREP_SCENARIO.json so
 * that GitHub Pages can serve each route without a 404.
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

// Load metadata
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let onboarding;
try {
  onboarding = JSON.parse(fs.readFileSync(path.join(trioSrc, 'onboarding.json'), 'utf8'));
} catch (err) {
  console.error('ERROR: trio/onboarding.json is missing or contains invalid JSON.');
  console.error(err.message);
  process.exit(1);
}

let scenario;
try {
  scenario = JSON.parse(fs.readFileSync(path.join(ROOT, 'PREP_SCENARIO.json'), 'utf8'));
} catch (err) {
  console.error('ERROR: PREP_SCENARIO.json is missing or contains invalid JSON.');
  console.error(err.message);
  process.exit(1);
}

const screens = scenario.screens || [];
const navItems = (scenario.navigation && scenario.navigation.primary_nav) || [];
const deployEnvs = (onboarding.deploy && onboarding.deploy.environments) || [];

// Shared styles
const sharedStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6f9; color: #1a1a2e; }
  nav { background: #1a1a2e; padding: 0 24px; display: flex; align-items: center; gap: 8px; }
  nav .brand { color: #fff; font-weight: 700; font-size: 1rem; padding: 16px 12px 16px 0; margin-right: 8px; border-right: 1px solid #2e2e4e; }
  nav a { color: #a0aec0; text-decoration: none; padding: 16px 12px; display: inline-block; font-size: 0.875rem; }
  nav a:hover, nav a.active { color: #fff; border-bottom: 2px solid #4299e1; }
  main { max-width: 960px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; }
  .subtitle { color: #718096; margin-bottom: 32px; font-size: 0.95rem; }
  .card { background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; }
  th { background: #f7fafc; font-weight: 600; color: #4a5568; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
  .badge-yes { background: #c6f6d5; color: #276749; }
  .badge-no  { background: #e2e8f0; color: #718096; }
`;

// Compute a relative href from one route to another.
// Routes are slash-prefixed strings like '/deployment' or '/incidents/new'.
// Pages live at dist/<route>/index.html, so depth = number of non-empty segments.
function relativeNavHref(fromRoute, toRoute) {
  const fromDepth = fromRoute.replace(/^\//, '').split('/').filter(Boolean).length;
  const prefix = '../'.repeat(fromDepth);
  const toSegment = toRoute.replace(/^\//, '');
  return prefix + toSegment + '/';
}

// Build a nav bar HTML string, marking the current route as active
function buildNav(currentRoute) {
  const links = navItems.map(item => {
    const active = item.route === currentRoute ? ' class="active"' : '';
    const href = relativeNavHref(currentRoute, item.route);
    return `<a href="${href}"${active}>${item.label}</a>`;
  }).join('\n    ');
  return `<nav>
  <span class="brand">${onboarding.name}</span>
  ${links}
</nav>`;
}

// Build the page body for a given screen
function buildScreenBody(screen) {
  if (screen.id === 'deployment') {
    const rows = deployEnvs.map(env => `
      <tr>
        <td>${env.name}</td>
        <td>${env.target}</td>
        <td><span class="badge ${env.autoDeploy ? 'badge-yes' : 'badge-no'}">${env.autoDeploy ? 'Yes' : 'No'}</span></td>
        <td><span class="badge ${env.approvalRequired ? 'badge-yes' : 'badge-no'}">${env.approvalRequired ? 'Yes' : 'No'}</span></td>
        <td><span class="badge ${env.highAvailability ? 'badge-yes' : 'badge-no'}">${env.highAvailability ? 'Yes' : 'No'}</span></td>
        <td>${env.rollbackStrategy}</td>
      </tr>`).join('');
    return `
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Environment</th>
          <th>Target</th>
          <th>Auto Deploy</th>
          <th>Approval Required</th>
          <th>High Availability</th>
          <th>Rollback Strategy</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>
  </div>`;
  }

  const inputRows = (screen.inputs || []).map(inp =>
    `<tr><td>${inp.label}</td><td>${inp.type}</td><td>${inp.required ? 'Yes' : 'No'}</td></tr>`
  ).join('');

  const actionRows = (screen.actions || []).map(act =>
    `<tr><td>${act.label}</td><td>${act.type}</td><td>${act.description || ''}</td></tr>`
  ).join('');

  let body = '';
  if (inputRows) {
    body += `
  <div class="card">
    <h2 style="font-size:1rem;margin-bottom:12px;color:#4a5568;">Inputs</h2>
    <table>
      <thead><tr><th>Label</th><th>Type</th><th>Required</th></tr></thead>
      <tbody>${inputRows}</tbody>
    </table>
  </div>`;
  }
  if (actionRows) {
    body += `
  <div class="card">
    <h2 style="font-size:1rem;margin-bottom:12px;color:#4a5568;">Actions</h2>
    <table>
      <thead><tr><th>Label</th><th>Type</th><th>Description</th></tr></thead>
      <tbody>${actionRows}</tbody>
    </table>
  </div>`;
  }
  if (!body) {
    body = `<div class="card"><p style="color:#718096;">No inputs or actions defined for this screen.</p></div>`;
  }
  return body;
}

// Generate an HTML page for the given screen
function buildPage(screen) {
  const nav = buildNav(screen.route);
  const body = buildScreenBody(screen);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${screen.name} — ${onboarding.name}</title>
  <style>${sharedStyles}</style>
</head>
<body>
  ${nav}
  <main>
    <h1>${screen.name}</h1>
    <p class="subtitle">${screen.description}</p>
    ${body}
  </main>
</body>
</html>
`;
}

// Write a page to dist/<routeSegments>/index.html
function writePage(route, html) {
  // Strip leading slash and split into segments, filtering empty strings
  const segments = route.replace(/^\//, '').split('/').filter(Boolean);
  const dir = segments.length ? path.join(DIST, ...segments) : DIST;
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'index.html');
  fs.writeFileSync(dest, html, 'utf8');
  const relDest = path.relative(ROOT, dest);
  console.log(`Written ${relDest}`);
}

// Generate one page per screen
for (const screen of screens) {
  // Skip dynamic routes (contain :param) — they cannot be pre-rendered as static files
  if (screen.route.includes(':')) {
    console.log(`Skipped dynamic route ${screen.route} (${screen.id})`);
    continue;
  }
  writePage(screen.route, buildPage(screen));
}

// Root index.html — redirect to the first nav item (relative URL works with any base path)
const firstNavRoute = navItems.length ? navItems[0].route.replace(/^\//, '') + '/' : 'streams/';
const rootHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url=./${firstNavRoute}" />
  <title>${onboarding.name}</title>
</head>
<body>
  <p>Redirecting to <a href="./${firstNavRoute}">${onboarding.name}</a>…</p>
</body>
</html>
`;
fs.writeFileSync(path.join(DIST, 'index.html'), rootHtml, 'utf8');
console.log('Written dist/index.html (root redirect)');

// 404.html — GitHub Pages serves this for any unmatched path.
// Redirects to './' (the site root) using a relative URL so it works
// regardless of whether the site is deployed at a domain root or a sub-path.
const notFoundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page Not Found — ${onboarding.name}</title>
  <style>${sharedStyles}</style>
  <script>window.location.replace('./');</script>
</head>
<body>
  <p>Page not found. <a href="./">Return to ${onboarding.name}</a></p>
</body>
</html>
`;
fs.writeFileSync(path.join(DIST, '404.html'), notFoundHtml, 'utf8');
console.log('Written dist/404.html');

console.log(`\nBuild complete — output in dist/  (v${pkg.version})`);
