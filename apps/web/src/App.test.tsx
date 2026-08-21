import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { authClient } from "./auth-client.js";

vi.mock("./auth-client.js", () => ({
  authClient: {
    getSession: vi.fn(),
    organization: {
      create: vi.fn(),
      getFullOrganization: vi.fn(),
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

  it("opens the self-service account form", async () => {
    render(<App />);

    const createWorkspace = await screen.findByRole("button", { name: "Create a workspace" });
    fireEvent.click(createWorkspace);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toHaveAttribute("required");
  });

  it("lets an authenticated user retry workspace creation after a recoverable failure", async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(authClient.organization.list).mockResolvedValue({ data: [] } as never);
    vi.mocked(authClient.organization.create)
      .mockResolvedValueOnce({ error: { message: "That workspace handle is reserved." } } as never)
      .mockResolvedValueOnce({
        data: { id: "workspace-1", name: "Ada Studio", slug: "ada" },
      } as never);

    render(<App />);

    await screen.findByRole("heading", { name: "Create your workspace" });
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Ada Studio" } });
    fireEvent.change(screen.getByLabelText("Workspace handle"), { target: { value: "app" } });
    fireEvent.submit(getForm("Create workspace"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That workspace handle is reserved.",
    );
    expect(authClient.organization.create).toHaveBeenCalledWith({
      keepCurrentActiveOrganization: true,
      name: "Ada Studio",
      slug: "app",
    });

    fireEvent.change(screen.getByLabelText("Workspace handle"), { target: { value: "ada" } });
    fireEvent.submit(getForm("Create workspace"));

    expect(await screen.findByRole("heading", { name: "Ada Studio" })).toBeInTheDocument();
    expect(screen.getByText("Owner", { exact: true })).toBeInTheDocument();
  });

  it("shows a returning owner their first workspace", async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(authClient.organization.list).mockResolvedValue({
      data: [{ id: "workspace-1", name: "Ada Studio", slug: "ada" }],
    } as never);
    vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
      data: { members: [{ role: "owner", userId: "member-1" }] },
    } as never);

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Ada Studio" })).toBeInTheDocument();
    expect(screen.getByText("Owner", { exact: true })).toBeInTheDocument();
  });

  it("takes a new visitor to sign in after registration", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({ data: {} } as never);

    render(<App />);

    await submitSignUpForm();

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(authClient.signIn.email).not.toHaveBeenCalled();
  });

  it("shows a generic sign-up failure without leaving the account form", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      error: { message: "An account already exists for that email." },
    } as never);

    render(<App />);

    await submitSignUpForm();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't create your account. Check your details and try again.",
    );
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });

  it("does not disclose an existing account after generic registration", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({ data: {} } as never);

    render(<App />);

    await submitSignUpForm();

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    expect(authClient.signIn.email).not.toHaveBeenCalled();
  });

  it("does not create a workspace after generic registration", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({ data: {} } as never);

    render(<App />);

    await submitSignUpForm();

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(authClient.organization.create).not.toHaveBeenCalled();
  });

  it("keeps an authenticated user in onboarding when workspace creation throws", async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(authClient.organization.list).mockResolvedValue({ data: [] } as never);
    vi.mocked(authClient.organization.create).mockRejectedValue(new Error("Network unavailable"));

    render(<App />);

    await screen.findByRole("heading", { name: "Create your workspace" });
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Ada Studio" } });
    fireEvent.change(screen.getByLabelText("Workspace handle"), { target: { value: "ada" } });
    fireEvent.submit(getForm("Create workspace"));

    expect(
      await screen.findByRole("heading", { name: "Create your workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't create your workspace. Please try again.",
    );
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
  });

  it("signs in a returning workspace member", async () => {
    vi.mocked(authClient.getSession)
      .mockResolvedValueOnce({ data: null } as never)
      .mockResolvedValue({ data: { user: { id: "member-1" } } } as never);
    vi.mocked(authClient.signIn.email).mockResolvedValue({ data: {} } as never);
    vi.mocked(authClient.organization.list).mockResolvedValue({
      data: [{ id: "workspace-1", name: "Ada Studio", slug: "ada" }],
    } as never);
    vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
      data: { members: [{ role: "editor", userId: "member-1" }] },
    } as never);

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery-staple" },
    });
    fireEvent.submit(getForm("Sign in"));

    expect(await screen.findByRole("heading", { name: "Ada Studio" })).toBeInTheDocument();
  });

  it("keeps the sign-in form visible when authentication fails", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: { message: "Invalid email or password." },
    } as never);

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.submit(getForm("Sign in"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't sign you in. Check your details and try again.",
    );
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("shows a retry state when workspace loading fails", async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(authClient.organization.list).mockResolvedValue({
      data: null,
      error: { message: "Service unavailable" },
    } as never);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "We couldn't load your workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("shows a retry state when session loading returns an error", async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error: { message: "Service unavailable" },
    } as never);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "We couldn't load your workspace" }),
    ).toBeInTheDocument();
  });

  it("clears an account error when moving to sign in", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      error: { message: "Registration failed." },
    } as never);

    render(<App />);

    await submitSignUpForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in instead" }));

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

function getForm(buttonName: string): HTMLFormElement {
  const form = screen.getByRole("button", { name: buttonName }).closest("form");
  if (!form) {
    throw new Error("The form is missing.");
  }
  return form;
}

async function submitSignUpForm(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "Create a workspace" }));
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "correct-horse-battery-staple" },
  });
  fireEvent.submit(getForm("Continue to sign in"));
}
