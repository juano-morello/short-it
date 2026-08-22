import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDeletionController } from "./account-deletion.controller.js";
import type { AccountDeletionService } from "./account-deletion.service.js";
import { auth } from "./auth.js";

vi.mock("./auth.js", () => ({ auth: { api: { getSession: vi.fn() } } }));

describe("AccountDeletionController", () => {
  const deleteAccount = vi.fn();
  const controller = new AccountDeletionController({
    delete: deleteAccount,
  } as unknown as AccountDeletionService);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires an authenticated session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    await expect(
      controller.deleteAccount(
        { confirmationEmail: "member@example.test" },
        request({ origin: "http://app.localhost:8080", "x-request-id": "account-123" }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("uses only the authenticated account identity and matching dashboard origin", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { email: "member@example.test", id: "member-1" },
    } as never);

    await expect(
      controller.deleteAccount(
        { confirmationEmail: "member@example.test", userId: "another-user" } as never,
        request({ origin: "http://app.localhost:8080", "x-request-id": "account-123" }),
      ),
    ).resolves.toBeUndefined();

    expect(deleteAccount).toHaveBeenCalledWith({
      confirmationEmail: "member@example.test",
      email: "member@example.test",
      requestId: "account-123",
      userId: "member-1",
    });
  });

  it("rejects requests that do not originate from the dashboard", async () => {
    await expect(
      controller.deleteAccount(
        { confirmationEmail: "member@example.test" },
        request({ origin: "https://untrusted.example" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function request(headers: Record<string, string>): Request {
  return {
    get: (name: string) => headers[name.toLowerCase()],
    headers,
  } as Request;
}
