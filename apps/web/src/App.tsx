import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { type AnalyticsOverview, analyticsGateway } from "./analytics-gateway.js";
import { MetricCard } from "./components/MetricCard.js";
import { linkGateway, type PublishedLink } from "./link-gateway.js";
import { workspaceGateway } from "./workspace-gateway.js";

type Screen = "dashboard" | "landing" | "onboarding" | "session-error" | "sign-in" | "sign-up";
type SessionState = "dashboard" | "needs-workspace" | "signed-out" | "unavailable";

type Workspace = {
  id: string;
  name: string;
  slug: string;
};

type WorkspaceRole = string;

const initialForm = {
  email: "",
  name: "",
  password: "",
  destinationUrl: "",
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
  const [analyticsError, setAnalyticsError] = useState<string>();
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview>();
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishedLink, setPublishedLink] = useState<PublishedLink>();
  const [screen, setScreen] = useState<Screen>("landing");
  const [workspace, setWorkspace] = useState<Workspace>();
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>();

  const loadExistingSession = useCallback(async (): Promise<SessionState> => {
    setIsLoading(true);
    setError(undefined);

    try {
      const session = await workspaceGateway.getSession();
      if (session.error) {
        throw new Error(session.error.message);
      }

      if (!session.data?.user) {
        setScreen("landing");
        return "signed-out";
      }
      const user = session.data.user;

      const organizations = await workspaceGateway.listWorkspaces();
      if (organizations.error) {
        throw new Error(organizations.error.message);
      }

      const firstWorkspace = organizations.data?.[0];

      if (!firstWorkspace) {
        setScreen("onboarding");
        return "needs-workspace";
      }

      const fullWorkspace = await workspaceGateway.getWorkspace(firstWorkspace.id);
      if (fullWorkspace.error) {
        throw new Error(fullWorkspace.error.message);
      }

      const membership = fullWorkspace.data?.members.find((member) => member.userId === user.id);
      if (!membership) {
        throw new Error("The current user's workspace membership could not be resolved.");
      }

      setWorkspace(firstWorkspace);
      setWorkspaceRole(membership.role as WorkspaceRole);
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

  useEffect(() => {
    if (!workspace) return;
    let isCurrent = true;
    setAnalyticsError(undefined);
    setAnalyticsOverview(undefined);
    setIsAnalyticsLoading(true);
    void analyticsGateway.getOverview(workspace.id).then((result) => {
      if (!isCurrent) return;
      if (result.error) setAnalyticsError(result.error);
      else setAnalyticsOverview(result.data);
      setIsAnalyticsLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, [workspace]);

  function updateForm(field: keyof typeof form, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function moveTo(nextScreen: Screen): void {
    setError(undefined);
    setScreen(nextScreen);
  }

  async function createWorkspace(): Promise<boolean> {
    const workspaceResult = await workspaceGateway.createWorkspace({
      name: form.workspaceName.trim(),
      slug: form.workspaceHandle.trim(),
    });

    if (workspaceResult.error || !workspaceResult.data) {
      setError(getWorkspaceErrorMessage(workspaceResult.error));
      return false;
    }

    setWorkspace(workspaceResult.data);
    setWorkspaceRole("owner");
    setError(undefined);
    setScreen("dashboard");
    return true;
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    try {
      const signUp = await workspaceGateway.signUp({
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
      const result = await workspaceGateway.signIn({
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

  async function handleLinkPublication(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!workspace) {
      return;
    }

    setError(undefined);
    setIsSubmitting(true);
    const result = await linkGateway.publish({
      destinationUrl: form.destinationUrl.trim(),
      organizationId: workspace.id,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setPublishedLink(result.data);
      updateForm("destinationUrl", "");
    }
    setIsSubmitting(false);
  }

  if (isLoading) {
    return <main className="site-shell" aria-busy="true" />;
  }

  if (screen === "dashboard" && workspace && workspaceRole) {
    return (
      <Dashboard
        error={error}
        analyticsError={analyticsError}
        analyticsOverview={analyticsOverview}
        isAnalyticsLoading={isAnalyticsLoading}
        isSubmitting={isSubmitting}
        onPublish={handleLinkPublication}
        onUpdateDestination={(value) => updateForm("destinationUrl", value)}
        publishedLink={publishedLink}
        role={workspaceRole}
        value={form.destinationUrl}
        workspace={workspace}
      />
    );
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

function Dashboard({
  analyticsError,
  analyticsOverview,
  error,
  isAnalyticsLoading,
  isSubmitting,
  onPublish,
  onUpdateDestination,
  publishedLink,
  role,
  value,
  workspace,
}: {
  analyticsError: string | undefined;
  analyticsOverview: AnalyticsOverview | undefined;
  error: string | undefined;
  isAnalyticsLoading: boolean;
  isSubmitting: boolean;
  onPublish: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpdateDestination: (value: string) => void;
  publishedLink: PublishedLink | undefined;
  role: WorkspaceRole;
  value: string;
  workspace: Workspace;
}) {
  // This is presentation-only. LinksService is the authorization boundary.
  const canPublish = role
    .split(",")
    .some((assignedRole) => assignedRole === "owner" || assignedRole === "editor");

  return (
    <main className="site-shell auth-shell">
      <header className="topbar">
        <a className="wordmark" href="/">
          short<span>.it</span>
        </a>
        <span className="environment">{formatRole(role).toUpperCase()}</span>
      </header>
      <section className="auth-panel" aria-labelledby="workspace-title">
        <p className="eyebrow">WORKSPACE / {workspace.slug}</p>
        <h1 id="workspace-title">{workspace.name}</h1>
        <p className="intro">Your workspace is ready for its first immutable destination.</p>
        <span className="role-chip">{formatRole(role)}</span>
        {canPublish ? (
          <form className="auth-form" onSubmit={onPublish}>
            <TextField
              label="Destination URL"
              onChange={onUpdateDestination}
              type="url"
              value={value}
            />
            <FormError error={error} />
            <button disabled={isSubmitting} type="submit">
              Publish link
            </button>
          </form>
        ) : (
          <p className="intro">
            Your analyst role can view link performance but cannot publish links.
          </p>
        )}
        {publishedLink ? (
          <p className="published-link">
            Published link:{" "}
            <strong>
              {workspace.slug}/{publishedLink.slug}
            </strong>
          </p>
        ) : null}
        <AnalyticsPanel
          error={analyticsError}
          isLoading={isAnalyticsLoading}
          overview={analyticsOverview}
        />
      </section>
    </main>
  );
}

function AnalyticsPanel({
  error,
  isLoading,
  overview,
}: {
  error: string | undefined;
  isLoading: boolean;
  overview: AnalyticsOverview | undefined;
}) {
  if (isLoading) {
    return <p className="analytics-status">Loading analytics…</p>;
  }
  if (error) {
    return (
      <p className="analytics-status" role="alert">
        {error}
      </p>
    );
  }
  if (!overview) return null;

  const clicks = overview.daily.reduce((total, day) => total + day.clicks, 0);
  const dailyUniqueLinkVisitors = overview.daily.reduce(
    (total, day) => total + day.dailyUniqueLinkVisitors,
    0,
  );

  return (
    <section className="analytics-panel" aria-labelledby="analytics-title">
      <div className="analytics-heading">
        <div>
          <p className="eyebrow">ANALYTICS / LAST 12 MONTHS</p>
          <h2 id="analytics-title">Redirect performance</h2>
        </div>
        <p className="analytics-note">
          Aggregated signals only. Redirect delivery always comes first.
        </p>
      </div>
      <div className="analytics-totals">
        <MetricCard label="TOTAL CLICKS" value={String(clicks)} detail="Successful GET redirects" />
        <MetricCard
          label="DAILY UNIQUE LINK VISITORS"
          value={String(dailyUniqueLinkVisitors)}
          detail="Summed per-link daily deduplication"
        />
      </div>
      {overview.daily.length === 0 ? (
        <p className="analytics-status">No redirect analytics have been recorded yet.</p>
      ) : (
        <div className="analytics-grid">
          <AnalyticsTable
            columns={["Day", "Clicks", "Daily unique link visitors"]}
            rows={overview.daily
              .slice(0, 14)
              .map((day) => [day.date, String(day.clicks), String(day.dailyUniqueLinkVisitors)])}
            title="Daily totals"
          />
          <AnalyticsTable
            columns={["Country", "Clicks"]}
            rows={overview.breakdowns.countries
              .slice(0, 5)
              .map((item) => [item.value, String(item.clicks)])}
            title="Countries"
          />
          <AnalyticsTable
            columns={["Device", "Clicks"]}
            rows={overview.breakdowns.devices
              .slice(0, 5)
              .map((item) => [item.value, String(item.clicks)])}
            title="Devices"
          />
          <AnalyticsTable
            columns={["Referrer", "Clicks"]}
            rows={overview.breakdowns.referrers
              .slice(0, 5)
              .map((item) => [item.value, String(item.clicks)])}
            title="Referrers"
          />
        </div>
      )}
    </section>
  );
}

function AnalyticsTable({
  columns,
  rows,
  title,
}: {
  columns: string[];
  rows: string[][];
  title: string;
}) {
  return (
    <section className="analytics-table-wrap" aria-labelledby={`${title.toLowerCase()}-title`}>
      <h3 id={`${title.toLowerCase()}-title`}>{title}</h3>
      {rows.length === 0 ? (
        <p className="analytics-status">No data.</p>
      ) : (
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join("-")}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
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
