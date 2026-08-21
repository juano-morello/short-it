import { APIError } from "better-auth";

const maximumDisplayNameLength = 120;

export function getDisplayNameError(
  value: string | undefined,
  subject: "Account" | "Workspace",
): string | undefined {
  if (!value?.trim() || value.length > maximumDisplayNameLength) {
    return `${subject} names must contain 1 to ${maximumDisplayNameLength} characters.`;
  }

  return undefined;
}

export function assertDisplayName(
  value: string | undefined,
  subject: "Account" | "Workspace",
): void {
  const error = getDisplayNameError(value, subject);

  if (error) {
    throw new APIError("BAD_REQUEST", { message: error });
  }
}
