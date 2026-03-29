import fs from 'node:fs';
import path from 'node:path';
import { Swim26BabylonHost, runSwim26HostVerification } from './Swim26BabylonHostVerifier';
import { renderRuntimeVerificationSvg } from './Swim26RenderedVerificationHarness';

export interface Swim26VisualRegressionResult {
  fixtureId: string;
  pass: boolean;
  similarity: number;
  hostPass: boolean;
  usedEngineLoaderPath: boolean;
  baselinePath: string;
  actualPath: string;
  diffPath: string;
  reasons: string[];
}

const normalizeSvg = (svg: string): string => (
  svg
    .replace(/\r\n/g, '\n')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim()
);

const tokenizeSvg = (svg: string): string[] => (
  svg
    .replace(/[<>]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
);

const jaccardSimilarity = (a: string, b: string): number => {
  const setA = new Set(tokenizeSvg(normalizeSvg(a)));
  const setB = new Set(tokenizeSvg(normalizeSvg(b)));
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set(Array.from(setA).filter(token => setB.has(token)));
  const union = new Set([...Array.from(setA), ...Array.from(setB)]);
  return union.size === 0 ? 1 : intersection.size / union.size;
};

export const runSwim26VisualRegression = async (input: {
  hostFactory: () => Swim26BabylonHost;
  fixtures: Array<{ id: string; manifestPath: string }>;
  baselineDir: string;
  outputDir: string;
  threshold?: number;
}): Promise<Swim26VisualRegressionResult[]> => {
  const threshold = input.threshold ?? 0.995;
  fs.mkdirSync(input.outputDir, { recursive: true });
  const results: Swim26VisualRegressionResult[] = [];

  for (const fixture of input.fixtures) {
    const manifest = fs.readFileSync(fixture.manifestPath, 'utf-8');
    const host = input.hostFactory();
    const hostResult = await runSwim26HostVerification({ host, manifest });
    const actualSvg = renderRuntimeVerificationSvg(hostResult.visible);
    const actualPath = path.join(input.outputDir, `${fixture.id}.svg`);
    fs.writeFileSync(actualPath, actualSvg, 'utf-8');

    const baselinePath = path.join(input.baselineDir, `${fixture.id}.svg`);
    const baselineSvg = fs.existsSync(baselinePath) ? fs.readFileSync(baselinePath, 'utf-8') : '';
    const similarity = jaccardSimilarity(actualSvg, baselineSvg);
    const reasons: string[] = [];
    if (!hostResult.pass) reasons.push('Host verification did not pass.');
    if (!hostResult.usedEngineLoaderPath) reasons.push('No SceneLoader calls were observed in host telemetry.');
    if (baselineSvg.length === 0) reasons.push('Baseline image is missing.');
    if (baselineSvg.length > 0 && similarity < threshold) reasons.push(`Similarity ${similarity.toFixed(4)} is below threshold ${threshold.toFixed(4)}.`);
    const pass = reasons.length === 0;

    const baselineTokens = new Set(tokenizeSvg(normalizeSvg(baselineSvg)));
    const actualTokens = new Set(tokenizeSvg(normalizeSvg(actualSvg)));
    const missingFromActual = Array.from(baselineTokens).filter(token => !actualTokens.has(token)).slice(0, 24);
    const introducedInActual = Array.from(actualTokens).filter(token => !baselineTokens.has(token)).slice(0, 24);
    const diffPath = path.join(input.outputDir, `${fixture.id}.diff.json`);
    fs.writeFileSync(diffPath, JSON.stringify({
      fixtureId: fixture.id,
      threshold,
      similarity,
      pass,
      reasons,
      hostVerification: {
        pass: hostResult.pass,
        status: hostResult.status,
        usedEngineLoaderPath: hostResult.usedEngineLoaderPath,
        loaderCalls: hostResult.loaderCalls,
        diagnosticSummary: hostResult.diagnosticSummary,
      },
      baselinePath,
      actualPath,
      tokenDelta: {
        missingFromActual,
        introducedInActual,
      },
    }, null, 2), 'utf-8');

    results.push({
      fixtureId: fixture.id,
      pass,
      similarity,
      hostPass: hostResult.pass,
      usedEngineLoaderPath: hostResult.usedEngineLoaderPath,
      baselinePath,
      actualPath,
      diffPath,
      reasons,
    });
  }

  return results;
};
