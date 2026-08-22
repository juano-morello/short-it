import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { analyticsGateway } from "./analytics-gateway.js";
import { linkGateway } from "./link-gateway.js";
import { workspaceGateway } from "./workspace-gateway.js";

vi.mock("./workspace-gateway.js", () => ({
  workspaceGateway: {
    createWorkspace: vi.fn(),
    getSession: vi.fn(),
    getWorkspace: vi.fn(),
    listWorkspaces: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
  },
}));

vi.mock("./link-gateway.js", () => ({
  linkGateway: {
    publish: vi.fn(),
  },
}));

vi.mock("./analytics-gateway.js", () => ({
  analyticsGateway: {
    getOverview: vi.fn(),
  },
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workspaceGateway.getSession).mockResolvedValue({ data: null } as never);
    vi.mocked(analyticsGateway.getOverview).mockResolvedValue({
      data: { breakdowns: { countries: [], devices: [], referrers: [] }, daily: [] },
    });
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
    vi.mocked(workspaceGateway.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(workspaceGateway.listWorkspaces).mockResolvedValue({ data: [] } as never);
    vi.mocked(workspaceGateway.createWorkspace)
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
    expect(workspaceGateway.createWorkspace).toHaveBeenCalledWith({
      name: "Ada Studio",
      slug: "app",
    });

    fireEvent.change(screen.getByLabelText("Workspace handle"), { target: { value: "ada" } });
    fireEvent.submit(getForm("Create workspace"));

    expect(await screen.findByRole("heading", { name: "Ada Studio" })).toBeInTheDocument();
    expect(screen.getByText("Owner", { exact: true })).toBeInTheDocument();
  });

  it("shows a returning owner their first workspace", async () => {
    vi.mocked(workspaceGateway.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(workspaceGateway.listWorkspaces).mockResolvedValue({
      data: [{ id: "workspace-1", name: "Ada Studio", slug: "ada" }],
    } as never);
    vi.mocked(workspaceGateway.getWorkspace).mockResolvedValue({
      data: { members: [{ role: "owner", userId: "member-1" }] },
    } as never);

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Ada Studio" })).toBeInTheDocument();
    expect(screen.getByText("Owner", { exact: true })).toBeInTheDocument();
  });

  it("takes a new visitor to sign in after registration", async () => {
    vi.mocked(workspaceGateway.signUp).mockResolvedValue({ data: {} } as never);

    render(<App />);

    await submitSignUpForm();

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(workspaceGateway.signIn).not.toHaveBeenCalled();
  });

  it("shows a generic sign-up failure without leaving the account form", async () => {
    vi.mocked(workspaceGateway.signUp).mockResolvedValue({
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
    vi.mocked(workspaceGateway.signUp).mockResolvedValue({ data: {} } as never);

    render(<App />);

    await submitSignUpForm();

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    expect(workspaceGateway.signIn).not.toHaveBeenCalled();
  });

  it("does not create a workspace after generic registration", async () => {
    vi.mocked(workspaceGateway.signUp).mockResolvedValue({ data: {} } as never);

    render(<App />);

    await submitSignUpForm();

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(workspaceGateway.createWorkspace).not.toHaveBeenCalled();
  });

  it("keeps an authenticated user in onboarding when workspace creation throws", async () => {
    vi.mocked(workspaceGateway.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(workspaceGateway.listWorkspaces).mockResolvedValue({ data: [] } as never);
    vi.mocked(workspaceGateway.createWorkspace).mockRejectedValue(new Error("Network unavailable"));

    render(<App />);

    await screen.findByRole("heading", { name: "Create your workspace" });
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Ada Studio" } });
    fireEvent.change(screen.getByLabelText("Workspace handle"), { target: { value: "ada" } });
    fireEvent.submit(getForm("Create workspace"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't create your workspace. Please try again.",
    );
    expect(screen.getByRole("heading", { name: "Create your workspace" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
  });

  it("signs in a returning workspace member", async () => {
    vi.mocked(workspaceGateway.getSession)
      .mockResolvedValueOnce({ data: null } as never)
      .mockResolvedValue({ data: { user: { id: "member-1" } } } as never);
    vi.mocked(workspaceGateway.signIn).mockResolvedValue({ data: {} } as never);
    vi.mocked(workspaceGateway.listWorkspaces).mockResolvedValue({
      data: [{ id: "workspace-1", name: "Ada Studio", slug: "ada" }],
    } as never);
    vi.mocked(workspaceGateway.getWorkspace).mockResolvedValue({
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
    vi.mocked(workspaceGateway.signIn).mockResolvedValue({
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
    vi.mocked(workspaceGateway.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(workspaceGateway.listWorkspaces).mockResolvedValue({
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
    vi.mocked(workspaceGateway.getSession).mockResolvedValue({
      data: null,
      error: { message: "Service unavailable" },
    } as never);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "We couldn't load your workspace" }),
    ).toBeInTheDocument();
  });

  it("clears an account error when moving to sign in", async () => {
    vi.mocked(workspaceGateway.signUp).mockResolvedValue({
      error: { message: "Registration failed." },
    } as never);

    render(<App />);

    await submitSignUpForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in instead" }));

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets an owner publish a destination without choosing the CUID slug", async () => {
    vi.mocked(workspaceGateway.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(workspaceGateway.listWorkspaces).mockResolvedValue({
      data: [{ id: "workspace-1", name: "Ada Studio", slug: "ada" }],
    } as never);
    vi.mocked(workspaceGateway.getWorkspace).mockResolvedValue({
      data: { members: [{ role: "owner", userId: "member-1" }] },
    } as never);
    vi.mocked(linkGateway.publish).mockResolvedValue({
      data: {
        createdAt: "2026-08-21T12:00:00.000Z",
        destinationUrl: "https://example.com/portfolio",
        id: "link-1",
        organizationId: "workspace-1",
        publishedAt: "2026-08-21T12:00:00.000Z",
        slug: "cmfoo123",
      },
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Ada Studio" });
    fireEvent.change(screen.getByLabelText("Destination URL"), {
      target: { value: "https://example.com/portfolio" },
    });
    fireEvent.submit(getForm("Publish link"));

    expect(await screen.findByText("ada/cmfoo123")).toBeInTheDocument();
    expect(linkGateway.publish).toHaveBeenCalledWith({
      destinationUrl: "https://example.com/portfolio",
      organizationId: "workspace-1",
    });
    expect(screen.queryByLabelText(/slug/i)).not.toBeInTheDocument();
  });

  it("lets a member with editor among multiple roles publish a destination", async () => {
    vi.mocked(workspaceGateway.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(workspaceGateway.listWorkspaces).mockResolvedValue({
      data: [{ id: "workspace-1", name: "Ada Studio", slug: "ada" }],
    } as never);
    vi.mocked(workspaceGateway.getWorkspace).mockResolvedValue({
      data: { members: [{ role: "analyst,editor", userId: "member-1" }] },
    } as never);

    render(<App />);

    expect(await screen.findByRole("button", { name: "Publish link" })).toBeInTheDocument();
  });

  it("does not show publishing controls to an analyst", async () => {
    vi.mocked(workspaceGateway.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(workspaceGateway.listWorkspaces).mockResolvedValue({
      data: [{ id: "workspace-1", name: "Ada Studio", slug: "ada" }],
    } as never);
    vi.mocked(workspaceGateway.getWorkspace).mockResolvedValue({
      data: { members: [{ role: "analyst", userId: "member-1" }] },
    } as never);

    render(<App />);

    expect(await screen.findByText(/cannot publish links/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish link" })).not.toBeInTheDocument();
  });

  it("shows workspace-scoped aggregate analytics to an analyst", async () => {
    vi.mocked(workspaceGateway.getSession).mockResolvedValue({
      data: { user: { id: "member-1" } },
    } as never);
    vi.mocked(workspaceGateway.listWorkspaces).mockResolvedValue({
      data: [{ id: "workspace-1", name: "Ada Studio", slug: "ada" }],
    } as never);
    vi.mocked(workspaceGateway.getWorkspace).mockResolvedValue({
      data: { members: [{ role: "analyst", userId: "member-1" }] },
    } as never);
    vi.mocked(analyticsGateway.getOverview).mockResolvedValue({
      data: {
        breakdowns: {
          countries: [{ clicks: 2, value: "Unknown" }],
          devices: [{ clicks: 2, value: "desktop" }],
          referrers: [{ clicks: 2, value: "direct" }],
        },
        daily: [{ clicks: 2, dailyUniqueLinkVisitors: 1, date: "2026-08-22" }],
      },
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Redirect performance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("DAILY UNIQUE LINK VISITORS")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(analyticsGateway.getOverview).toHaveBeenCalledWith("workspace-1");
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
