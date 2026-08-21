import { MetricCard } from "./components/MetricCard.js";

export function App() {
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
          <button type="button">Create a workspace</button>
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
