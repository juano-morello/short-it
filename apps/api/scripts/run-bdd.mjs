import { spawnSync } from "node:child_process";

const profile = process.argv[2];
const tags = {
  default:
    "not @rate-limit and not @publication-guardrails and not @analytics-overview and not @workspace-invitations and not @workspace-lifecycle",
  analytics: "@analytics-overview",
  invitations: "@workspace-invitations and not @workspace-invitation-edge",
  "invitation-edge": "@workspace-invitation-edge",
  "publication-guardrails": "@publication-guardrails",
  "rate-limit": "@rate-limit",
  "workspace-lifecycle": "@workspace-lifecycle",
};

if (!(profile in tags)) {
  throw new Error(
    "Use the default, analytics, invitations, invitation-edge, publication-guardrails, rate-limit, or workspace-lifecycle BDD profile.",
  );
}

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
}

if (process.env.BDD_IN_COMPOSE === "1") {
  run(process.execPath, [
    "--import",
    "tsx",
    "./node_modules/@cucumber/cucumber/bin/cucumber-js",
    "features",
    "--import",
    "features/**/*.ts",
    "--format",
    "progress",
    "--tags",
    tags[profile],
  ]);
} else {
  run("docker", [
    "compose",
    "exec",
    "-T",
    "-e",
    "BDD_IN_COMPOSE=1",
    "api",
    "sh",
    "-lc",
    `cd /workspace/apps/api && node scripts/run-bdd.mjs ${profile}`,
  ]);
}
