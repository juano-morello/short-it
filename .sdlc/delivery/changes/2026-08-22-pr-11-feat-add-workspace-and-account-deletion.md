# PR 11: feat: add workspace and account deletion

- PR: https://github.com/juano-morello/short-it/pull/11
- Merge commit: `fe2ffa9617bd0b7e5ad2250cfcaa3be293d9d65d`
- Merged: 2026-08-22T21:02:09Z

## Delivered scope

- Added owner-authorized irreversible workspace deletion with an exact workspace-handle confirmation.
- Added authenticated account deletion with an exact account-email confirmation and an owner-membership rejection.
- Added privacy-safe deletion outcome logs, cascade checks, session invalidation checks, dashboard return states, and browser coverage.

## Requirement links

- FR-007 remains in progress. This merge delivered the deletion interaction and authorization slice.

## Decisions and verification

- Workspace deletion retains Better Auth's static owner permission. Account deletion derives the user from the authenticated session and never accepts a browser user ID.
- The merged head passed the published Quality workflow. The delivery suite included lifecycle BDD, API, dashboard, browser, schema, build, image, and dependency-audit gates.

## Security and operations

- Deletion logs contain an event, outcome class, status, request ID, and latency. They exclude email, workspace identifiers, cookies, IP addresses, and user agents.
- Hosted deletion still requires tested backup and restore evidence before production use.

## Follow-up

- Post-merge review found that Better Auth's native workspace creation separates organization and owner-membership writes. The approved follow-up moves workspace creation and account deletion into serializable application transactions so a concurrent create/delete pair cannot leave an ownerless workspace.
