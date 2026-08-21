import { spawnSync } from "node:child_process";

const profile = process.argv[2];
const tags = {
  default: "not @rate-limit and not @publication-guardrails",
  "publication-guardrails": "@publication-guardrails",
  "rate-limit": "@rate-limit",
};

if (!(profile in tags)) {
  throw new Error("Use the default, publication-guardrails, or rate-limit BDD profile.");
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
