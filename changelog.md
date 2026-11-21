# Changelog

Code changes are grouped between recorded deployments and ordered by type
(features, fixes, then other code changes), with higher-impact changes first within
each type. Documentation
commits are excluded from these public release notes. Pending sections
are marked until deployment is confirmed. Deployment names increment as
**Alpha - Update 1**, **Alpha - Update 2**, and so on.

## Alpha - Update 2 — Pending

### Features

- 41f0211 — feat: accept username aliases in profile URLs.

### Fixes

- fix: sort completed bounties by completion date.
- 927bf91 — fix: show profile logout button only to the profile owner.
- f69c6d2 — fix: suppress Discord embeds in achievement sharing.

## Alpha - Update 1 — 2026-11-21

### Features

- f89a0fb — feat: increase daily reward to 100 BP.
- ed5e688 — feat: increase hunting slots to three.
- 7c54066 — feat: shorten settlement window to ten seconds.
- 23e98f8 — feat: show contextual bounty status and winner sharing.
- 8496332 — feat: show username and BP balance in navbar profile card.
- 89b156a — feat: add copy beatmap ID action to bounty details.
- 15c8285 — feat: add osu avatar to navbar profile card.
- b9ab20e — feat: add icons to bounty board relationship filters.

### Fixes

- 9746bd0 — fix: open creation help link in a new tab.
- 9863f45 — fix: use readable source permissions during deployment.
- a36b100 — fix: wrap profile hunting slots in a responsive grid.
- 416bcfe — fix: skip wizard authentication step for signed-in users.
- 25b85b3 — fix: restore wiki anchor scrolling after access checks.
- dfa4dce — fix: align funding button with bounty actions.
- 9fd81de — fix: stretch profile summary cards on mobile.
- ec10657 — fix: center mobile navigation and stretch profile card.
- cf4b29e — fix: show blocked cursor on disabled bounty filters.

### Refactoring

- c27a2a2 — refactor: extract reusable text copy component.

## Alpha — Initial release (2026-11-20)

Deployment reported by the user through `c9d65fb`. This is the starting baseline
for this changelog; earlier commits are not enumerated here.
