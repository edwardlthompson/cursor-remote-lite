import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, '..', 'app', 'index.html'), 'utf8');
const plan = fs.readFileSync(path.join(root, '..', 'BUILD_PLAN.md'), 'utf8');

/** Evaluate the inlined renderMarkdown from index.html in isolation. */
function loadRenderMarkdown() {
  const m = html.match(/function renderMarkdown\(src\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'renderMarkdown function present');
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // eslint-disable-next-line no-new-func
  return new Function('esc', `${m[0]}; return renderMarkdown;`)(esc);
}

test('md-preview overrides pre-wrap from code pane', () => {
  assert.match(html, /#paneDiffBody\.md-preview[\s\S]*?white-space:\s*normal/);
});

test('renderMarkdown strips HTML comments used by BUILD_PLAN sync markers', () => {
  const renderMarkdown = loadRenderMarkdown();
  const out = renderMarkdown('Hello\n<!-- remaining-tally -->\n**Hi**\n<!-- /remaining-tally -->\n');
  assert.doesNotMatch(out, /&lt;!--/);
  assert.doesNotMatch(out, /remaining-tally/);
  assert.match(out, /<strong>Hi<\/strong>/);
});

test('renderMarkdown handles BUILD_PLAN features', () => {
  const renderMarkdown = loadRenderMarkdown();
  const out = renderMarkdown(plan);
  assert.doesNotMatch(out, /&lt;!--/);
  assert.match(out, /<h1>Build Plan<\/h1>/);
  assert.match(out, /<h2>Parked|<h2>Sprint|<h2>Archive|<h2>Product/);
  assert.match(out, /href="https:\/\/github\.com\/edwardlthompson\/agent-project-bootstrap"/);
  assert.match(out, /data-md-path="docs\/help\/BATCH_COMMANDS\.md"/);
  assert.match(out, /data-md-path="docs\/GAP_LIST\.md"/);
  assert.match(out, /COMPLETED_TASKS\.md/);
  assert.match(out, /<hr>/);
  assert.match(out, /<code>AGENT<\/code>/);
  assert.match(out, /<table>/);
  assert.match(out, /local-agent-lane|Local agent/);
});

test('renderMarkdown supports fenced code and task lists', () => {
  const renderMarkdown = loadRenderMarkdown();
  const out = renderMarkdown('```js\nconst x = 1;\n```\n\n- [x] done\n- [ ] todo\n');
  assert.match(out, /<pre><code class="lang-js">/);
  assert.match(out, /md-task on/);
  assert.match(out, /md-task"/);
});
