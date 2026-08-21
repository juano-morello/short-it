# INV-001: Portable deployment posture

## Decision supported

ADR-0001.

## Sources and versions

Provider comparison occurred during product discovery. The chosen scaffold relies only on
Docker, Compose, Caddy, and PostgreSQL conventions rather than a provider configuration.

## Findings

The hostname model needs a dashboard host and wildcard workspace hosts. A VPS or a managed
container platform can support this when paired with managed PostgreSQL. Caddy expresses the
edge boundary locally without selecting a production provider.

## Tradeoffs

Provider neutrality avoids premature cost and lock-in decisions but postpones TLS, DNS,
backup ownership, image publishing, and operational evidence.

## Unknowns

Final provider, US East location, managed PostgreSQL provider, backup retention, and domain.

## Recommendation

Keep the Docker images and Compose contract portable. Revisit provider selection in a
separate approved production-readiness change.

## Resulting ADRs

ADR-0001.
