@workspace-lifecycle
Feature: Irreversible workspace and account deletion
  A signed-in owner can remove a workspace, and a signed-in user can remove an account only after
  resolving every workspace they own.

  Scenario: An owner permanently deletes a workspace
    Given a signed-in workspace owner with a published link
    When the owner deletes the workspace
    Then the workspace and its scoped records no longer exist

  Scenario: An editor cannot delete another workspace
    Given a signed-in workspace editor and another workspace
    When the editor deletes the other workspace
    Then the workspace deletion is forbidden and the other workspace remains

  Scenario: An analyst cannot delete another workspace
    Given a signed-in workspace analyst and another workspace
    When the analyst deletes the other workspace
    Then the workspace deletion is forbidden and the other workspace remains

  Scenario: An owner cannot delete a workspace they do not own
    Given a signed-in workspace owner and another workspace
    When the owner deletes the other workspace
    Then the workspace deletion is forbidden and the other workspace remains

  Scenario: An account owner cannot delete their account
    Given a signed-in account owner with a workspace
    When the account owner requests account deletion with their email confirmation
    Then account deletion is rejected and the account remains

  Scenario: A user without an owned workspace permanently deletes their account
    Given a signed-in user without an owned workspace
    When the user requests account deletion with their email confirmation
    Then the account, credentials, session, and memberships no longer exist
