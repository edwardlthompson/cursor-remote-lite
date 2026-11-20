#!/usr/bin/env node
/**
 * Child-scoped BUILD_PLAN sprint status (no parent check-*.sh farm).
 * Usage: node scripts/build-sprint-status.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const JSON_OUT = process.argv.includes('--json');

const ROW = /^-\s*(🔲|⏸|✅|❌)\s*\[(AGENT|AUTO|HUMAN|ADB)\](?:\[(LOCAL|CLOUD)\])?\s*(.+)$/;

function parseRows(text) {
  const rows = [];
  let sprint = '';
  for (const line of text.split(/\r?\n/)) {
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      sprint = h[1].trim();
      continue;
    }
    const m = ROW.exec(line.trim());
    if (!m) continue;
    const [, state, owner, venue, task] = m;
    rows.push({
      state,
      owner,
      venue: venue || null,
      task: task.trim(),
      sprint,
      open: state === '🔲',
      parked: state === '⏸',
    });
  }
  return rows;
}

function main() {
  const planPath = path.join(ROOT, 'BUILD_PLAN.md');
  if (!fs.existsSync(planPath)) {
    console.error('FAIL: BUILD_PLAN.md missing');
    process.exit(1);
  }
  const text = fs.readFileSync(planPath, 'utf8');
  const rows = parseRows(text);
  const open = rows.filter(r => r.open && (r.owner === 'AGENT' || r.owner === 'AUTO'));
  const parked = rows.filter(r => r.parked);
  const next = open[0] || null;
  const payload = {
    open_agent_auto: open.length,
    parked: parked.length,
    next_row: next
      ? {
          owner: next.owner,
          venue: next.venue,
          task: next.task,
          sprint: next.sprint,
          action: next.owner === 'AUTO' ? 'automate' : 'execute',
        }
      : null,
    action: next ? (next.owner === 'AUTO' ? 'automate' : 'execute') : 'idle',
    sprint_complete: open.length === 0,
  };
  if (JSON_OUT) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`BUILD_PLAN: open AGENT/AUTO=${payload.open_agent_auto} parked=${payload.parked}`);
  if (!next) {
    console.log('Next: (idle — no open AGENT/AUTO rows)');
    return;
  }
  console.log(`Next: [${next.owner}]${next.venue ? '[' + next.venue + ']' : ''} ${next.task}`);
  console.log(`Sprint: ${next.sprint || '(none)'}`);
  console.log(`Action: ${payload.action}`);
}

main();
