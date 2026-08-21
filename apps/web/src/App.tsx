import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { authClient } from "./auth-client.js";
import { MetricCard } from "./components/MetricCard.js";

type Screen = "dashboard" | "landing" | "onboarding" | "sign-in" | "sign-up";

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

function getErrorMessage(error: { message?: string } | null): string {
  return error?.message ?? "Something went wrong. Please try again.";
}

export function App() {
  const [error, setError] = useState<string>();
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screen, setScreen] = useState<Screen>("landing");
  const [workspace, setWorkspace] = useState<Workspace>();
  const [workspaceRole, setWorkspaceRole] = useState("Workspace member");

  useEffect(() => {
    void loadExistingSession();
  }, []);

  async function loadExistingSession(): Promise<void> {
    const session = await authClient.getSession();

    if (!session.data?.user) {
      setIsLoading(false);
      return;
    }

    const organizations = await authClient.organization.list();
    const firstWorkspace = organizations.data?.[0];

    if (firstWorkspace) {
      setWorkspace(firstWorkspace);
      setScreen("dashboard");
    } else {
      setScreen("onboarding");
    }

    setIsLoading(false);
  }

  function updateForm(field: keyof typeof form, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createWorkspace(): Promise<boolean> {
    const workspaceResult = await authClient.organization.create({
      keepCurrentActiveOrganization: true,
      name: form.workspaceName.trim(),
      slug: form.workspaceHandle.trim(),
    });

    if (workspaceResult.error || !workspaceResult.data) {
      setError(getErrorMessage(workspaceResult.error));
      return false;
    }

    setWorkspace(workspaceResult.data);
    setWorkspaceRole("Owner");
    setScreen("dashboard");
    return true;
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    const result = await authClient.signUp.email({
      email: form.email.trim(),
      name: form.name.trim(),
      password: form.password,
    });

    if (result.error) {
      setError(getErrorMessage(result.error));
      setIsSubmitting(false);
      return;
    }

    const created = await createWorkspace();
    if (!created) {
      setScreen("onboarding");
    }
    setIsSubmitting(false);
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    const result = await authClient.signIn.email({
      email: form.email.trim(),
      password: form.password,
    });

    if (result.error) {
      setError(getErrorMessage(result.error));
      setIsSubmitting(false);
      return;
    }

    await loadExistingSession();
    setIsSubmitting(false);
  }

  async function handleWorkspaceRetry(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    await createWorkspace();
    setIsSubmitting(false);
  }

  if (isLoading) {
    return <main className="site-shell" aria-busy="true" />;
  }

  if (screen === "dashboard" && workspace) {
    return <Dashboard role={workspaceRole} workspace={workspace} />;
  }

  if (screen === "sign-up") {
    return (
      <AuthLayout title="Create your workspace">
        <form className="auth-form" onSubmit={handleSignUp}>
          <TextField label="Your name" onChange={(value) => updateForm("name", value)} value={form.name} />
          <TextField label="Email" onChange={(value) => updateForm("email", value)} type="email" value={form.email} />
          <TextField label="Password" onChange={(value) => updateForm("password", value)} type="password" value={form.password} />
          <TextField label="Workspace name" onChange={(value) => updateForm("workspaceName", value)} value={form.workspaceName} />
          <TextField label="Workspace handle" onChange={(value) => updateForm("workspaceHandle", value.toLowerCase())} pattern="[a-z0-9][a-z0-9-]{1,28}[a-z0-9]" value={form.workspaceHandle} />
          <FormError error={error} />
          <button disabled={isSubmitting} type="submit">Create workspace</button>
        </form>
        <button className="text-button" onClick={() => setScreen("sign-in")} type="button">Sign in instead</button>
      </AuthLayout>
    );
  }

  if (screen === "sign-in") {
    return (
      <AuthLayout title="Welcome back">
        <form className="auth-form" onSubmit={handleSignIn}>
          <TextField label="Email" onChange={(value) => updateForm("email", value)} type="email" value={form.email} />
          <TextField label="Password" onChange={(value) => updateForm("password", value)} type="password" value={form.password} />
          <FormError error={error} />
          <button disabled={isSubmitting} type="submit">Sign in</button>
        </form>
      </AuthLayout>
    );
  }

  if (screen === "onboarding") {
    return (
      <AuthLayout title="Create your workspace">
        <p className="intro">Your account is ready. Choose the handle for your first workspace.</p>
        <form className="auth-form" onSubmit={handleWorkspaceRetry}>
          <TextField label="Workspace name" onChange={(value) => updateForm("workspaceName", value)} value={form.workspaceName} />
          <TextField label="Workspace handle" onChange={(value) => updateForm("workspaceHandle", value.toLowerCase())} pattern="[a-z0-9][a-z0-9-]{1,28}[a-z0-9]" value={form.workspaceHandle} />
          <FormError error={error} />
          <button disabled={isSubmitting} type="submit">Create workspace</button>
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
          <button onClick={() => setScreen("sign-up")} type="button">Create a workspace</button>
          <button className="text-button" onClick={() => setScreen("sign-in")} type="button">Sign in</button>
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

function AuthLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <main className="site-shell auth-shell">
      <header className="topbar">
        <a className="wordmark" href="/">short<span>.it</span></a>
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
        <a className="wordmark" href="/">short<span>.it</span></a>
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
  return error ? <p className="form-error" role="alert">{error}</p> : null;
}

function TextField({
  label,
  onChange,
  pattern,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  pattern?: string;
  type?: string;
  value: string;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");

  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} onChange={(event) => onChange(event.target.value)} pattern={pattern} required type={type} value={value} />
    </label>
  );
}
