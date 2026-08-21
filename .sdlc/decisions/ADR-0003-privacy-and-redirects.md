# ADR-0003: Make redirects independent from privacy-conscious analytics

- Status: accepted
- Date: 2026-08-21
- Owner: Juano Morello
- Requirement links: FR-004, FR-005
- Review conditions: redirect resilience and retention tests are mandatory before release.

## Context

The product needs useful analytics while avoiding a persistent raw-IP or raw-user-agent
dataset. Visitors should not lose access to a destination because telemetry is unavailable.

## Decision drivers

Reliable redirects, minimal collection, transparent metric semantics, and a 12-month
analytics window.

## Considered alternatives

Persistent raw event logs, client-only analytics, and synchronous analytics writes that gate
redirects were rejected.

## Decision

Treat redirect resolution as the critical path. Attempt analytics asynchronously or in a
failure-isolated path. Derive a keyed daily visitor identifier from the request IP, expire it
within 24 hours, and retain aggregate metrics for 12 months.

## Consequences and tradeoffs

The product can accurately state daily unique visitors but cannot promise a cross-day,
lifetime unique-person metric. Country and device classification must avoid preserving raw
input values.

## Verification

Future integration tests must prove redirect success when analytics writes fail, raw field
absence, daily identifier expiry, and aggregate retention cleanup.
