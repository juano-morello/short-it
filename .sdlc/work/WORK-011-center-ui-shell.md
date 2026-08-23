# WORK-011: Center the UI shell

## Source and status

Source: Juano approved this bugfix in Codex on 2026-08-22.

Status: delivered in PR #20 on 2026-08-23.

## Goal

Keep the shared UI shell centered with equal horizontal gutters and no viewport overflow.

## Requirement links

- Existing dashboard and self-service UI presentation. No new product requirement is introduced.

## Scope

- Include shell gutters in the shell width calculation.
- Preserve the existing 1100px maximum layout width and spacing tokens.
- Add focused regression evidence for the shared shell sizing rule.

## Non-goals

No page redesign, typography or spacing-token changes, routing, API, persistence, dependency,
production, or migration work.

## Acceptance scenarios

- At viewport-constrained widths, the shell has symmetric left and right gutters without horizontal
  overflow.
- At wide widths, the shell remains centered and retains its existing maximum width.

## Proposed approach

Apply `border-box` sizing to `.site-shell`, which makes the existing horizontal padding part of its
specified width. Test the declared rule and verify the rendered layout at representative viewports.

## Alternatives and tradeoffs

Subtracting the gutters from the width expression would solve the immediate overflow but would
duplicate token math in the layout rule. `border-box` states the intended sizing boundary directly.

## Consequential decisions

None. This is a CSS bugfix within the approved layout system.

## TDD and BDD strategy

Add a failing stylesheet regression test before the CSS rule. BDD is not applicable to this
presentation-only correction.

## Verification plan

Run the focused web style test, lint, formatting, typecheck, full unit suite, browser layout checks,
and risk-appropriate independent reviews.

## Verification evidence

- The focused stylesheet regression test failed before the CSS change and passed afterward.
- A local browser check at the constrained viewport found a 360px layout viewport and shell width,
  no horizontal overflow (`scrollWidth: 360px`), `border-box` sizing, and 24px padding on both sides.
- A local browser check at the wide viewport found a 1425px layout viewport, no horizontal overflow,
  a 1100px shell, and equal 162.5px left and right outer margins.

## Security and operations impact

None. No runtime contract, data flow, dependency, or deployment behavior changes.

## Migration and rollback

No migration. Reverting the single CSS rule and its test restores the previous presentation.

## Agent roster and routing

The primary agent owns the isolated CSS and test change. Independent product, technical, test,
security, operations, and engineering-excellence reviewers will inspect the final diff.

## Approval

Approved by Juano on 2026-08-22.
