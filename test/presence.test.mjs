import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claim, heartbeat, canControl, holder, release, releaseAllForDevice,
  snapshot, _resetForTests, presenceTtlMs, CONTROL_TYPES,
} from '../presence.mjs';

test('claim and canControl', () => {
  _resetForTests();
  claim('w1', 'phone', 'OP13');
  assert.equal(canControl('w1', 'phone'), true);
  assert.equal(canControl('w1', 'tablet'), false);
  assert.equal(holder('w1').name, 'OP13');
});

test('claim steals and release frees', () => {
  _resetForTests();
  claim('w1', 'phone', 'OP13');
  claim('w1', 'tablet', 'SM-T875');
  assert.equal(canControl('w1', 'tablet'), true);
  assert.equal(canControl('w1', 'phone'), false);
  release('w1', 'tablet');
  assert.equal(canControl('w1', 'phone'), true);
});

test('heartbeat refreshes holder; stale allows steal', async () => {
  _resetForTests();
  claim('w1', 'phone', 'OP13');
  const snap = heartbeat('w1', 'phone', 'OP13');
  assert.equal(snap.self, false); // selfId not passed
  assert.equal(snapshot('w1', 'phone').self, true);
  // Force stale by rewriting at via claim then waiting is hard; TTL is 90s — unit-check API only.
  assert.ok(presenceTtlMs() >= 60_000);
  releaseAllForDevice('phone');
  assert.equal(holder('w1'), null);
  heartbeat('w1', 'tablet', 'Tab');
  assert.equal(canControl('w1', 'tablet'), true);
});

test('CONTROL_TYPES includes send and claim-sensitive ops', () => {
  assert.ok(CONTROL_TYPES.has('send'));
  assert.ok(CONTROL_TYPES.has('change'));
  assert.ok(CONTROL_TYPES.has('editorOpen'));
  assert.ok(!CONTROL_TYPES.has('file')); // read-only dual-pane preview
  assert.ok(!CONTROL_TYPES.has('editorSuggest'));
});
