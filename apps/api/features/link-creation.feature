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

  Scenario Outline: Unsafe destinations are rejected before publishing
    Given a signed-in workspace owner
    When the owner publishes a link to "<destination>"
    Then the link publication is rejected with "<message>"

    Examples:
      | destination                   | message                                      |
      | ftp://example.com/archive     | Link destinations must use HTTP or HTTPS.   |
      | http://127.0.0.1/internal     | Link destinations must not resolve privately. |
