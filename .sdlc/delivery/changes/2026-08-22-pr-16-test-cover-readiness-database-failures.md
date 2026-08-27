# PR 16: test: cover readiness database failures

- PR: https://github.com/juano-morello/short-it/pull/16
- Merge commit: `0612424b2fab73ce0dd0bf6b6786f7d3caef3f32`
- Merged: 2026-08-22T23:09:23Z

## Delivered scope

This test-only merge proved that `/api/ready` cannot report ready when PostgreSQL rejects its
readiness query. It retained the portable-demo failure response without changing the public probe
contract.

## Durable disposition

PR 16 completed the readiness failure-path evidence associated with WORK-008. It changed no runtime
behavior, dependency, schema, infrastructure, deployment, or security posture.

## Verification

Evidence class: proven by the merged regression test and successful GitHub Quality workflow at the
merge commit: https://github.com/juano-morello/short-it/actions/runs/32604445016. The focused PR run
reported 202 API tests passing before merge.
