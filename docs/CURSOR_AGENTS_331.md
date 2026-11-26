# Cursor 3.31 Agents Window audit (2026-11-25)

Source: [Agents Window 3.31](https://cursor.com/docs/release-notes/agents-window#nov-20-2026) · [IDE 3.31](https://cursor.com/docs/release-notes/ide#nov-20-2026).

## Verdict

Core CDP chat path (`.agent-panel` / `.composer-react-transcript-root` / Stop generation / sidebar history) still matches what we drive. 3.31’s breaking surface is mostly **Projects chrome**, not the main Agent composer.

| 3.31 change | Impact on phone remote | Action taken |
|-------------|------------------------|--------------|
| Tracked task list; Tasks tab | May appear as a right-panel tab | Excluded from Dual-pane file tabs (`Tasks`) |
| Library opens as its own tab | Same | Excluded (`Library`) |
| Pull Requests tab on any agent | Same | Excluded (`Pull Requests`) |
| Coordinators locked to Agent mode | Mode picker missing / empty | Soft note instead of generic “menu empty” |
| Worker Model row in model picker | Extra picker chrome | Rows without model name still filtered; sidebar skip adds `Worker Model` |
| Pinned agents cap 75 | Longer sidebar | No selector change needed |
| Context / books icon | Section chrome | Sidebar skip + tab filter |

## Follow-ups (not blocking)

- Live DOM pass once CDP is up on a Project coordinator chat (confirm Worker Model row DOM).
- P12 ACTION `\b` still open for false “Needs your OK” from status pills.
