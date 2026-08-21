# ADR-0002: Model workspaces as Better Auth organizations with application-scoped tenancy

- Status: accepted
- Date: 2026-08-21
- Owner: Juano Morello
- Requirement links: FR-001, FR-002, FR-003, FR-006, FR-007
- Review conditions: cross-tenant authorization tests are mandatory before link CRUD release.

## Context

Every customer-visible link and metric belongs to one workspace. Users can belong to multiple
workspaces with owner, editor, or analyst permissions.

## Decision drivers

Self-service membership, predictable role checks, simple Prisma data access, and a low-cost
portfolio scope.

## Considered alternatives

Application-owned membership tables, schema-per-tenant databases, and PostgreSQL row-level
security were considered.

## Decision

Use Better Auth's Organization plugin as the workspace and use static owner, editor, and
analyst roles. Application tables include `organizationId`; Nest guards derive membership
and scope every query. PostgreSQL RLS is deferred as defense in depth.

## Consequences and tradeoffs

Application code carries the primary tenancy enforcement responsibility. This must be
protected by outside-in authorization and cross-tenant tests.

## Verification

Better Auth organization configuration typechecks. Later slices must prove role permissions,
server-derived scope, and negative cross-tenant cases.
