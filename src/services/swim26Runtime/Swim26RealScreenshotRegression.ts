import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';
import { runSwim26HostVerification, Swim26BabylonHost } from './Swim26BabylonHostVerifier';

export interface Swim26ScreenshotFixture {
  id: string;
  manifestPath: string;
}

export interface Swim26ScreenshotCaptureResult {
  ok: boolean;
  blocked?: boolean;
  blockedReason?: string;
  screenshotPath?: string;
  metadataPath?: string;
  metadata?: {
    engine: string;
    captureMode: 'framebuffer' | 'canvas' | 'unknown';
    width: number;
    height: number;
    framesRendered: number;
    deterministicCameraId?: string;
    loaderCallsObserved?: number;
  };
  stderr?: string;
  stdout?: string;
}

export type Swim26ScreenshotCapture = (input: {
  fixture: Swim26ScreenshotFixture;
  outputPath: string;
}) => Promise<Swim26ScreenshotCaptureResult>;

export interface Swim26RealScreenshotRegressionResult {
  fixtureId: string;
  hostPass: boolean;
  usedEngineLoaderPath: boolean;
  screenshotPass: boolean;
  fullPass: boolean;
  blocked: boolean;
  blockedReason?: string;
  similarity: number;
  changedPixels: number;
  totalPixels: number;
  baselinePath: string;
  actualPath: string;
  diffImagePath: string;
  diffPath: string;
  reasons: string[];
}

const decodePngRgba = (png: Buffer): { width: number; height: number; rgba: Buffer } => {
  const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!png.subarray(0, 8).equals(pngHeader)) throw new Error('Not a PNG file.');

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idat: Buffer[] = [];

  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset); offset += 4;
    const type = png.subarray(offset, offset + 4).toString('ascii'); offset += 4;
    const data = png.subarray(offset, offset + length); offset += length;
    offset += 4; // crc

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8 || ![6, 2, 4, 0].includes(colorType)) {
        throw new Error(`Unsupported PNG format for diffing (bitDepth=${bitDepth}, colorType=${colorType}).`);
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!width || !height || idat.length === 0) throw new Error('PNG missing required chunks.');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let src = 0;
  let dst = 0;
  let prev = Buffer.alloc(stride, 0);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[src]; src += 1;
    const line = Buffer.from(raw.subarray(src, src + stride)); src += stride;
    if (filter === 1) {
      for (let i = 0; i < stride; i += 1) {
        const left = i >= 4 ? line[i - 4] : 0;
        line[i] = (line[i] + left) & 255;
      }
    } else if (filter === 2) {
      for (let i = 0; i < stride; i += 1) {
        line[i] = (line[i] + prev[i]) & 255;
      }
    } else if (filter === 3) {
      for (let i = 0; i < stride; i += 1) {
        const left = i >= 4 ? line[i - 4] : 0;
        const up = prev[i];
        line[i] = (line[i] + Math.floor((left + up) / 2)) & 255;
      }
    } else if (filter === 4) {
      const paeth = (a: number, b: number, c: number): number => {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        if (pa <= pb && pa <= pc) return a;
        if (pb <= pc) return b;
        return c;
      };
      for (let i = 0; i < stride; i += 1) {
        const left = i >= 4 ? line[i - 4] : 0;
        const up = prev[i];
        const upLeft = i >= 4 ? prev[i - 4] : 0;
        line[i] = (line[i] + paeth(left, up, upLeft)) & 255;
      }
    } else if (filter !== 0) {
      throw new Error(`Unsupported PNG filter type: ${filter}`);
    }
    for (let px = 0; px < width; px += 1) {
      const srcIdx = px * channels;
      const dstIdx = dst + (px * 4);
      if (colorType === 6) {
        out[dstIdx] = line[srcIdx];
        out[dstIdx + 1] = line[srcIdx + 1];
        out[dstIdx + 2] = line[srcIdx + 2];
        out[dstIdx + 3] = line[srcIdx + 3];
      } else if (colorType === 2) {
        out[dstIdx] = line[srcIdx];
        out[dstIdx + 1] = line[srcIdx + 1];
        out[dstIdx + 2] = line[srcIdx + 2];
        out[dstIdx + 3] = 255;
      } else if (colorType === 4) {
        out[dstIdx] = line[srcIdx];
        out[dstIdx + 1] = line[srcIdx];
        out[dstIdx + 2] = line[srcIdx];
        out[dstIdx + 3] = line[srcIdx + 1];
      } else {
        out[dstIdx] = line[srcIdx];
        out[dstIdx + 1] = line[srcIdx];
        out[dstIdx + 2] = line[srcIdx];
        out[dstIdx + 3] = 255;
      }
    }
    prev = line;
    dst += width * 4;
  }

  return { width, height, rgba: out };
};

const writePpm = (input: { width: number; height: number; rgb: Buffer; outputPath: string }): void => {
  const header = Buffer.from(`P6\n${input.width} ${input.height}\n255\n`, 'ascii');
  fs.writeFileSync(input.outputPath, Buffer.concat([header, input.rgb]));
};

const compareRgba = (input: {
  baseline: { width: number; height: number; rgba: Buffer };
  actual: { width: number; height: number; rgba: Buffer };
  perChannelTolerance: number;
}): { similarity: number; changedPixels: number; totalPixels: number; diffRgb: Buffer } => {
  if (input.baseline.width !== input.actual.width || input.baseline.height !== input.actual.height) {
    return {
      similarity: 0,
      changedPixels: input.actual.width * input.actual.height,
      totalPixels: input.actual.width * input.actual.height,
      diffRgb: Buffer.alloc(input.actual.width * input.actual.height * 3, 255),
    };
  }
  const totalPixels = input.actual.width * input.actual.height;
  let changedPixels = 0;
  const diffRgb = Buffer.alloc(totalPixels * 3);
  for (let i = 0; i < totalPixels; i += 1) {
    const bi = i * 4;
    const r = Math.abs(input.actual.rgba[bi] - input.baseline.rgba[bi]);
    const g = Math.abs(input.actual.rgba[bi + 1] - input.baseline.rgba[bi + 1]);
    const b = Math.abs(input.actual.rgba[bi + 2] - input.baseline.rgba[bi + 2]);
    const changed = r > input.perChannelTolerance || g > input.perChannelTolerance || b > input.perChannelTolerance;
    if (changed) {
      changedPixels += 1;
      diffRgb[i * 3] = 255;
      diffRgb[i * 3 + 1] = 0;
      diffRgb[i * 3 + 2] = 0;
    } else {
      diffRgb[i * 3] = 32;
      diffRgb[i * 3 + 1] = 32;
      diffRgb[i * 3 + 2] = 32;
    }
  }
  return { similarity: 1 - (changedPixels / totalPixels), changedPixels, totalPixels, diffRgb };
};

// Maximum time to wait for the external screenshot runner before treating it
// as a hung process.  2 minutes is generous for a headless Chromium render.
const RUNNER_TIMEOUT_MS = 120_000;

export const createExternalBabylonScreenshotCapture = (): Swim26ScreenshotCapture => async ({ fixture, outputPath }) => {
  const command = process.env.SWIM26_REAL_SCREENSHOT_CMD;
  if (!command) {
    return {
      ok: false,
      blocked: true,
      blockedReason: 'SWIM26_REAL_SCREENSHOT_CMD is not set. Provide a command that renders fixture manifests in a real Babylon environment and writes PNG output.',
    };
  }

  // SWIM26_REAL_SCREENSHOT_CMD is split on whitespace to extract cmd + base args.
  // Limitation: paths with spaces in the command string will break this split.
  // If your runner path contains spaces, wrap it in a shell script with no spaces
  // in its path, or set SWIM26_REAL_SCREENSHOT_CMD to a wrapper script path.
  const [cmd, ...baseArgs] = command.trim().split(/\s+/).filter(Boolean);
  // Derive the metadata path from the output path.  outputPath must end in .png.
  // If it does not, the metadata path will have '.capture.json' appended, which
  // is unusual but harmless — the runner receives --metadata explicitly.
  const metadataPath = /\.png$/i.test(outputPath)
    ? outputPath.replace(/\.png$/i, '.capture.json')
    : outputPath + '.capture.json';
  const proc = spawnSync(cmd, [...baseArgs, '--manifest', fixture.manifestPath, '--output', outputPath, '--metadata', metadataPath], {
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: RUNNER_TIMEOUT_MS,
  });

  // proc.error is set if spawnSync itself failed (e.g. command not found, timeout).
  if (proc.error) {
    const isTimeout = proc.error.message.includes('ETIMEDOUT') || proc.error.message.includes('timeout');
    return {
      ok: false,
      blocked: true,
      blockedReason: isTimeout
        ? `External screenshot runner timed out after ${RUNNER_TIMEOUT_MS / 1000}s. Check that the runner is installed and the render environment is available.`
        : `External screenshot runner could not be started: ${proc.error.message}`,
      stderr: proc.stderr?.trim(),
      stdout: proc.stdout?.trim(),
    };
  }

  if (proc.status !== 0) {
    const stderr = proc.stderr?.trim() ?? '';
    // Exit code 3 and stderr containing BLOCKED_ENV: are the runner's explicit
    // blocked-environment signals.  Exit 1 is a render failure — the environment
    // is present but rendering broke.  These must not be conflated: blocked means
    // "no framebuffer was possible", failed means "framebuffer was possible but failed."
    const isBlockedEnv = proc.status === 3 || stderr.includes('BLOCKED_ENV:');
    const blockedLine = isBlockedEnv
      ? (stderr.split('\n').find(l => l.includes('BLOCKED_ENV:')) ?? stderr)
      : null;
    return {
      ok: false,
      blocked: isBlockedEnv,
      blockedReason: isBlockedEnv
        ? `External runner reported blocked environment (exit ${proc.status}): ${blockedLine}`
        : `External Babylon screenshot command failed (exit ${proc.status}). See stderr in diff artifact.`,
      stderr,
      stdout: proc.stdout?.trim(),
    };
  }

  if (!fs.existsSync(outputPath)) {
    return {
      ok: false,
      blocked: false,
      blockedReason: 'External Babylon screenshot command completed without producing the expected output file.',
      stdout: proc.stdout?.trim(),
      stderr: proc.stderr?.trim(),
    };
  }

  let metadata: Swim26ScreenshotCaptureResult['metadata'] | undefined;
  if (fs.existsSync(metadataPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    } catch {
      // keep metadata undefined; validated downstream as a reason.
    }
  }

  return { ok: true, screenshotPath: outputPath, metadataPath, metadata, stdout: proc.stdout?.trim(), stderr: proc.stderr?.trim() };
};

export const runSwim26RealScreenshotRegression = async (input: {
  hostFactory: () => Swim26BabylonHost;
  fixtures: Swim26ScreenshotFixture[];
  baselineDir: string;
  outputDir: string;
  threshold?: number;
  perChannelTolerance?: number;
  requireFramebufferCapture?: boolean;
  expectedResolution?: { width: number; height: number };
  minFramesRendered?: number;
  capture?: Swim26ScreenshotCapture;
}): Promise<Swim26RealScreenshotRegressionResult[]> => {
  const threshold = input.threshold ?? 0.995;
  const perChannelTolerance = input.perChannelTolerance ?? 6;
  const requireFramebufferCapture = input.requireFramebufferCapture ?? true;
  const minFramesRendered = input.minFramesRendered ?? 1;
  const capture = input.capture ?? createExternalBabylonScreenshotCapture();
  fs.mkdirSync(input.outputDir, { recursive: true });

  const results: Swim26RealScreenshotRegressionResult[] = [];

  for (const fixture of input.fixtures) {
    const manifest = fs.readFileSync(fixture.manifestPath, 'utf-8');
    const hostResult = await runSwim26HostVerification({ host: input.hostFactory(), manifest });

    const actualPath = path.join(input.outputDir, `${fixture.id}.png`);
    const baselinePath = path.join(input.baselineDir, `${fixture.id}.png`);
    const diffPath = path.join(input.outputDir, `${fixture.id}.real.diff.json`);
    const diffImagePath = path.join(input.outputDir, `${fixture.id}.real.diff.ppm`);
    const reasons: string[] = [];

    if (!hostResult.pass) reasons.push('Host verification did not pass.');
    if (!hostResult.usedEngineLoaderPath) reasons.push('No SceneLoader engine loader evidence was recorded.');

    const captureResult = await capture({ fixture, outputPath: actualPath });
    let screenshotPass = false;
    let blocked = false;
    let blockedReason: string | undefined;
    let similarity = 0;
    let changedPixels = 0;
    let totalPixels = 0;

    if (!captureResult.ok) {
      blocked = Boolean(captureResult.blocked);
      blockedReason = captureResult.blockedReason;
      if (blockedReason) reasons.push(blockedReason);
    } else if (!fs.existsSync(baselinePath)) {
      reasons.push('Real screenshot baseline is missing.');
    } else {
      if (requireFramebufferCapture && captureResult.metadata?.captureMode !== 'framebuffer') {
        reasons.push('Capture metadata does not prove framebuffer-based capture.');
      }
      if (!captureResult.metadata) {
        reasons.push('Capture metadata is missing; deterministic capture settings cannot be verified.');
      } else {
        if (captureResult.metadata.framesRendered < minFramesRendered) reasons.push('Capture rendered too few frames for stable output.');
        if (input.expectedResolution && (
          captureResult.metadata.width !== input.expectedResolution.width
          || captureResult.metadata.height !== input.expectedResolution.height
        )) {
          reasons.push(`Capture resolution ${captureResult.metadata.width}x${captureResult.metadata.height} does not match expected ${input.expectedResolution.width}x${input.expectedResolution.height}.`);
        }
      }

      const baselineRgba = decodePngRgba(fs.readFileSync(baselinePath));
      const actualRgba = decodePngRgba(fs.readFileSync(actualPath));
      const compared = compareRgba({ baseline: baselineRgba, actual: actualRgba, perChannelTolerance });
      similarity = compared.similarity;
      changedPixels = compared.changedPixels;
      totalPixels = compared.totalPixels;
      writePpm({ width: actualRgba.width, height: actualRgba.height, rgb: compared.diffRgb, outputPath: diffImagePath });

      if (similarity < threshold) {
        reasons.push(`Screenshot similarity ${similarity.toFixed(4)} is below threshold ${threshold.toFixed(4)}.`);
      } else {
        screenshotPass = true;
      }
    }

    const fullPass = hostResult.pass && hostResult.usedEngineLoaderPath && screenshotPass;

    fs.writeFileSync(diffPath, JSON.stringify({
      fixtureId: fixture.id,
      threshold,
      hostVerification: {
        pass: hostResult.pass,
        status: hostResult.status,
        usedEngineLoaderPath: hostResult.usedEngineLoaderPath,
        loaderCalls: hostResult.loaderCalls,
        diagnosticSummary: hostResult.diagnosticSummary,
      },
      screenshot: {
        pass: screenshotPass,
        blocked,
        blockedReason,
        similarity,
        changedPixels,
        totalPixels,
        perChannelTolerance,
        baselinePath,
        actualPath,
        diffImagePath,
        metadata: captureResult.metadata,
        metadataPath: captureResult.metadataPath,
      },
      reasons,
      stdout: captureResult.stdout,
      stderr: captureResult.stderr,
    }, null, 2), 'utf-8');

    results.push({
      fixtureId: fixture.id,
      hostPass: hostResult.pass,
      usedEngineLoaderPath: hostResult.usedEngineLoaderPath,
      screenshotPass,
      fullPass,
      blocked,
      blockedReason,
      similarity,
      changedPixels,
      totalPixels,
      baselinePath,
      actualPath,
      diffImagePath,
      diffPath,
      reasons,
    });
  }

  return results;
};
