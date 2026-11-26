# News Inbox

Auto-collected inbox of news, upstream updates, security fixes, and ideas relevant to this repo, appended daily by News Bot.
A Cursor planning agent should review these items and fold the useful ones into BUILD_PLAN; entries are append-only, newest at the bottom.


## 2026-11-25

**News and updates**

- A High advisory in PhoneBox (GHSA-j6qc-pm3p-fhg7, Nov 20, fixed in 0.9.24) is a pattern worth checking here: while a phone is USB-connected, `adb reverse` can expose the computer's loopback agent API to every app on the phone, not only the companion app, with no extra prompt. Both this repo and Antigravity Remote have an ADB pairing path. This is not a claim that the same bug is present; it is a prompt to confirm pairing traffic is authenticated, pinned, and not reachable by other apps on the device. [PhoneBox advisory](https://github.com/ersinkoc/phonebox/security/advisories/GHSA-j6qc-pm3p-fhg7)

- Cursor 3.31 (Nov 20, Agents Window and IDE) changes the Projects UI: new projects use a tracked task list, Library opens in its own tab, project coordinators stay in Agent mode, worker models can be chosen separately, and the pinned-agents cap rises to 75. cursor-remote-lite drives the desktop Agents Window over CDP, so selector and layout changes can break the phone UI. The marketing changelog page was still on the Nov 6 Voice Chat post, which is why the Nov 20 brief missed this. [Agents Window 3.31](https://cursor.com/docs/release-notes/agents-window#nov-20-2026) · [IDE 3.31](https://cursor.com/docs/release-notes/ide#nov-20-2026)

- Herdr shipped a desktop app that can keep Claude Code and Codex agents alive on a remote machine over SSH, including while the laptop sleeps, and restyle the manager UI from a prompt. Worth a look as a keep-awake / remote-session idea for the self-hosted phone remotes, not a dependency. [Herdr](https://herdr.dev/download) · [Better Stack](https://www.youtube.com/shorts/q2p-0PgwyH0)

**Tasks for the planning agent**

- - [x] Review the USB/ADB pairing path (adb reverse / loopback API) against the PhoneBox GHSA-j6qc-pm3p-fhg7 pattern and document the result — **not affected**; see `SECURITY.md` (2026-11-25). Label: `[AGENT][LOCAL]` · Priority: P2 · https://github.com/ersinkoc/phonebox/security/advisories/GHSA-j6qc-pm3p-fhg7

- - [x] Audit the phone remote against Cursor 3.31 Agents Window / IDE changes — see `docs/CURSOR_AGENTS_331.md` (2026-11-25). Label: `[AGENT][LOCAL]` · Priority: P2 · https://cursor.com/docs/release-notes/agents-window#nov-20-2026

- - [ ] Skim Herdr's desktop keep-alive / SSH remote-session model and note anything useful for this self-hosted phone remote (laptop sleep, side-by-side agent sessions) — inspiration only, not a vendored dependency. Label: `[AGENT][LOCAL]` · Priority: P3 · https://herdr.dev/download

## 2026-11-26

**News and updates**

- Cursor 3.32.4 has been the stable download since about Nov 24 (Cursor's download API returns 3.32.4, commit 0925c4b8), but the release notes still stop at 3.31 (Nov 20). Forum reports list Agents Window beta bugs (@-mentions search only the first workspace root; chats moved from cloud to local disappear). A version bump with no notes can still change the Agents/composer DOM this relay scrapes over CDP, so this extends the 11-25 Cursor 3.31 audit. [download API](https://cursor.com/api/download?platform=linux-x64&releaseTrack=stable) · [release notes](https://cursor.com/docs/release-notes)

**Tasks for the planning agent**

- [x] Re-run the CDP DOM fixtures and smoke test against Cursor 3.32.4 (extend the 3.31 audit in docs/CURSOR_AGENTS_331.md) — 3.32.4 reached the stable channel with no release notes, so selector breaks would be silent. Label: `[AGENT][LOCAL]` · Priority: P2 · https://cursor.com/api/download?platform=linux-x64&releaseTrack=stable (synced to BUILD_PLAN)
