@workspace-invitations
Feature: Email-bound workspace invitations
  A workspace owner can grant a limited workspace role without granting invitation authority to
  another role or workspace.

  Scenario Outline: An owner creates a pending invitation with a copyable opaque identifier
    Given an invitation-capable workspace owner
    When the owner invites "<email>" as an "<role>"
    Then a pending "<role>" invitation exists for "<email>" in that workspace

    Examples:
      | email                       | role    |
      | invited-editor@example.test  | editor  |
      | invited-analyst@example.test | analyst |

  Scenario Outline: A same-workspace non-owner cannot manage invitations or inspect members
    Given a signed-in workspace "<role>" with a pending invitation
    And a pending workspace invitation
    When the non-owner attempts to create, list, cancel invitations, and inspect the full workspace
    Then every invitation management request is forbidden
    And the pending invitation remains unchanged

    Examples:
      | role    |
      | editor  |
      | analyst |

  Scenario: An owner of another workspace cannot manage invitations or inspect members
    Given a pending workspace invitation and an unrelated workspace owner
    When the non-owner attempts to create, list, cancel invitations, and inspect the full workspace
    Then every invitation management request is forbidden
    And the pending invitation remains unchanged

  Scenario Outline: A matching signed-in account accepts an invitation once with its assigned role
    Given a pending workspace invitation for a signed-in matching recipient as an "<role>"
    When the recipient accepts the invitation
    Then the recipient becomes a "<role>" in that workspace
    When the recipient accepts the invitation again
    Then the invitation acceptance is rejected without changing membership

    Examples:
      | role    |
      | editor  |
      | analyst |

  Scenario: A different signed-in email cannot accept an invitation
    Given a pending workspace invitation for a signed-in matching recipient
    And a different signed-in recipient
    When the different recipient accepts the invitation
    Then the invitation acceptance is forbidden
    And the pending invitation remains unchanged

  Scenario: A cancelled invitation cannot be accepted
    Given a pending workspace invitation for a signed-in matching recipient
    When the owner cancels the invitation
    And the recipient accepts the invitation
    Then the invitation acceptance is rejected without changing membership
    And the invitation record is deleted

  @workspace-invitation-edge
  Scenario: Invitation acceptance and cancellation cannot both take effect
    Given a pending workspace invitation for a signed-in matching recipient
    When the recipient accepts and the owner cancels the invitation concurrently
    Then exactly one invitation transition takes effect

  @workspace-invitation-edge
  Scenario: A terminal invitation left after immediate cleanup is removed by pruning
    Given a pending workspace invitation for a signed-in matching recipient
    And immediate cleanup left the invitation terminal
    When expired invitations are pruned
    Then the invitation record is deleted

  Scenario: An expired invitation cannot be accepted and is retained only until pruning
    Given a pending workspace invitation for a signed-in matching recipient
    And the invitation has expired
    When the recipient accepts the invitation
    Then the invitation acceptance is rejected without changing membership
    When expired invitations are pruned
    Then the invitation record is deleted

  @workspace-invitation-edge
  Scenario Outline: An owner cannot create an elevated role or resend an invitation
    Given an invitation-capable workspace owner
    When the owner attempts an invalid invitation request with role "<role>" and resend "<resend>"
    Then the invitation request is rejected

    Examples:
      | role  | resend |
      | owner | false  |
      | editor | true  |

  @workspace-invitation-edge
  Scenario: Unused invitation rejection endpoints cannot leave terminal records
    Given an invitation-capable workspace owner
    And a pending workspace invitation
    When the owner attempts to reject or list user invitations
    Then every unused invitation endpoint is unavailable
    And the pending invitation remains unchanged

  @workspace-invitation-edge
  Scenario: Malformed invitation requests are rejected without a server error
    Given an invitation-capable workspace owner
    When the owner sends malformed invitation creation and acceptance requests
    Then every malformed invitation request is rejected
