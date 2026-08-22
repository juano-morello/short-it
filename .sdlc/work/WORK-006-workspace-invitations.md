# WORK-006: Email-bound workspace invitations

## Source and status

Source: Juano approved this work item in Codex on 2026-08-22.

Status: in progress.

## Goal

Let a workspace owner grant an editor or analyst role through a copyable invitation link without
letting another workspace, another role, or an email mismatch create membership.

## Requirement links

- FR-002: a workspace owner can invite editor and analyst members using a copyable invitation
  link.
- FR-006: owner, editor, and analyst permissions restrict workspace behavior.
- NFR: organization-scoped queries use server-derived membership, never a browser tenant claim.

## Scope

- Use the existing Better Auth Organization invitation records and opaque invitation IDs.
- Add the two additive Better Auth fields required by invitation creation and acceptance:
  `Invitation.createdAt` and nullable `Session.activeOrganizationId`.
- Let an owner create, list, copy, and cancel pending editor or analyst invitations for the active
  workspace.
- Let a signed-in account accept a pending invitation only when its supplied account email matches
  the invitation email. Acceptance grants the assigned role.
- Render owner controls and the recipient acceptance state in the dashboard.
- Restrict invitation creation, listing, and cancellation to owners. Editors and analysts receive
  no invitation management controls or authority.
- Delete accepted and cancelled invitations immediately. Prune expired pending invitations at
  least every five minutes.

## Non-goals

Email verification, outbound invitation delivery, open enrollment links, member-role changes,
member removal, workspace switching, user or workspace deletion, custom roles, and database
migrations beyond the two required Better Auth fields are outside this work item.

## Acceptance scenarios

- An owner can create an editor or analyst invitation, copy its opaque URL, view it while pending,
  and cancel it.
- An editor or analyst cannot create, list, or cancel invitations, including by calling the auth
  endpoint directly.
- The invited email can accept the copied URL while signed in and receives only the invited role.
- A different email, cancelled or expired invitation, replayed acceptance, or workspace mismatch
  creates no membership and exposes no sensitive invitation data.
- An invitation link does not disclose an address beyond the existing signed-in matching-email
  check, and no raw session material is persisted or logged.

## Proposed approach

Configure Better Auth's server Organization plugin with the static workspace roles. Keep invitation
records inside Better Auth and use its create, list, cancel, and accept operations through a small
dashboard gateway. The server's canonical invitation capability and global owner gates protect raw
Organization endpoints; the application-owned minimal membership projection replaces the raw
full-organization response for ordinary members.

The dashboard client uses Better Auth's generic Organization transport only. It does not carry an
access-control projection and is not an authorization boundary; server-side session, membership,
and role checks are authoritative.

The dashboard creates and lists invitations only for a server-confirmed owner. It creates a
copyable app URL containing the opaque invitation ID in its fragment, then removes that fragment
from browser history after capture. When that URL is opened, the signed-in recipient accepts it
through Better Auth; the normal Organization plugin email-match check is the authorization boundary
for acceptance.

## Alternatives and tradeoffs

Making invitations proof of mailbox ownership requires email verification and delivery, which are
explicitly outside launch scope. The approved launch behavior instead combines opaque IDs with a
matching unverified account email. A forwarded link therefore cannot be accepted by an account
with a different email, but a person who can obtain the link and register the invited email string
can accept it. This residual risk is documented and deferred with verified-email invitations.

## Consequential decisions

Juano approved owner-only invitation management and the launch tradeoff above on 2026-08-22. The
existing no-email-verification and no-email-delivery scope remains unchanged. Juano also approved
the additive `Invitation.createdAt` and `Session.activeOrganizationId` migration, direct-endpoint
owner gates, immediate terminal-invitation deletion, and five-minute expired-invitation pruning.
No dependency or production infrastructure change is proposed.

## Risks and dependencies

The behavior depends on Better Auth 1.7.1's opaque invitation IDs and matching-email acceptance.
Invitation URLs are capabilities and must not be logged. Current Better Auth guidance recommends
verified emails when invitation IDs are exposed in member-visible lists; this work avoids recipient
lists and retains the explicitly approved unverified-email limitation. Production must run the
invitation prune command at least every five minutes; an overdue prune is a privacy retention
breach.

## TDD and BDD strategy

Start with executable owner, editor, analyst, matching-recipient, mismatch, cancelled, expired,
and replay acceptance scenarios. Add focused role-policy and gateway tests, then integration tests
against the Organization plugin and browser tests for owner controls and recipient acceptance.

## Verification plan

Run formatting, lint, type checks, unit, PostgreSQL integration, BDD, browser E2E, coverage,
Prisma validation, Storybook, Compose, Docker, and dependency security checks. Coverage remains
at least 80 percent. Independent product, technical, test, security, operations, and
engineering-excellence reviews are required before PR readiness.

## Security and operations impact

No new persistent tables or deployment services are introduced. Better Auth's existing invitation
expiry, invitation limit, and membership limit stay in effect. Invitation URLs and errors must not
be included in structured logs. The unverified-email limitation is a known launch risk, not an
email-ownership assertion. The operator must run invitation pruning at least every five minutes;
terminal rows are deleted immediately.

## Migration and rollback

The additive migration adds `Invitation.createdAt` and nullable `Session.activeOrganizationId`.
Roll back application code before considering any destructive schema change. Pending invitations
continue to expire under the existing seven-day policy and terminal rows are removed immediately.

## Agent roster and routing

The primary agent owns the work contract, outside-in implementation, and verification. Before
readiness, independent requirements, technical, test, security, operations, and
engineering-excellence reviewers inspect the final diff and evidence at risk-appropriate depth.

## Approval

Juano approved scope and the unverified-email launch tradeoff in Codex on 2026-08-22.
