# Product brief

## Problem

Creators and agencies need a stable, branded way to share destinations and understand
which links are useful without bolting analytics onto every destination.

## Users and stakeholders

- Workspace owners operating a creator or agency account.
- Editors publishing and maintaining short links.
- Analysts reviewing aggregated redirect signals.
- Public visitors following a shared link.
- Juano, who owns product decisions and will use this as a portfolio-ready live demo and
  technical case study.

## Goals

- Let anyone sign up, create a workspace, and manage custom-slug links.
- Publish workspace URLs in the form `handle.<configured-domain>/slug`.
- Redirect reliably and show useful, privacy-conscious analytics.
- Support scoped owner, editor, and analyst workspace roles.
- Provide polished self-service product surfaces and a documented technical foundation.

## Non-goals

- Customer-owned custom domains, billing, QR codes, a public third-party API, automatic
  abuse moderation, email delivery, email verification, or password-recovery delivery.
- Production provider selection, DNS, image publishing, or live deployment in this scaffold.

## Scope

Links have HTTP or HTTPS destinations and custom slugs. After a link is published, its
destination is immutable. A replacement link is required to point the public URL at a
different destination. Analytics cover clicks, daily unique visitors, time series,
referrer host, country, and device category. Aggregates are retained for 12 months.

## Success criteria

- A recruiter can self-register and understand the product from the live demo.
- A workspace can safely manage links without crossing workspace boundaries.
- Redirects remain available if analytics persistence fails.
- The project documents the technical choices clearly enough to support public writing.

## Product constraints

- Invitation capability is scoped by workspace role.
- Invitations use copyable links in v1. No email service is configured.
- Raw IP addresses and raw user-agent strings are not persisted.
- User account deletion requires a user to leave, transfer, or delete all owned workspaces.
- Workspace deletion is irreversible.

## Open questions

- The production host, managed PostgreSQL provider, and domain are explicitly deferred.
- Brand language and public case-study content will be refined alongside product slices.
