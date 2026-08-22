Feature: Privacy-preserving redirect analytics
  A successful public redirect records useful aggregate signals without becoming dependent on telemetry.

  Scenario: Analytics failure never blocks a safe redirect
    Given a public workspace has a published link
    And analytics capture fails for that link
    When a visitor follows the published link from that workspace host
    Then the visitor receives an uncached redirect to the published destination

  Scenario: A successful redirect records only privacy-preserving aggregates
    Given a public workspace has a published link
    When a visitor follows the published link from that workspace host
    Then the redirect analytics contain one click with an Unknown country
    And redirect analytics do not retain raw visitor identifiers

  @analytics-overview
  Scenario: An analyst can read their workspace aggregate overview but not another workspace's
    Given a signed-in analyst has workspace analytics
    When the analyst requests the workspace analytics overview
    Then the analyst receives only aggregate analytics for that workspace
