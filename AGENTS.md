# short.it working agreements

Follow the repository records in `.sdlc`. The approved architecture uses a NestJS API,
React dashboard, Better Auth with static organization roles, Prisma-scoped tenancy, and
portable Docker images. Do not provision or deploy production infrastructure without
Juano's explicit approval.

Implement product behavior outside in with tests first. Core flows use executable Gherkin
scenarios. Keep all organization-scoped database queries explicitly constrained by
`organizationId`; browser-provided tenant identifiers are never an authorization source.

Do not add raw IP addresses or raw user-agent strings to persistent analytics. Redirect
availability takes precedence over analytics persistence.
