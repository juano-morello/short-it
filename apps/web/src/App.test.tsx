import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { authClient } from "./auth-client.js";

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
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery-staple" },
    });
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Ada Studio" } });
    fireEvent.change(screen.getByLabelText("Workspace handle"), { target: { value: "app" } });
    const form = screen.getByRole("button", { name: "Create workspace" }).closest("form");
    if (!form) {
      throw new Error("The workspace form is missing.");
    }
    fireEvent.submit(form);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That workspace handle is reserved.",
    );
    expect(authClient.organization.create).toHaveBeenCalledWith({
      keepCurrentActiveOrganization: true,
      name: "Ada Studio",
      slug: "app",
    });
  });

  it("shows a returning member their first workspace", async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(authClient.organization.list).mockResolvedValue({
      data: [{ id: "workspace-1", name: "Ada Studio", slug: "ada" }],
    } as never);

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Ada Studio" })).toBeInTheDocument();
    expect(screen.getByText("Workspace member")).toBeInTheDocument();
  });

  it("takes a new visitor to their owner dashboard after registration", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({ data: {} } as never);
    vi.mocked(authClient.organization.create).mockResolvedValue({
      data: { id: "workspace-1", name: "Ada Studio", slug: "ada" },
    } as never);

    render(<App />);

    await submitSignUpForm();

    expect(await screen.findByRole("heading", { name: "Ada Studio" })).toBeInTheDocument();
    expect(screen.getByText("Owner", { exact: true })).toBeInTheDocument();
  });

  it("shows a sign-up error without leaving the account form", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      error: { message: "An account already exists for that email." },
    } as never);

    render(<App />);

    await submitSignUpForm();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account already exists for that email.",
    );
    expect(screen.getByRole("heading", { name: "Create your workspace" })).toBeInTheDocument();
  });

  it("signs in a returning workspace member", async () => {
    vi.mocked(authClient.getSession)
      .mockResolvedValueOnce({ data: null } as never)
      .mockResolvedValue({ data: { user: { id: "member-1" } } } as never);
    vi.mocked(authClient.signIn.email).mockResolvedValue({ data: {} } as never);
    vi.mocked(authClient.organization.list).mockResolvedValue({
      data: [{ id: "workspace-1", name: "Ada Studio", slug: "ada" }],
    } as never);

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery-staple" },
    });
    const form = screen.getByRole("button", { name: "Sign in" }).closest("form");
    if (!form) {
      throw new Error("The sign-in form is missing.");
    }
    fireEvent.submit(form);

    expect(await screen.findByRole("heading", { name: "Ada Studio" })).toBeInTheDocument();
  });
});

async function submitSignUpForm(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "Create a workspace" }));
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "correct-horse-battery-staple" },
  });
  fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Ada Studio" } });
  fireEvent.change(screen.getByLabelText("Workspace handle"), { target: { value: "ada" } });
  const form = screen.getByRole("button", { name: "Create workspace" }).closest("form");
  if (!form) {
    throw new Error("The workspace form is missing.");
  }
  fireEvent.submit(form);
}
