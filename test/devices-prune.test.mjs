import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionStaleDevices } from '../auth.mjs';

test('partitionStaleDevices keeps recent and drops old lastSeen', () => {
  const now = 1_700_000_000_000;
  const day = 24 * 60 * 60 * 1000;
  const { kept, removed } = partitionStaleDevices(
    [
      { id: 'new', lastSeen: now - 10 * day },
      { id: 'old', lastSeen: now - 100 * day },
      { id: 'ancient', created: now - 200 * day },
    ],
    90 * day,
    now,
  );
  assert.deepEqual(removed.sort(), ['ancient', 'old']);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, 'new');
});

test('partitionStaleDevices keeps devices with no timestamps', () => {
  const { kept, removed } = partitionStaleDevices([{ id: 'x' }], 1, Date.now());
  assert.equal(removed.length, 0);
  assert.equal(kept[0].id, 'x');
});
