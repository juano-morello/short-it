Feature: Public workspace redirects
  A visitor follows a published CUID from a redirect-only workspace host.

  Scenario: A public workspace host redirects a published link to its immutable destination
    Given a public workspace has a published link
    When a visitor follows the published link from that workspace host
    Then the visitor receives an uncached redirect to the published destination
    And a HEAD request receives the same redirect headers without a body

  Scenario: A tenant host does not disclose an unpublished or cross-workspace link
    Given a public workspace has an unpublished link
    And a separate public workspace exists
    When a visitor follows that link from a different workspace host
    Then the visitor receives a generic not found response

  Scenario: A tenant host exposes no non-redirect routes
    Given a public workspace has a published link
    When a visitor requests a tenant API route
    Then the visitor receives a generic not found response
