Feature: Self-service workspace onboarding
  An account holder can create a first workspace without operator intervention.

  Scenario: A new account creates an owner workspace
    Given a unique visitor who needs a workspace
    When the visitor registers an account and creates a workspace
    Then the workspace exists with the visitor as its owner
