# Changelog

Code changes are grouped between recorded deployments and ordered by type
(features, fixes, then other code changes), with higher-impact changes first within
each type. Documentation
commits are excluded from these public release notes. Pending sections
are marked until deployment is confirmed. Deployment names increment as
**Alpha - Update 1**, **Alpha - Update 2**, and so on.

## Alpha - Update 3 — Pending

### Features

- 761e76d — feat: add optional minimum grade requirements to Pass and Full-Combo bounties.
- 4df8521 — feat: choose required and forbidden mods individually, with an exact-mods option.
- cdbdd4c — feat: hunt and bookmark directly from bounty cards, with synchronized action states and viewer-specific bookmark indicators.
- c621303 — feat: require confirmation before cancelling a bounty, with a reminder of principal refunds and nonrefundable fees.
- e1907ee — feat: show remaining hunting slots and available/used target stamps beside the navbar user card.
- b4f2159 — feat: show Completed and Cancelled status badges alongside bounty card requirements.

### Fixes

- f35012e — fix: hide the extra-mod indicator when no compatible additional mods are available.
- dc0ecf1 — fix: use higher-resolution beatmap covers when available.
- 82aef4c — fix: stack Goal and Mods sections on separate rows on mobile bounty details.

### Styles

- style: add icons to navbar links and bounty board status filters, with responsive navbar spacing.
- 0522726 — style: show one faint background stamp per hunter at stable scattered positions on bounty cards.
- 08a142f — style: remove the redundant status banner from bounty details.
- fa52bad — style: refine creation goal buttons and guidance, mod controls, and responsive reward layout.
- 2ac474b — style: replace bounty card tier badges with tier-colored borders and a subtle inner glow, with a rainbow treatment for Phantasm.
- 23308d0 — style: simplify bounty card requirement badges and enlarge mod and grade icons.

## Alpha - Update 2 — 2026-11-23

### Features

- 2190b6c — feat: combine bounty creation into a single page.
- 5226f9d — feat: show each player's total contribution in the bounty Funding tab.
- 769163f — feat: filter the bounty board by your ongoing hunts.
- fa4d1ec — feat: default bounty board sorting to ongoing hunts.
- 8f84abc — feat: show ongoing hunt counts on bounties.
- 41f0211 — feat: accept username aliases in profile URLs.
- 491bc78 — feat: show osu! avatars, profile covers and country flags on player cards.
- a591fe9 — feat: show hunter stamps on bounty cards.

### Fixes

- 0127b74 — fix: sort completed bounties by completion date.
- 927bf91 — fix: show profile logout button only to the profile owner.
- f69c6d2 — fix: suppress Discord embeds in achievement sharing.
- 71addd3 — fix: make the first profile hunting slot span the full row.
- 1c357c2 — fix: stretch the profile player card and group separate stats on the right.
- 626ed78 — fix: refine user card styling and image clarity.

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
