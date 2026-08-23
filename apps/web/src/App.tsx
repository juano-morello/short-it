import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { type AnalyticsOverview, analyticsGateway } from "./analytics-gateway.js";
import { MetricCard } from "./components/MetricCard.js";
import { linkGateway, type PublishedLink, type WorkspaceLink } from "./link-gateway.js";
import { workspaceGateway } from "./workspace-gateway.js";

type Screen =
  | "dashboard"
  | "invitation"
  | "invitation-unavailable"
  | "landing"
  | "onboarding"
  | "session-error"
  | "sign-in"
  | "sign-up";
type SessionState = "dashboard" | "needs-workspace" | "signed-out" | "unavailable";

type Workspace = {
  id: string;
  name: string;
  slug: string;
};

type WorkspaceRole = string;
type PendingInvitation = { email: string; id: string; role: "analyst" | "editor" };
type InvitationListState = "idle" | "loaded" | "loading" | "error";
type DashboardRoute = "analytics" | "links" | "settings";

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

function getDashboardRoute(pathname = window.location.pathname): DashboardRoute {
  if (pathname === "/analytics") return "analytics";
  if (pathname === "/settings") return "settings";
  return "links";
}

function dashboardPath(route: DashboardRoute): string {
  return route === "links" ? "/links" : `/${route}`;
}

export function App() {
  const [error, setError] = useState<string>();
  const [analyticsError, setAnalyticsError] = useState<string>();
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview>();
  const [accountEmail, setAccountEmail] = useState<string>();
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [invitationActionError, setInvitationActionError] = useState<string>();
  const [invitationListError, setInvitationListError] = useState<string>();
  const [invitationListState, setInvitationListState] = useState<InvitationListState>("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [isInvitationSubmitting, setIsInvitationSubmitting] = useState(false);
  const [isDeletionSubmitting, setIsDeletionSubmitting] = useState(false);
  const [isLinksLoading, setIsLinksLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const acceptedInvitationOrganizationId = useRef<string | undefined>(undefined);
  const linksRequestVersion = useRef(0);
  const pendingInvitationId = useRef<string | undefined>(undefined);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [invitationLink, setInvitationLink] = useState<string>();
  const [links, setLinks] = useState<WorkspaceLink[]>([]);
  const [linksError, setLinksError] = useState<string>();
  const [nextLinkCursor, setNextLinkCursor] = useState<string>();
  const [publishedLink, setPublishedLink] = useState<PublishedLink>();
  const [dashboardRoute, setDashboardRoute] = useState<DashboardRoute>(getDashboardRoute);
  const [screen, setScreen] = useState<Screen>("landing");
  const [workspace, setWorkspace] = useState<Workspace>();
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>();

  const navigateDashboard = useCallback((route: DashboardRoute, replace = false): void => {
    const pathname = dashboardPath(route);
    window.history[replace ? "replaceState" : "pushState"](null, "", pathname);
    setDashboardRoute(route);
  }, []);

  const loadExistingSession = useCallback(
    async (invitationToAccept?: string): Promise<SessionState> => {
      setIsLoading(true);
      setError(undefined);

      try {
        const invitationIdFromHash = getInvitationIdFromHash();
        if (invitationIdFromHash) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
          pendingInvitationId.current = invitationIdFromHash;
        }

        const session = await workspaceGateway.getSession();
        if (session.error) {
          throw new Error(session.error.message);
        }

        if (!session.data?.user) {
          setAccountEmail(undefined);
          setScreen("landing");
          return "signed-out";
        }
        setAccountEmail(session.data.user.email);
        const invitationId =
          invitationToAccept ?? invitationIdFromHash ?? pendingInvitationId.current;
        if (invitationId) {
          if (!invitationToAccept) {
            setScreen("invitation");
            return "needs-workspace";
          }
          const accepted = await workspaceGateway.acceptInvitation(invitationId);
          if (accepted.error) {
            if (!accepted.retryable) {
              pendingInvitationId.current = undefined;
              setScreen("invitation-unavailable");
              return "needs-workspace";
            }
            throw new Error("We couldn't accept this invitation. It may no longer be available.");
          }
          pendingInvitationId.current = undefined;
          acceptedInvitationOrganizationId.current = (
            accepted.data as { invitation?: { organizationId?: string } } | undefined
          )?.invitation?.organizationId;
        }

        const organizations = await workspaceGateway.listWorkspaces();
        if (organizations.error) {
          throw new Error(organizations.error.message);
        }

        const firstWorkspace = acceptedInvitationOrganizationId.current
          ? organizations.data?.find(
              (candidate) => candidate.id === acceptedInvitationOrganizationId.current,
            )
          : organizations.data?.[0];

        if (!firstWorkspace) {
          setScreen("onboarding");
          return "needs-workspace";
        }

        const membershipResult = await workspaceGateway.getMembership(firstWorkspace.id);
        if (membershipResult.error || !membershipResult.data) {
          throw new Error(membershipResult.error?.message);
        }

        setWorkspace(firstWorkspace);
        setWorkspaceRole(membershipResult.data.role as WorkspaceRole);
        acceptedInvitationOrganizationId.current = undefined;
        if (!["/links", "/analytics", "/settings"].includes(window.location.pathname)) {
          navigateDashboard("links", true);
        }
        setScreen("dashboard");
        return "dashboard";
      } catch {
        setError("We couldn't load your workspace. Please try again.");
        setScreen("session-error");
        return "unavailable";
      } finally {
        setIsLoading(false);
      }
    },
    [navigateDashboard],
  );

  useEffect(() => {
    void loadExistingSession();
  }, [loadExistingSession]);

  useEffect(() => {
    const acceptInvitationFromHash = (): void => {
      if (getInvitationIdFromHash()) void loadExistingSession();
    };
    window.addEventListener("hashchange", acceptInvitationFromHash);
    return () => window.removeEventListener("hashchange", acceptInvitationFromHash);
  }, [loadExistingSession]);

  useEffect(() => {
    const updateDashboardRoute = (): void => setDashboardRoute(getDashboardRoute());
    window.addEventListener("popstate", updateDashboardRoute);
    return () => window.removeEventListener("popstate", updateDashboardRoute);
  }, []);

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

  const loadLinks = useCallback(
    async (cursor?: string, append = false): Promise<void> => {
      if (!workspace) return;
      const requestVersion = ++linksRequestVersion.current;
      setLinksError(undefined);
      setIsLinksLoading(true);
      const result = await linkGateway.list({
        ...(cursor ? { cursor } : {}),
        organizationId: workspace.id,
      });
      if (requestVersion !== linksRequestVersion.current) return;
      if (result.error || !result.data) {
        setLinksError(result.error ?? "We couldn't load links right now. Please try again.");
      } else {
        setLinks((current) => (append ? [...current, ...result.data.links] : result.data.links));
        setNextLinkCursor(result.data.nextCursor);
      }
      setIsLinksLoading(false);
    },
    [workspace],
  );

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const loadInvitations = useCallback((): void => {
    if (!workspace || !workspaceRole?.split(",").includes("owner")) return;
    setInvitationListError(undefined);
    setInvitationListState("loading");
    void workspaceGateway
      .listInvitations(workspace.id)
      .then((result) => {
        if (result.data) {
          setInvitations(
            result.data
              .filter((invitation) => invitation.status === "pending")
              .map((invitation) => ({
                email: invitation.email,
                id: invitation.id,
                role: invitation.role as "analyst" | "editor",
              })),
          );
          setInvitationListState("loaded");
        } else {
          setInvitationListError("We couldn't load invitations.");
          setInvitationListState("error");
        }
      })
      .catch(() => {
        setInvitationListError("We couldn't load invitations.");
        setInvitationListState("error");
      });
  }, [workspace, workspaceRole]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

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
    navigateDashboard("links", true);
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

  async function handleInvitationAcceptance(): Promise<void> {
    const invitationId = pendingInvitationId.current;
    if (!invitationId) return;
    setError(undefined);
    setIsSubmitting(true);
    try {
      await loadExistingSession(invitationId);
    } finally {
      setIsSubmitting(false);
    }
  }

  function leaveUnavailableInvitation(): void {
    pendingInvitationId.current = undefined;
    acceptedInvitationOrganizationId.current = undefined;
    void loadExistingSession();
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

    if (!result.data) {
      setError(result.error ?? "We couldn't publish your link. Please try again.");
    } else {
      const published = result.data;
      linksRequestVersion.current += 1;
      setPublishedLink(published);
      setLinks((current) => [published, ...current.filter((link) => link.id !== published.id)]);
      updateForm("destinationUrl", "");
      void loadLinks();
    }
    setIsSubmitting(false);
  }

  async function handleInvitation(
    event: FormEvent<HTMLFormElement>,
    role: "analyst" | "editor",
    email: string,
  ): Promise<boolean> {
    event.preventDefault();
    if (!workspace) return false;
    setInvitationActionError(undefined);
    setIsInvitationSubmitting(true);
    const result = await workspaceGateway.inviteMember({
      email: email.trim(),
      organizationId: workspace.id,
      role,
    });
    if (result.error || !result.data) {
      setInvitationActionError(
        "We couldn't create that invitation. Check the email and try again.",
      );
      setIsInvitationSubmitting(false);
      return false;
    } else {
      const created = result.data;
      const link = `${window.location.origin}/#invite=${encodeURIComponent(created.id)}`;
      setInvitationLink(link);
      setInvitations((current) => [
        ...current,
        { email: created.email, id: created.id, role: created.role as "analyst" | "editor" },
      ]);
    }
    setIsInvitationSubmitting(false);
    return true;
  }

  async function handleInvitationCancellation(invitationId: string): Promise<void> {
    if (!workspace) return;
    setInvitationActionError(undefined);
    setIsInvitationSubmitting(true);
    const result = await workspaceGateway.cancelInvitation(workspace.id, invitationId);
    if (result.error) {
      setInvitationActionError("We couldn't cancel that invitation. Please try again.");
      setIsInvitationSubmitting(false);
      return;
    }
    setInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
    if (invitationLink?.includes(invitationId)) setInvitationLink(undefined);
    setIsInvitationSubmitting(false);
  }

  async function handleWorkspaceDeletion(): Promise<boolean> {
    if (!workspace) return false;
    setIsDeletionSubmitting(true);
    const result = await workspaceGateway.deleteWorkspace(workspace.id);
    if (result.error) {
      setIsDeletionSubmitting(false);
      return false;
    }
    setWorkspace(undefined);
    setWorkspaceRole(undefined);
    setPublishedLink(undefined);
    await loadExistingSession();
    setIsDeletionSubmitting(false);
    return true;
  }

  async function handleAccountDeletion(confirmationEmail: string): Promise<boolean> {
    if (!accountEmail) return false;
    setIsDeletionSubmitting(true);
    const result = await workspaceGateway.deleteAccount(confirmationEmail);
    if (result.error) {
      setIsDeletionSubmitting(false);
      return false;
    }
    setWorkspace(undefined);
    setWorkspaceRole(undefined);
    setPublishedLink(undefined);
    await loadExistingSession();
    setIsDeletionSubmitting(false);
    return true;
  }

  if (isLoading) {
    return <main className="site-shell" aria-busy="true" />;
  }

  if (screen === "dashboard" && workspace && workspaceRole) {
    return (
      <Dashboard
        activeRoute={dashboardRoute}
        error={error}
        analyticsError={analyticsError}
        analyticsOverview={analyticsOverview}
        accountEmail={accountEmail}
        isAnalyticsLoading={isAnalyticsLoading}
        isLinksLoading={isLinksLoading}
        isSubmitting={isSubmitting}
        onPublish={handleLinkPublication}
        onCancelInvitation={handleInvitationCancellation}
        onDeleteAccount={handleAccountDeletion}
        onDeleteWorkspace={handleWorkspaceDeletion}
        onCreateInvitation={handleInvitation}
        onLoadMoreLinks={() => void loadLinks(nextLinkCursor, true)}
        onUpdateDestination={(value) => updateForm("destinationUrl", value)}
        onNavigate={(route) => navigateDashboard(route)}
        onRetryLinks={() => void loadLinks()}
        publishedLink={publishedLink}
        invitationLink={invitationLink}
        invitationActionError={invitationActionError}
        invitationListError={invitationListError}
        invitationListState={invitationListState}
        invitations={invitations}
        links={links}
        linksError={linksError}
        nextLinkCursor={nextLinkCursor}
        isInvitationSubmitting={isInvitationSubmitting}
        isDeletionSubmitting={isDeletionSubmitting}
        onRetryInvitationList={loadInvitations}
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
        <button onClick={() => void loadExistingSession(pendingInvitationId.current)} type="button">
          Try again
        </button>
      </AuthLayout>
    );
  }

  if (screen === "invitation") {
    return (
      <AuthLayout title="Join this workspace?">
        <p className="intro">Accepting adds your signed-in account to the workspace.</p>
        <FormError error={error} />
        <button
          disabled={isSubmitting}
          onClick={() => void handleInvitationAcceptance()}
          type="button"
        >
          Accept invitation
        </button>
      </AuthLayout>
    );
  }

  if (screen === "invitation-unavailable") {
    return (
      <AuthLayout title="This invitation is no longer available">
        <p className="intro">
          Ask a workspace owner to send a new invitation if you still need access.
        </p>
        <button onClick={leaveUnavailableInvitation} type="button">
          Continue to your workspace
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
        <DeletionPanel
          accountEmail={accountEmail}
          isSubmitting={isDeletionSubmitting}
          onDeleteAccount={handleAccountDeletion}
        />
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
  activeRoute,
  accountEmail,
  analyticsError,
  analyticsOverview,
  error,
  isAnalyticsLoading,
  isDeletionSubmitting,
  isLinksLoading,
  invitationActionError,
  invitationListError,
  invitationListState,
  isSubmitting,
  isInvitationSubmitting,
  invitationLink,
  invitations,
  links,
  linksError,
  nextLinkCursor,
  onCancelInvitation,
  onDeleteAccount,
  onDeleteWorkspace,
  onCreateInvitation,
  onLoadMoreLinks,
  onNavigate,
  onPublish,
  onRetryInvitationList,
  onRetryLinks,
  onUpdateDestination,
  publishedLink,
  role,
  value,
  workspace,
}: {
  activeRoute: DashboardRoute;
  accountEmail: string | undefined;
  analyticsError: string | undefined;
  analyticsOverview: AnalyticsOverview | undefined;
  error: string | undefined;
  isAnalyticsLoading: boolean;
  isDeletionSubmitting: boolean;
  isLinksLoading: boolean;
  isSubmitting: boolean;
  isInvitationSubmitting: boolean;
  invitationLink: string | undefined;
  invitationActionError: string | undefined;
  invitationListError: string | undefined;
  invitationListState: InvitationListState;
  invitations: PendingInvitation[];
  links: WorkspaceLink[];
  linksError: string | undefined;
  nextLinkCursor: string | undefined;
  onCancelInvitation: (invitationId: string) => Promise<void>;
  onDeleteAccount: (confirmationEmail: string) => Promise<boolean>;
  onDeleteWorkspace: () => Promise<boolean>;
  onCreateInvitation: (
    event: FormEvent<HTMLFormElement>,
    role: "analyst" | "editor",
    email: string,
  ) => Promise<boolean>;
  onLoadMoreLinks: () => void;
  onNavigate: (route: DashboardRoute) => void;
  onPublish: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRetryInvitationList: () => void;
  onRetryLinks: () => void;
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
        <span className="role-chip">{formatRole(role)}</span>
        <nav aria-label="Workspace sections" className="dashboard-tabs">
          {(["links", "analytics", "settings"] as DashboardRoute[]).map((route) => (
            <a
              aria-current={activeRoute === route ? "page" : undefined}
              href={dashboardPath(route)}
              key={route}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(route);
              }}
            >
              {formatRole(route)}
            </a>
          ))}
        </nav>
        {activeRoute === "links" ? (
          <section className="dashboard-section" aria-labelledby="links-title">
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">LINK DIRECTORY</p>
                <h2 id="links-title">Links</h2>
              </div>
              <p>Browse the immutable destinations in this workspace.</p>
            </div>
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
              <p className="intro">You can browse links and analytics but cannot publish links.</p>
            )}
            {publishedLink ? (
              <p className="published-link">
                Published link:{" "}
                <a
                  href={getPublicLinkUrl(workspace.slug, publishedLink.slug)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {getPublicLinkUrl(workspace.slug, publishedLink.slug)}
                </a>
              </p>
            ) : null}
            <LinkList
              error={linksError}
              isLoading={isLinksLoading}
              links={links}
              nextCursor={nextLinkCursor}
              onLoadMore={onLoadMoreLinks}
              onRetry={onRetryLinks}
              workspaceSlug={workspace.slug}
            />
          </section>
        ) : null}
        {activeRoute === "analytics" ? (
          <AnalyticsPanel
            error={analyticsError}
            isLoading={isAnalyticsLoading}
            overview={analyticsOverview}
          />
        ) : null}
        {activeRoute === "settings" ? (
          <section className="dashboard-section" aria-labelledby="settings-title">
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">WORKSPACE CONTROLS</p>
                <h2 id="settings-title">Settings</h2>
              </div>
            </div>
            {role.split(",").includes("owner") ? (
              <InvitationPanel
                error={invitationActionError}
                listError={invitationListError}
                listState={invitationListState}
                invitationLink={invitationLink}
                invitations={invitations}
                isSubmitting={isInvitationSubmitting}
                onCancel={onCancelInvitation}
                onCreate={onCreateInvitation}
                onRetryList={onRetryInvitationList}
              />
            ) : null}
            <DeletionPanel
              accountEmail={accountEmail}
              isSubmitting={isDeletionSubmitting}
              onDeleteAccount={onDeleteAccount}
              onDeleteWorkspace={onDeleteWorkspace}
              workspace={workspace}
              workspaceRole={role}
            />
          </section>
        ) : null}
      </section>
    </main>
  );
}

function LinkList({
  error,
  isLoading,
  links,
  nextCursor,
  onLoadMore,
  onRetry,
  workspaceSlug,
}: {
  error: string | undefined;
  isLoading: boolean;
  links: WorkspaceLink[];
  nextCursor: string | undefined;
  onLoadMore: () => void;
  onRetry: () => void;
  workspaceSlug: string;
}) {
  const [copyStatus, setCopyStatus] = useState<string>();

  async function copyPublicUrl(url: string): Promise<void> {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(url);
      setCopyStatus("Public link copied.");
    } catch {
      setCopyStatus("We couldn't copy that link. Select the URL and copy it manually.");
    }
  }

  if (isLoading && links.length === 0) {
    return (
      <p className="dashboard-status" role="status">
        Loading links…
      </p>
    );
  }

  if (error && links.length === 0) {
    return (
      <div className="dashboard-status" role="alert">
        <p>{error}</p>
        <button onClick={onRetry} type="button">
          Try again
        </button>
      </div>
    );
  }

  if (links.length === 0) {
    return <p className="dashboard-status">No links published yet.</p>;
  }

  return (
    <section className="link-list" aria-label="Published links">
      {copyStatus ? (
        <p className="copy-status" role="status">
          {copyStatus}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul>
        {links.map((link) => {
          const publicUrl = getPublicLinkUrl(workspaceSlug, link.slug);
          return (
            <li key={link.id}>
              <div>
                <a href={publicUrl} rel="noreferrer" target="_blank">
                  {publicUrl}
                </a>
                <p>{link.destinationUrl}</p>
                <time dateTime={link.createdAt}>
                  Created {new Date(link.createdAt).toLocaleDateString()}
                </time>
              </div>
              <button
                aria-label={`Copy ${publicUrl}`}
                onClick={() => void copyPublicUrl(publicUrl)}
                type="button"
              >
                Copy
              </button>
            </li>
          );
        })}
      </ul>
      {nextCursor ? (
        <button disabled={isLoading} onClick={onLoadMore} type="button">
          {isLoading ? "Loading links" : "Load more links"}
        </button>
      ) : null}
    </section>
  );
}

function getPublicLinkUrl(workspaceSlug: string, slug: string): string {
  const publicUrl = new URL(window.location.origin);
  const dashboardPrefix = "app.";
  const baseHostname = publicUrl.hostname.startsWith(dashboardPrefix)
    ? publicUrl.hostname.slice(dashboardPrefix.length)
    : publicUrl.hostname;

  publicUrl.hostname = `${workspaceSlug}.${baseHostname}`;
  publicUrl.pathname = `/${slug}`;
  publicUrl.search = "";
  publicUrl.hash = "";
  return publicUrl.toString();
}

function DeletionPanel({
  accountEmail,
  isSubmitting,
  onDeleteAccount,
  onDeleteWorkspace,
  workspace,
  workspaceRole,
}: {
  accountEmail: string | undefined;
  isSubmitting: boolean;
  onDeleteAccount: (confirmationEmail: string) => Promise<boolean>;
  onDeleteWorkspace?: () => Promise<boolean>;
  workspace?: Workspace;
  workspaceRole?: WorkspaceRole;
}) {
  const [accountConfirmation, setAccountConfirmation] = useState("");
  const [deletionError, setDeletionError] = useState<string>();
  const [workspaceConfirmation, setWorkspaceConfirmation] = useState("");
  const isOwner = workspace && workspaceRole?.split(",").includes("owner");

  async function deleteWorkspace(): Promise<void> {
    if (!workspace || !onDeleteWorkspace || workspaceConfirmation !== workspace.slug) {
      setDeletionError("Enter the exact workspace handle to delete this workspace.");
      return;
    }
    setDeletionError(undefined);
    if (!(await onDeleteWorkspace())) {
      setDeletionError("We couldn't delete this workspace. Please try again.");
    }
  }

  async function deleteAccount(): Promise<void> {
    if (!accountEmail || accountConfirmation !== accountEmail) {
      setDeletionError("Enter your account email to delete your account.");
      return;
    }
    setDeletionError(undefined);
    if (!(await onDeleteAccount(accountConfirmation))) {
      setDeletionError("We couldn't delete your account. Resolve owned workspaces and try again.");
    }
  }

  return (
    <section className="analytics-panel" aria-labelledby="deletion-title">
      <p className="eyebrow">IRREVERSIBLE ACTIONS</p>
      <h2 id="deletion-title">Delete data</h2>
      {isOwner ? (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void deleteWorkspace();
          }}
        >
          <p className="intro">
            Delete this workspace, its links, invitations, and analytics. Enter {workspace.slug} to
            confirm.
          </p>
          <TextField
            label="Confirm workspace handle"
            onChange={setWorkspaceConfirmation}
            value={workspaceConfirmation}
          />
          <button disabled={isSubmitting} type="submit">
            Delete workspace permanently
          </button>
        </form>
      ) : null}
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void deleteAccount();
        }}
      >
        <p className="intro">
          Delete your account after you have resolved every workspace you own. Enter your account
          email to confirm.
        </p>
        <TextField
          label="Confirm account email"
          onChange={setAccountConfirmation}
          type="email"
          value={accountConfirmation}
        />
        <FormError error={deletionError} />
        <button disabled={isSubmitting} type="submit">
          Delete account permanently
        </button>
      </form>
    </section>
  );
}

function InvitationPanel({
  error,
  listError,
  listState,
  invitationLink,
  invitations,
  isSubmitting,
  onCancel,
  onCreate,
  onRetryList,
}: {
  error: string | undefined;
  listError: string | undefined;
  listState: InvitationListState;
  invitationLink: string | undefined;
  invitations: PendingInvitation[];
  isSubmitting: boolean;
  onCancel: (invitationId: string) => Promise<void>;
  onCreate: (
    event: FormEvent<HTMLFormElement>,
    role: "analyst" | "editor",
    email: string,
  ) => Promise<boolean>;
  onRetryList: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"analyst" | "editor">("editor");
  return (
    <section className="analytics-panel" aria-labelledby="invitations-title">
      <p className="eyebrow">WORKSPACE ACCESS</p>
      <h2 id="invitations-title">Invite a teammate</h2>
      <form
        className="auth-form"
        onSubmit={(event) => {
          void onCreate(event, role, email).then((created) => {
            if (created) setEmail("");
          });
        }}
      >
        <TextField label="Invitation email" onChange={setEmail} type="email" value={email} />
        <label className="field" htmlFor="invitation-role">
          <span>Workspace role</span>
          <select
            id="invitation-role"
            onChange={(event) => setRole(event.target.value as typeof role)}
            value={role}
          >
            <option value="editor">Editor</option>
            <option value="analyst">Analyst</option>
          </select>
        </label>
        <FormError error={error} />
        <button disabled={isSubmitting} type="submit">
          Create invitation
        </button>
      </form>
      {invitationLink ? (
        <label className="field">
          <span>Invitation link</span>
          <input aria-label="Invitation link" readOnly type="text" value={invitationLink} />
        </label>
      ) : null}
      {listState === "loading" ? (
        <p className="analytics-status">Loading invitations…</p>
      ) : listState === "error" ? (
        <div className="analytics-status" role="alert">
          <p>{listError}</p>
          <button onClick={onRetryList} type="button">
            Retry invitations
          </button>
        </div>
      ) : invitations.length ? (
        <ul>
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              {invitation.email} ({formatRole(invitation.role)})
              <button onClick={() => void onCancel(invitation.id)} type="button">
                Cancel invitation
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="analytics-status">No pending invitations.</p>
      )}
    </section>
  );
}

function getInvitationIdFromHash(): string | undefined {
  const match = window.location.hash.match(/^#invite=([A-Za-z0-9]{32})$/);
  return match?.[1];
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
