import { Path } from '../types/paths';

export interface SampledPathPoint {
  position: [number, number, number];
  tangent: [number, number, number];
}

interface Segment {
  start: [number, number, number];
  end: [number, number, number];
  length: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const subtract = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

const magnitude = (v: [number, number, number]) => Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);

const normalize = (v: [number, number, number]): [number, number, number] => {
  const length = magnitude(v);
  if (length < 1e-6) return [0, 0, 1];
  return [v[0] / length, v[1] / length, v[2] / length];
};

const lerp = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export function isPathValid(path: Path): boolean {
  return Array.isArray(path.points) && path.points.length >= 2;
}

function toSegments(path: Path): Segment[] {
  const points = path.points.map(p => p.position);
  const segments: Segment[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const length = magnitude(subtract(end, start));
    if (length > 1e-6) segments.push({ start, end, length });
  }

  if (path.closed && points.length > 2) {
    const start = points[points.length - 1];
    const end = points[0];
    const length = magnitude(subtract(end, start));
    if (length > 1e-6) segments.push({ start, end, length });
  }

  return segments;
}

export function getPathLength(path: Path): number {
  if (!isPathValid(path)) return 0;
  return toSegments(path).reduce((acc, s) => acc + s.length, 0);
}

export function samplePathAtDistance(path: Path, distance: number): SampledPathPoint | null {
  if (!isPathValid(path)) return null;

  const segments = toSegments(path);
  if (segments.length === 0) return null;

  const totalLength = segments.reduce((acc, s) => acc + s.length, 0);
  const boundedDistance = clamp(distance, 0, totalLength);

  let travelled = 0;
  for (const segment of segments) {
    const nextTravel = travelled + segment.length;
    if (boundedDistance <= nextTravel) {
      const localDistance = boundedDistance - travelled;
      const t = segment.length === 0 ? 0 : localDistance / segment.length;
      return {
        position: lerp(segment.start, segment.end, t),
        tangent: normalize(subtract(segment.end, segment.start)),
      };
    }
    travelled = nextTravel;
  }

  const last = segments[segments.length - 1];
  return {
    position: last.end,
    tangent: normalize(subtract(last.end, last.start)),
  };
}

export function computePlacementSamples(
  path: Path,
  count: number,
  options?: { spacing?: number; closedLoop?: boolean }
): SampledPathPoint[] {
  const totalLength = getPathLength(path);
  if (count <= 0 || totalLength <= 0) return [];

  const closedLoop = options?.closedLoop ?? path.closed;
  const spacing = options?.spacing;

  const distances: number[] = [];
  if (spacing && spacing > 0) {
    for (let i = 0; i < count; i++) {
      const d = i * spacing;
      distances.push(closedLoop ? d % totalLength : Math.min(d, totalLength));
    }
  } else if (count === 1) {
    distances.push(0);
  } else {
    const step = closedLoop ? totalLength / count : totalLength / (count - 1);
    for (let i = 0; i < count; i++) {
      distances.push(closedLoop ? i * step : Math.min(i * step, totalLength));
    }
  }

  return distances
    .map(distance => samplePathAtDistance(path, distance))
    .filter((sample): sample is SampledPathPoint => sample !== null);
}

export function tangentToYaw(tangent: [number, number, number]): number {
  return Math.atan2(tangent[0], tangent[2]);
}
