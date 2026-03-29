#!/usr/bin/env node
/**
 * SWIM26 External Babylon.js Screenshot Runner
 *
 * Called by Titan's screenshot regression service via SWIM26_REAL_SCREENSHOT_CMD.
 * Boots a headless Chromium instance, loads scene-renderer.html with Babylon.js,
 * renders a SWIM26 manifest fixture, and captures a real framebuffer screenshot.
 *
 * CLI contract:
 *   node runner.js --manifest <path> --output <png path> --metadata <json path>
 *                  [--width <px>] [--height <px>] [--frames <n>]
 *                  [--camera <id>] [--timeout <ms>] [--fixture-id <id>]
 *
 * Exit codes:
 *   0  success — screenshot and metadata written
 *   1  render failure — rendering failed; details in stderr
 *   2  bad arguments or bad manifest — fix invocation
 *   3  blocked environment — puppeteer or Babylon.js not installed
 *
 * stdout: progress lines prefixed [swim26-screenshot-runner]
 * stderr: error/blocked lines prefixed [swim26-screenshot-runner]
 *
 * Blocked environment is reported on stderr with the prefix BLOCKED_ENV:
 * so callers can distinguish it from runtime failures.
 */
'use strict';

const { parseArgs } = require('node:util');
const fs            = require('node:fs');
const path          = require('node:path');
const http          = require('node:http');

// ─────────────────────────────────────────────────────────────
// 1. CLI argument parsing
// ─────────────────────────────────────────────────────────────
let parsedArgs;
try {
  parsedArgs = parseArgs({
    options: {
      manifest:     { type: 'string' },
      output:       { type: 'string' },
      metadata:     { type: 'string' },
      width:        { type: 'string', default: '1280' },
      height:       { type: 'string', default: '720' },
      frames:       { type: 'string', default: '5' },
      camera:       { type: 'string', default: 'swim26-fixed-overhead' },
      timeout:      { type: 'string', default: '60000' },
      'fixture-id': { type: 'string', default: '' },
    },
    strict: true,
    allowPositionals: false,
  });
} catch (err) {
  process.stderr.write('[swim26-screenshot-runner] ARG_ERROR: ' + err.message + '\n');
  process.stderr.write('Usage: node runner.js --manifest <path> --output <png> --metadata <json>\n');
  process.exit(2);
}

const args = parsedArgs.values;

if (!args.manifest || !args.output || !args.metadata) {
  process.stderr.write(
    '[swim26-screenshot-runner] ARG_ERROR: --manifest, --output, and --metadata are all required.\n' +
    'Usage: node runner.js --manifest <path> --output <png> --metadata <json>\n'
  );
  process.exit(2);
}

const width           = Math.max(1, parseInt(args.width,   10) || 1280);
const height          = Math.max(1, parseInt(args.height,  10) || 720);
const frames          = Math.max(1, parseInt(args.frames,  10) || 5);
const cameraId        = args.camera  || 'swim26-fixed-overhead';
const renderTimeoutMs = Math.max(5000, parseInt(args.timeout, 10) || 60000);
const fixtureId       = args['fixture-id'] || '';

const manifestPath = path.resolve(args.manifest);
const outputPath   = path.resolve(args.output);
const metadataPath = path.resolve(args.metadata);

// ─────────────────────────────────────────────────────────────
// 2. Manifest validation
// ─────────────────────────────────────────────────────────────
if (!fs.existsSync(manifestPath)) {
  process.stderr.write('[swim26-screenshot-runner] ARG_ERROR: Manifest file not found: ' + manifestPath + '\n');
  process.exit(2);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
} catch (err) {
  process.stderr.write('[swim26-screenshot-runner] ARG_ERROR: Cannot parse manifest JSON: ' + err.message + '\n');
  process.exit(2);
}

if (!manifest.version || !manifest.runtime) {
  process.stderr.write('[swim26-screenshot-runner] ARG_ERROR: Manifest is missing required fields (version, runtime).\n');
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────
// 3. Environment checks — fail fast with BLOCKED_ENV signals
// ─────────────────────────────────────────────────────────────
const puppeteerModulePath = path.join(__dirname, 'node_modules', 'puppeteer');
const babylonJsPath       = path.join(__dirname, 'node_modules', 'babylonjs', 'babylon.js');

if (!fs.existsSync(puppeteerModulePath)) {
  process.stderr.write(
    '[swim26-screenshot-runner] BLOCKED_ENV: puppeteer_not_installed\n' +
    '[swim26-screenshot-runner] BLOCKED_ENV: puppeteer is not installed in tools/babylon-screenshot-runner/.\n' +
    '[swim26-screenshot-runner] BLOCKED_ENV: Fix: cd tools/babylon-screenshot-runner && npm install\n'
  );
  process.exit(3);
}

if (!fs.existsSync(babylonJsPath)) {
  process.stderr.write(
    '[swim26-screenshot-runner] BLOCKED_ENV: babylonjs_not_installed\n' +
    '[swim26-screenshot-runner] BLOCKED_ENV: babylonjs package not found at ' + babylonJsPath + '.\n' +
    '[swim26-screenshot-runner] BLOCKED_ENV: Fix: cd tools/babylon-screenshot-runner && npm install\n'
  );
  process.exit(3);
}

// ─────────────────────────────────────────────────────────────
// 4. Output directory setup
// ─────────────────────────────────────────────────────────────
try {
  fs.mkdirSync(path.dirname(outputPath),   { recursive: true });
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
} catch (err) {
  process.stderr.write('[swim26-screenshot-runner] ARG_ERROR: Cannot create output directories: ' + err.message + '\n');
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────
// 5. Local HTTP server — serves scene-renderer.html and
//    babylon.js / babylonjs-loaders.js from node_modules.
//    No CDN dependency: works offline and in CI.
// ─────────────────────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function createLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];

      // Route special assets to their node_modules location
      let filePath;
      if (urlPath === '/babylon.js') {
        filePath = path.join(__dirname, 'node_modules', 'babylonjs', 'babylon.js');
      } else if (urlPath === '/babylonjs-loaders.js') {
        const loadersPath = path.join(__dirname, 'node_modules', 'babylonjs-loaders', 'babylonjs.loaders.js');
        if (fs.existsSync(loadersPath)) {
          filePath = loadersPath;
        } else {
          // Serve empty stub — loaders are optional; runner still works without GLB support
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end('/* babylonjs-loaders not installed — GLB assets will use placeholder geometry */');
          return;
        }
      } else {
        filePath = path.join(__dirname, urlPath.replace(/^\/+/, ''));
      }

      // Prevent path traversal outside __dirname
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(__dirname))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(resolved)) {
        res.writeHead(404);
        res.end('Not found: ' + urlPath);
        return;
      }

      const ext = path.extname(resolved).toLowerCase();
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(fs.readFileSync(resolved));
    });

    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
    server.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────
// 6. Main render flow
// ─────────────────────────────────────────────────────────────
async function main() {
  let server = null;
  let port   = null;
  let browser = null;

  try {
    // Start local server
    ({ server, port } = await createLocalServer());
    process.stdout.write('[swim26-screenshot-runner] Local server on http://127.0.0.1:' + port + '\n');

    // Load puppeteer from runner's own node_modules
    const puppeteer = require(puppeteerModulePath);

    // Launch headless Chromium
    // --no-sandbox + --disable-setuid-sandbox: required in CI/Docker
    // --disable-gpu: force software renderer for determinism
    // --disable-dev-shm-usage: prevents crash in low-memory CI environments
    // --disable-background-timer-throttling: prevents render loop starvation
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        `--window-size=${width},${height}`,
      ],
    });

    const page = await browser.newPage();

    // Suppress browser console noise from stderr, but forward to stdout for debugging
    page.on('console', msg => {
      process.stdout.write('[browser-console] ' + msg.type() + ' ' + msg.text() + '\n');
    });
    page.on('pageerror', err => {
      process.stderr.write('[browser-pageerror] ' + err.message + '\n');
    });

    // Fixed viewport — matches requested resolution exactly
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    // Inject manifest + config BEFORE page load via evaluateOnNewDocument
    const config = { width, height, frames, cameraId, fixtureId };
    await page.evaluateOnNewDocument((manifestData, cfg) => {
      window.__SWIM26_MANIFEST__ = manifestData;
      window.__SWIM26_CONFIG__   = cfg;
    }, manifest, config);

    // Navigate to renderer
    const rendererUrl = `http://127.0.0.1:${port}/scene-renderer.html`;
    process.stdout.write('[swim26-screenshot-runner] Navigating to ' + rendererUrl + '\n');
    await page.goto(rendererUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for render completion signal from Babylon render loop
    process.stdout.write('[swim26-screenshot-runner] Waiting for render (timeout=' + renderTimeoutMs + 'ms frames=' + frames + ')\n');
    try {
      await page.waitForFunction(
        () => window.__SWIM26_RENDER_DONE__ === true,
        { timeout: renderTimeoutMs, polling: 100 }
      );
    } catch (timeoutErr) {
      process.stderr.write('[swim26-screenshot-runner] RENDER_ERROR: Render timed out after ' + renderTimeoutMs + 'ms. Babylon.js may have failed to initialize or the render loop stalled.\n');
      process.exit(1);
    }

    // Check for renderer-reported error
    const renderError = await page.evaluate(() => window.__SWIM26_ERROR__);
    if (renderError) {
      process.stderr.write('[swim26-screenshot-runner] RENDER_ERROR: ' + renderError + '\n');
      process.exit(1);
    }

    // Capture framebuffer screenshot
    process.stdout.write('[swim26-screenshot-runner] Capturing screenshot ' + width + 'x' + height + ' → ' + outputPath + '\n');
    await page.screenshot({
      path: outputPath,
      clip: { x: 0, y: 0, width, height },
      type: 'png',
    });

    if (!fs.existsSync(outputPath)) {
      process.stderr.write('[swim26-screenshot-runner] RENDER_ERROR: page.screenshot() completed but output file was not written: ' + outputPath + '\n');
      process.exit(1);
    }

    // Read metadata from page context
    const metadata = await page.evaluate(() => window.__SWIM26_METADATA__);
    if (!metadata) {
      process.stderr.write('[swim26-screenshot-runner] RENDER_ERROR: Renderer did not produce metadata (window.__SWIM26_METADATA__ is not set).\n');
      process.exit(1);
    }

    // Validate required metadata fields
    const requiredFields = ['engine', 'captureMode', 'width', 'height', 'framesRendered'];
    for (const field of requiredFields) {
      if (metadata[field] === undefined || metadata[field] === null) {
        process.stderr.write('[swim26-screenshot-runner] RENDER_ERROR: Metadata is missing required field: ' + field + '\n');
        process.exit(1);
      }
    }

    // Write metadata JSON
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    process.stdout.write('[swim26-screenshot-runner] Metadata written → ' + metadataPath + '\n');

    // Final summary
    process.stdout.write(
      '[swim26-screenshot-runner] OK\n' +
      '[swim26-screenshot-runner] screenshot=' + outputPath + '\n' +
      '[swim26-screenshot-runner] metadata=' + metadataPath + '\n' +
      '[swim26-screenshot-runner] engine=' + metadata.engine + '\n' +
      '[swim26-screenshot-runner] captureMode=' + metadata.captureMode + '\n' +
      '[swim26-screenshot-runner] resolution=' + metadata.width + 'x' + metadata.height + '\n' +
      '[swim26-screenshot-runner] framesRendered=' + metadata.framesRendered + '\n' +
      '[swim26-screenshot-runner] loaderCallsObserved=' + metadata.loaderCallsObserved + '\n' +
      '[swim26-screenshot-runner] usedPlaceholderGeometry=' + metadata.usedPlaceholderGeometry + '\n'
    );

    process.exit(0);

  } catch (err) {
    process.stderr.write('[swim26-screenshot-runner] FATAL: ' + err.message + '\n');
    if (err.stack) {
      process.stderr.write(err.stack + '\n');
    }
    process.exit(1);
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }
    if (server) {
      server.close();
    }
  }
}

main();
