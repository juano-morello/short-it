import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { authClient } from "./auth-client.js";
import { MetricCard } from "./components/MetricCard.js";

type Screen = "dashboard" | "landing" | "onboarding" | "session-error" | "sign-in" | "sign-up";
type SessionState = "dashboard" | "needs-workspace" | "signed-out" | "unavailable";

type Workspace = {
  id: string;
  name: string;
  slug: string;
};

const initialForm = {
  email: "",
  name: "",
  password: "",
  workspaceHandle: "",
  workspaceName: "",
};

function getWorkspaceErrorMessage(error: { message?: string } | null): string {
  return error?.message ?? "Something went wrong. Please try again.";
}

const accountCreationErrorMessage =
  "We couldn't create your account. Check your details and try again.";
const signInErrorMessage = "We couldn't sign you in. Check your details and try again.";

export function App() {
  const [error, setError] = useState<string>();
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screen, setScreen] = useState<Screen>("landing");
  const [workspace, setWorkspace] = useState<Workspace>();
  const [workspaceRole, setWorkspaceRole] = useState("Workspace member");

  const loadExistingSession = useCallback(async (): Promise<SessionState> => {
    setIsLoading(true);
    setError(undefined);

    try {
      const session = await authClient.getSession();
      if (session.error) {
        throw new Error(session.error.message);
      }

      if (!session.data?.user) {
        setScreen("landing");
        return "signed-out";
      }
      const user = session.data.user;

      const organizations = await authClient.organization.list();
      if (organizations.error) {
        throw new Error(organizations.error.message);
      }

      const firstWorkspace = organizations.data?.[0];

      if (!firstWorkspace) {
        setScreen("onboarding");
        return "needs-workspace";
      }

      const fullWorkspace = await authClient.organization.getFullOrganization({
        query: { organizationId: firstWorkspace.id },
      });
      if (fullWorkspace.error) {
        throw new Error(fullWorkspace.error.message);
      }

      const membership = fullWorkspace.data?.members.find((member) => member.userId === user.id);
      if (!membership) {
        throw new Error("The current user's workspace membership could not be resolved.");
      }

      setWorkspace(firstWorkspace);
      setWorkspaceRole(formatRole(membership.role));
      setScreen("dashboard");
      return "dashboard";
    } catch {
      setError("We couldn't load your workspace. Please try again.");
      setScreen("session-error");
      return "unavailable";
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExistingSession();
  }, [loadExistingSession]);

  function updateForm(field: keyof typeof form, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function moveTo(nextScreen: Screen): void {
    setError(undefined);
    setScreen(nextScreen);
  }

  async function createWorkspace(): Promise<boolean> {
    const workspaceResult = await authClient.organization.create({
      keepCurrentActiveOrganization: true,
      name: form.workspaceName.trim(),
      slug: form.workspaceHandle.trim(),
    });

    if (workspaceResult.error || !workspaceResult.data) {
      setError(getWorkspaceErrorMessage(workspaceResult.error));
      return false;
    }

    setWorkspace(workspaceResult.data);
    setWorkspaceRole("Owner");
    setError(undefined);
    setScreen("dashboard");
    return true;
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    try {
      const signUp = await authClient.signUp.email({
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
      });

      if (signUp.error) {
        setError(accountCreationErrorMessage);
        return;
      }

      moveTo("sign-in");
    } catch {
      setError(accountCreationErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.email({
        email: form.email.trim(),
        password: form.password,
      });

      if (result.error) {
        setError(signInErrorMessage);
        return;
      }

      await loadExistingSession();
    } catch {
      setError(signInErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWorkspaceRetry(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await createWorkspace();
    } catch {
      setError("We couldn't create your workspace. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <main className="site-shell" aria-busy="true" />;
  }

  if (screen === "dashboard" && workspace) {
    return <Dashboard role={workspaceRole} workspace={workspace} />;
  }

  if (screen === "session-error") {
    return (
      <AuthLayout title="We couldn't load your workspace">
        <FormError error={error} />
        <button onClick={() => void loadExistingSession()} type="button">
          Try again
        </button>
      </AuthLayout>
    );
  }

  if (screen === "sign-up") {
    return (
      <AuthLayout title="Create your account">
        <p className="intro">Create your account first, then sign in to choose your workspace.</p>
        <form className="auth-form" onSubmit={handleSignUp}>
          <TextField
            label="Your name"
            maxLength={120}
            onChange={(value) => updateForm("name", value)}
            value={form.name}
          />
          <TextField
            label="Email"
            onChange={(value) => updateForm("email", value)}
            type="email"
            value={form.email}
          />
          <TextField
            label="Password"
            onChange={(value) => updateForm("password", value)}
            type="password"
            value={form.password}
          />
          <FormError error={error} />
          <button disabled={isSubmitting} type="submit">
            Continue to sign in
          </button>
        </form>
        <button className="text-button" onClick={() => moveTo("sign-in")} type="button">
          Sign in instead
        </button>
      </AuthLayout>
    );
  }

  if (screen === "sign-in") {
    return (
      <AuthLayout title="Welcome back">
        <form className="auth-form" onSubmit={handleSignIn}>
          <TextField
            label="Email"
            onChange={(value) => updateForm("email", value)}
            type="email"
            value={form.email}
          />
          <TextField
            label="Password"
            onChange={(value) => updateForm("password", value)}
            type="password"
            value={form.password}
          />
          <FormError error={error} />
          <button disabled={isSubmitting} type="submit">
            Sign in
          </button>
        </form>
      </AuthLayout>
    );
  }

  if (screen === "onboarding") {
    return (
      <AuthLayout title="Create your workspace">
        <p className="intro">Your account is ready. Choose the handle for your first workspace.</p>
        <form className="auth-form" onSubmit={handleWorkspaceRetry}>
          <TextField
            label="Workspace name"
            maxLength={120}
            onChange={(value) => updateForm("workspaceName", value)}
            value={form.workspaceName}
          />
          <TextField
            label="Workspace handle"
            onChange={(value) => updateForm("workspaceHandle", value.toLowerCase())}
            maxLength={30}
            minLength={3}
            value={form.workspaceHandle}
          />
          <FormError error={error} />
          <button disabled={isSubmitting} type="submit">
            Create workspace
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="/">
          short<span>.it</span>
        </a>
        <span className="environment">SELF-SERVE LINK OPS</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">ONE LINK. CLEAR SIGNAL.</p>
        <h1 id="hero-title">
          Make a <mark>short</mark> link worth tracking.
        </h1>
        <p className="intro">
          A workspace-first home for immutable destinations and the redirect analytics that make
          them useful.
        </p>
        <div className="action-row">
          <button onClick={() => moveTo("sign-up")} type="button">
            Create a workspace
          </button>
          <button className="text-button" onClick={() => moveTo("sign-in")} type="button">
            Sign in
          </button>
          <a href="#architecture">See the build notes</a>
        </div>
      </section>

      <section className="proof-grid" aria-label="Platform capabilities">
        <MetricCard label="LINK SHAPE" value="handle/slug" detail="Clear, portable public URLs" />
        <MetricCard label="REDIRECT PATH" value="first" detail="Analytics never block delivery" />
        <MetricCard label="METRICS WINDOW" value="12 months" detail="Aggregate retention only" />
      </section>

      <section className="build-note" id="architecture">
        <p className="eyebrow">FOUNDATION / 01</p>
        <h2>Built to be a small product, not a small backend.</h2>
        <p>
          React runs the dashboard. NestJS owns the API and redirect path. PostgreSQL keeps
          workspace boundaries explicit. This surface is the first verified integration point before
          link management ships.
        </p>
      </section>
    </main>
  );
}

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function AuthLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <main className="site-shell auth-shell">
      <header className="topbar">
        <a className="wordmark" href="/">
          short<span>.it</span>
        </a>
        <span className="environment">SELF-SERVE LINK OPS</span>
      </header>
      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="eyebrow">FOUNDATION / 02</p>
        <h1 id="auth-title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

function Dashboard({ role, workspace }: { role: string; workspace: Workspace }) {
  return (
    <main className="site-shell auth-shell">
      <header className="topbar">
        <a className="wordmark" href="/">
          short<span>.it</span>
        </a>
        <span className="environment">{role.toUpperCase()}</span>
      </header>
      <section className="auth-panel" aria-labelledby="workspace-title">
        <p className="eyebrow">WORKSPACE / {workspace.slug}</p>
        <h1 id="workspace-title">{workspace.name}</h1>
        <p className="intro">Your workspace is ready for its first immutable destination.</p>
        <span className="role-chip">{role}</span>
      </section>
    </main>
  );
}

function FormError({ error }: { error: string | undefined }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}

function TextField({
  label,
  maxLength,
  minLength,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  maxLength?: number;
  minLength?: number;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");

  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        maxLength={maxLength}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </label>
  );
}
