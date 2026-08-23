# PR 20: fix(web): include shell gutters in layout width

- PR: https://github.com/juano-morello/short-it/pull/20
- Merge commit: `94fc2787ea174552c76167986b5e429c218aa167`
- Merged: 2026-08-23T18:38:25Z

## Delivered scope

The shared UI shell now uses `box-sizing: border-box`, so its declared width includes the existing horizontal gutters. At constrained widths the shell no longer exceeds the viewport; at wide widths it retains the 1100px maximum width and equal outer margins.

## Requirement and decision

This closes a presentation defect in the existing dashboard and self-service UI. It introduces no new product requirement or architectural decision. `border-box` expresses the intended sizing boundary without duplicating gutter-token arithmetic in the width rule.

## Verification

Evidence class: rendered browser checks, plus historic red/green test evidence recorded in the approved work brief. The brief reports that the focused stylesheet regression test failed before the rule was added and passed afterward. At a 360px viewport, the shell measured 360px with no horizontal overflow and 24px padding on both sides. At a 1425px viewport, the shell measured 1100px with equal 162.5px outer margins.

The refreshed GitHub Quality workflow passed in 5m55s after PR 21 resolved the unrelated concurrent workspace-lifecycle failure. Product, technical, test, security, operations, and engineering-excellence reviews found no code-level blocker.

## Security, operations, and follow-up

The change adds no runtime contract, data flow, dependency, migration, or deployment behavior. It does not depend on the separate lifecycle implementation delivered by PR 21.

Authoritative project record: `.sdlc/work/WORK-011-center-ui-shell.md`.
