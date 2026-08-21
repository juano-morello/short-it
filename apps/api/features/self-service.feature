Feature: Self-service workspace onboarding
  An account holder can create a first workspace without operator intervention.

  Scenario: A new account creates an owner workspace
    Given a unique visitor who needs a workspace
    When the visitor registers an account and creates a workspace
    Then the workspace exists with the visitor as its owner

  Scenario Outline: Invalid and reserved workspace handles are rejected before creation
    Given a unique visitor who needs a workspace
    When the visitor registers an account
    And the visitor attempts to create a workspace with handle "<handle>"
    Then the workspace request is rejected with "<message>" and the visitor has no workspace

    Examples:
      | handle      | message                                                        |
      | app         | That workspace handle is reserved.                            |
      | ada--studio | Workspace handles use 3 to 30 lowercase letters, digits, and internal hyphens. |

  Scenario: A workspace handle already used by another workspace is rejected
    Given a visitor with an existing workspace
    And a second unique visitor who needs a workspace
    When the second visitor registers an account and attempts the existing workspace handle
    Then the workspace request is rejected with "Organization already exists" and the visitor has no workspace

  Scenario: An owner cannot update a workspace to an invalid handle
    Given a visitor with an existing workspace
    When the owner attempts to update the workspace handle to "www"
    Then the workspace request is rejected with "That workspace handle is reserved." and the existing workspace handle is unchanged

  Scenario: Oversized authentication requests are rejected at the edge
    When an unauthenticated visitor submits a request larger than 64 KiB
    Then the request is rejected with 413 and the API remains ready

  Scenario: Account and workspace names have server-side bounds
    Given a unique visitor who needs a workspace
    When the visitor attempts account registration with a name longer than 120 characters
    Then the account request is rejected with "Account names must contain 1 to 120 characters."
    When the visitor registers an account
    And the visitor attempts account registration with a name longer than 120 characters
    Then invalid account registration has the same response for existing and unused email addresses
    And the visitor attempts workspace creation with a name longer than 120 characters
    Then the workspace request is rejected with "Workspace names must contain 1 to 120 characters." and the visitor has no workspace

  Scenario: Duplicate account registration does not disclose account state
    Given a unique visitor who needs a workspace
    When the visitor registers an account
    And the visitor attempts to register the same account again
    Then the duplicate account response is generic and does not create a session

  @rate-limit
  Scenario: Authentication throttling preserves session privacy
    Given a unique visitor who needs a workspace
    When the visitor registers an account
    And the visitor makes repeated invalid sign-in attempts
    Then authentication is rate limited and the visitor session contains no IP or user-agent
