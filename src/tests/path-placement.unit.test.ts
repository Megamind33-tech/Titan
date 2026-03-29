import test from 'node:test';
import assert from 'node:assert/strict';
import { Path } from '../types/paths';
import { computePlacementSamples, getPathLength, isPathValid, samplePathAtDistance, tangentToYaw } from '../utils/pathPlacement';

const openPath: Path = {
  id: 'p-open',
  name: 'Open',
  points: [
    { id: 'a', position: [0, 0, 0] },
    { id: 'b', position: [10, 0, 0] },
  ],
  closed: false,
  type: 'walkway',
  width: 1,
};

const closedTriangle: Path = {
  id: 'p-closed',
  name: 'Closed',
  points: [
    { id: 'a', position: [0, 0, 0] },
    { id: 'b', position: [10, 0, 0] },
    { id: 'c', position: [10, 0, 10] },
  ],
  closed: true,
  type: 'walkway',
  width: 1,
};

test('isPathValid enforces minimum point count', () => {
  assert.equal(isPathValid({ ...openPath, points: [openPath.points[0]] }), false);
  assert.equal(isPathValid(openPath), true);
});

test('getPathLength computes expected length', () => {
  assert.equal(getPathLength(openPath), 10);
});

test('samplePathAtDistance returns expected position and clamps at bounds', () => {
  assert.deepEqual(samplePathAtDistance(openPath, 5)?.position, [5, 0, 0]);
  assert.deepEqual(samplePathAtDistance(openPath, -10)?.position, [0, 0, 0]);
  assert.deepEqual(samplePathAtDistance(openPath, 100)?.position, [10, 0, 0]);
});

test('computePlacementSamples distributes on open paths and supports spacing + closed loop', () => {
  const openSamples = computePlacementSamples(openPath, 3);
  assert.equal(openSamples.length, 3);
  assert.deepEqual(openSamples[0].position, [0, 0, 0]);
  assert.deepEqual(openSamples[1].position, [5, 0, 0]);
  assert.deepEqual(openSamples[2].position, [10, 0, 0]);

  const spaced = computePlacementSamples(openPath, 3, { spacing: 3 });
  assert.deepEqual(spaced.map(s => s.position), [[0, 0, 0], [3, 0, 0], [6, 0, 0]]);

  const closed = computePlacementSamples(closedTriangle, 4, { spacing: 10, closedLoop: true });
  assert.equal(closed.length, 4);
  assert.deepEqual(closed[0].position, [0, 0, 0]);
  assert.deepEqual(closed[1].position, [10, 0, 0]);
});

test('computePlacementSamples handles count=1 and degenerate/repeated-point paths safely', () => {
  const one = computePlacementSamples(openPath, 1);
  assert.equal(one.length, 1);
  assert.deepEqual(one[0].position, [0, 0, 0]);

  const degenerate: Path = {
    ...openPath,
    id: 'degenerate',
    points: [
      { id: 'x', position: [0, 0, 0] },
      { id: 'y', position: [0, 0, 0] },
    ],
  };
  assert.equal(getPathLength(degenerate), 0);
  assert.equal(samplePathAtDistance(degenerate, 1), null);
  assert.deepEqual(computePlacementSamples(degenerate, 3), []);
});

test('tangentToYaw maps simple tangents correctly', () => {
  assert.equal(tangentToYaw([0, 0, 1]), 0);
  assert.equal(tangentToYaw([1, 0, 0]), Math.PI / 2);
  assert.equal(tangentToYaw([-1, 0, 0]), -Math.PI / 2);
});
