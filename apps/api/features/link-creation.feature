Feature: Workspace link publication
  A workspace member can publish a safe immutable destination without selecting a public slug.

  Scenario: An unauthenticated visitor cannot publish a link
    When an unauthenticated visitor attempts to publish a link
    Then the link publication is rejected as unauthenticated

  Scenario: A signed-in owner cannot publish from an untrusted origin
    Given a signed-in workspace owner
    When the owner attempts to publish a link from an untrusted origin
    Then the link publication is rejected as cross-origin

  Scenario: An owner publishes a destination link with a server-generated CUID slug
    Given a signed-in workspace owner
    When the owner publishes a link to "https://93.184.216.34/portfolio"
    Then the published link belongs to that workspace and has a CUID slug

  Scenario: An editor can publish a destination link
    Given a signed-in workspace editor
    When the editor publishes a link to "https://93.184.216.34/editor"
    Then the published link belongs to that workspace and has a CUID slug

  Scenario: An analyst cannot publish a destination link
    Given a signed-in workspace analyst
    When the analyst attempts to publish a link
    Then the link publication is rejected as forbidden

  Scenario: A workspace member cannot publish in another workspace
    Given a signed-in workspace editor
    And a separate workspace exists
    When the editor attempts to publish a link in the separate workspace
    Then the link publication is rejected as forbidden

  Scenario: Unsafe destinations are rejected before publishing
    Given a signed-in workspace owner
    When the owner publishes a link to "ftp://example.com/archive"
    Then the link publication is rejected with "Link destinations must use HTTP or HTTPS."
    When the owner publishes a link to "https://user:secret@example.com"
    Then the link publication is rejected with "Link destinations must not include credentials."
    When the owner publishes a link to "http://127.0.0.1/internal"
    Then the link publication is rejected with "Link destinations must not resolve privately."
    When the owner publishes a link to "http://[ff02::1]/multicast"
    Then the link publication is rejected with "Link destinations must not resolve privately."
    When the owner publishes a link to "https://internal.local/private"
    Then the link publication is rejected with "Link destinations must not resolve privately."

  @publication-guardrails
  Scenario: Oversized destinations are rejected before publishing
    Given a signed-in workspace owner
    When the owner publishes a destination longer than 2,048 characters
    Then the link publication is rejected with "Link destinations must be 2,048 characters or fewer."

  @publication-guardrails
  Scenario: An owner may make only 30 publication attempts per workspace in ten minutes
    Given a signed-in workspace owner
    When the owner makes 31 link publication attempts
    Then the link publication is rejected as rate limited
