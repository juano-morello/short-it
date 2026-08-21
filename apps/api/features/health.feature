Feature: Service probes
  The platform exposes probes for orchestration without requiring user authentication.

  Scenario: The process health probe responds with its service identity
    When the health probe is requested
    Then it reports an operational short-it API process
    And the readiness probe reports a ready database
