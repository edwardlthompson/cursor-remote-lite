// Per-window control lock so phone + tablet do not fight over Approve / Send.
const TTL_MS = 90_000;

/** @type {Map<string, { deviceId: string, name: string, at: number }>} */
const locks = new Map();

export function presenceTtlMs() {
  return TTL_MS;
}

function touch(winId, deviceId, name) {
  if (!winId || !deviceId) return null;
  locks.set(winId, { deviceId, name: name || 'Device', at: Date.now() });
  return snapshot(winId);
}

export function claim(winId, deviceId, name) {
  return touch(winId, deviceId, name);
}

export function release(winId, deviceId) {
  const cur = locks.get(winId);
  if (cur && cur.deviceId === deviceId) locks.delete(winId);
}

export function releaseAllForDevice(deviceId) {
  for (const [winId, cur] of locks) {
    if (cur.deviceId === deviceId) locks.delete(winId);
  }
}

export function heartbeat(winId, deviceId, name) {
  const cur = locks.get(winId);
  if (!cur) return touch(winId, deviceId, name);
  if (cur.deviceId === deviceId) {
    cur.at = Date.now();
    if (name) cur.name = name;
    return snapshot(winId);
  }
  // Stale holder → steal quietly.
  if (Date.now() - cur.at > TTL_MS) return touch(winId, deviceId, name);
  return snapshot(winId);
}

export function holder(winId) {
  const cur = locks.get(winId);
  if (!cur) return null;
  if (Date.now() - cur.at > TTL_MS) {
    locks.delete(winId);
    return null;
  }
  return { ...cur };
}

export function canControl(winId, deviceId) {
  const h = holder(winId);
  if (!h) return true;
  return h.deviceId === deviceId;
}

/** Mutating commands that require the active-viewer lock. */
export const CONTROL_TYPES = new Set([
  'send', 'type', 'image', 'click', 'queue', 'stop', 'subagent', 'question',
  'change', 'changes', 'pickMenu', 'openMenu', 'toggleMax', 'params', 'pickParam',
  'newChat', 'tap', 'key', 'wheel', 'file', 'mainChat', 'scrollChat', 'diff',
  'clipboard', // push only; pull is allowed without lock in handle()
]);

export function snapshot(winId, selfId = null) {
  const h = holder(winId);
  return {
    win: winId || '',
    holder: h?.deviceId || null,
    holderName: h?.name || null,
    self: Boolean(selfId && h && h.deviceId === selfId),
    locked: Boolean(h),
  };
}

export function allSnapshots() {
  const out = {};
  for (const winId of locks.keys()) {
    const s = snapshot(winId);
    if (s.holder) out[winId] = s;
  }
  return out;
}

/** Test helper */
export function _resetForTests() {
  locks.clear();
}
