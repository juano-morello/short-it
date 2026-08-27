# WORK-013: Close v1 documentation

## Source and status

Source: Post-merge repository status audit approved by Juano on 2026-08-26.

Status: approved and in progress.

## Goal

Make the repository describe the completed v1 demo accurately. A reader must be able to distinguish
delivered product behavior from production-readiness work, technical debt, and later product scope.

## Requirement links

- FR-001 through FR-009 remain delivered. This work changes their documentation, not their behavior.
- Product success criterion: document the technical choices clearly enough to support public writing.
- Nonfunctional and operational requirements remain authoritative in
  `.sdlc/project/requirements.md` and `.sdlc/architecture/operations.md`.

## Scope

- Refresh the public README with delivered capabilities, supported roles, local operation, limitations,
  verification commands, and links to authoritative records.
- Correct stale or conflicting statements in the product brief and delivered work records.
- Add an authoritative v1 project-status record.
- Separate deferred product scope from technical debt and production-readiness work.
- Add a maintained technical-debt backlog with priority, trigger, owner, evidence, and exit criteria.
- Define WORK-009 as production web-image routing and SPA fallback, matching existing references.
- Mark the completed WORK-002 application-gateway follow-up as resolved.
- Add lightweight repository delivery records for merged PRs 3, 5, 10, 14, 16, 17, and 22.
- Update the SDLC manifest and cross-references for the new living records.

## Non-goals

- Application behavior, architecture, persistence, public contracts, dependencies, infrastructure,
  deployment, security posture, and accepted risks do not change.
- This work does not select a production provider or implement production readiness.
- This work does not approve or deliver v1.1 product scope.
- This work does not change Obsidian records, the merge ledger, or the global Juano engineering plugin.

## Acceptance scenarios

### A reader understands the milestone

Given a reader starts at the repository README
When they review the project status and capability summary
Then they can identify the delivered v1 demo behavior
And they can see that the project is not deployed or production-ready.

### Deferred work is classified accurately

Given an item remains after the v1 demo milestone
When the item appears in the living project records
Then it is classified as product roadmap, production readiness, technical debt, or accepted risk
And its owner, trigger, and completion condition are explicit where the item is actionable.

### Dangling and stale records are resolved

Given the repository references WORK-009 and the completed WORK-002 gateway follow-up
When the closeout records are read
Then WORK-009 exists with production SPA-routing scope
And WORK-002 names the gateway implementation that resolved its follow-up.

### Merge delivery history is complete through PR 22

Given GitHub records 22 merged pull requests through 2026-08-23
When repository delivery records are enumerated
Then each merged PR from 1 through 22 has a lightweight record
And the records do not duplicate routine implementation detail.

## Proposed approach

Keep one authoritative document per concern. The README summarizes the product for a public reader.
The project-status record states the current milestone. The roadmap holds later product and production
work. The technical-debt record tracks engineering liabilities. Requirements, architecture,
operations, the threat model, and work items retain their existing authority for detailed behavior.

Use links instead of copying long explanations between records. Preserve exact delivery and
verification evidence while removing stale promises and completed follow-ups.

## Alternatives and tradeoffs

A single closeout document would reduce the file count but would mix current status, future product
scope, and engineering liabilities. GitHub issues alone would provide assignment mechanics but would
leave the repository without durable project truth. The approved split adds a small maintenance cost
in exchange for explicit ownership and clearer update boundaries.

## Consequential decisions

Juano approved the following classifications on 2026-08-26:

- The v1 demo is feature-complete against FR-001 through FR-009 but is not deployed or
  production-ready.
- Product roadmap, production readiness, technical debt, and accepted risk are separate categories.
- WORK-009 is the bounded production web-image routing and SPA-fallback item already referenced by
  WORK-010 and its delivery records.
- Production blockers receive pre-hosting priority without implying an immediate launch commitment.

## Risks and dependencies

Duplicated status text can drift. The closeout limits detailed claims to their authoritative records
and uses summaries elsewhere. Delivery curation remains one merge behind by design because a merge
commit and timestamp do not exist until after a PR merges; this closeout records history only through
PR 22.

The work adds no package, service, secret, schema, or provider dependency.

## TDD and BDD strategy

No executable behavior changes, so no new Gherkin or application test is appropriate. Acceptance is
verified through repository-level checks: document presence, required classifications, complete PR
number coverage through 22, valid local Markdown targets, and absence of identified stale statements.
These assertions verify the closeout revision but are not yet committed to the Quality workflow;
[TD-010](../quality/technical-debt.md#td-010-continuous-documentation-integrity-checks) tracks
continuous enforcement. The unchanged application suite remains a regression gate.

## Verification plan

- Verify delivery records cover PRs 1 through 22 exactly once.
- Verify every relative Markdown link resolves.
- Search for the stale README, product-brief, WORK-002, and dangling WORK-009 language.
- Run formatting, lint, type checking, unit tests, integration tests, BDD, browser tests, coverage,
  Prisma validation, Storybook and application builds, Docker and Compose validation, and dependency
  audits through the repository Quality workflow.
- Require independent product, technical, test, security, operations, architecture, and
  engineering-excellence review with all findings resolved or explicitly dispositioned.

## Security and operations impact

There is no runtime impact. The documentation must preserve current accepted risks and pre-production
controls without presenting them as implemented. It must not include credentials, raw personal data,
customer payloads, or sensitive logs.

## Migration and rollback

No migration or deployment is involved. Revert the documentation commits to roll back the change.
The PR 22 record was preserved in a named Git stash before worktree transfer and is now part of this
branch's committed history.

## Agent roster and routing

- Primary agent: own the worktree, repository edits, evidence, commits, draft PR, and finding
  resolution.
- Requirements reviewer: Terra at high effort for product-status and requirement traceability.
- Technical reviewer: Sol at high effort for implementation truth and cross-document consistency.
- Test reviewer: Terra at high effort for acceptance and verification evidence.
- Security reviewer: Sol at extra-high effort for accepted-risk and hardening classifications.
- Operations reviewer: Terra at high effort for production-readiness and runbook accuracy.
- Architecture reviewer: Sol at high effort for architecture-record and boundary consistency.
- Engineering-excellence reviewer: Sol at high effort for cohesion, maintainability, and prose quality.

Reviewers remain independent and inspect the approved brief, repository rules, diff, and verification
evidence before explanations from the primary agent.

## Approval

Approved by Juano on 2026-08-26, including preservation of the untracked PR 22 record in a named Git
stash and transfer of that record into the isolated WORK-013 worktree.
