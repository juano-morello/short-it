# PR 8: feat: add workspace invitations

- PR: https://github.com/juano-morello/short-it/pull/8
- Merge commit: `d7ecc81e42d9929abd200375f96d6d6c6dfe464b`
- Merged: 2026-08-22T17:00:55Z

## Delivered scope

FR-002 now supports owner-only, copyable workspace invitations for editor and analyst roles.
Invitation acceptance requires a signed-in account whose email string matches the invitation. The
dashboard exposes only a minimal current-membership projection to ordinary members.

## Decisions and safeguards

The approved launch tradeoff keeps email verification and outbound delivery out of scope. An opaque
invitation capability is captured from the browser fragment and cleared from history before network
work; acceptance requires explicit confirmation. A forwarded capability cannot be accepted by an
account with a different email, but matching an unverified email string does not prove mailbox
ownership.

Server-side session and organization-scoped membership checks are the authorization boundary.
Owners alone can create, list, and conditionally cancel pending invitations. The conditional
cancellation operation prevents cancel and accept from both taking effect. Raw invitation endpoints
that are not part of the flow are unavailable.

Accepted and cancelled invitation rows are deleted immediately. A five-minute pruning job removes
expired pending invitations and terminal cleanup residue. The additive Better Auth migration adds
the required invitation creation timestamp, nullable active-organization session field, and an
expiry index.

## Verification

Evidence class: proven by the merged implementation and successful GitHub Quality workflow. The
workflow passed formatting, lint, type checks, unit and PostgreSQL integration tests, 80-percent
coverage, Prisma validation, Storybook, Compose, Docker, production-image prune smoke test,
dependency audits, all BDD profiles, and browser E2E. Independent requirements, technical, test,
security, operations, and engineering-excellence reviews had no remaining actionable findings.

## Operations and follow-up

Before production, run the compiled invitation prune command at least every five minutes and alert
on failures or missing successful runs. The launch email-string match is a documented residual risk;
verified-email invitations and email delivery remain deferred. Shared rate limiting and other
multi-instance controls remain pre-production work.

Authoritative project records: `.sdlc/work/WORK-006-workspace-invitations.md`,
`.sdlc/architecture/overview.md`, `.sdlc/architecture/operations.md`,
`.sdlc/quality/threat-model.md`, and `.sdlc/quality/test-strategy.md`.
