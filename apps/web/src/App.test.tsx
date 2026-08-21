import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "./auth-client.js";
import { App } from "./App.js";

vi.mock("./auth-client.js", () => ({
  authClient: {
    getSession: vi.fn(),
    organization: {
      create: vi.fn(),
      list: vi.fn(),
    },
    signIn: {
      email: vi.fn(),
    },
    signUp: {
      email: vi.fn(),
    },
  },
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authClient.getSession).mockResolvedValue({ data: null });
  });

  afterEach(cleanup);

  it("opens the self-service workspace form", async () => {
    render(<App />);

    const createWorkspace = await screen.findByRole("button", { name: "Create a workspace" });
    fireEvent.click(createWorkspace);

    expect(screen.getByRole("heading", { name: "Create your workspace" })).toBeInTheDocument();
    expect(screen.getByLabelText("Workspace handle")).toHaveAttribute("required");
  });

  it("keeps a registered user in retryable onboarding when workspace creation fails", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({ data: {} });
    vi.mocked(authClient.organization.create).mockResolvedValue({
      error: { message: "That workspace handle is reserved." },
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Create a workspace" }));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-battery-staple" } });
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Ada Studio" } });
    fireEvent.change(screen.getByLabelText("Workspace handle"), { target: { value: "app" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create workspace" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("That workspace handle is reserved.");
    expect(authClient.organization.create).toHaveBeenCalledWith({
      keepCurrentActiveOrganization: true,
      name: "Ada Studio",
      slug: "app",
    });
  });
});
