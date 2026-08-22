const developmentBaseUrl = "http://app.localhost:8080";
const developmentDatabaseUrl = "postgresql://shortit:shortit@localhost:5432/shortit?schema=public";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function httpsUrl(name: string, value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS in production.`);
  return url.toString().replace(/\/$/, "");
}

function baseDomain(name: string, value: string): string {
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(value)
  ) {
    throw new Error(`${name} must be a lowercase DNS name.`);
  }
  return value;
}

export function getConfig() {
  const production = process.env.NODE_ENV === "production";
  const baseUrl = production
    ? httpsUrl("BETTER_AUTH_URL", required("BETTER_AUTH_URL"))
    : (process.env.BETTER_AUTH_URL ?? developmentBaseUrl);
  const databaseUrl = production
    ? required("DATABASE_URL")
    : (process.env.DATABASE_URL ?? developmentDatabaseUrl);
  const secret = production
    ? required("BETTER_AUTH_SECRET")
    : (process.env.BETTER_AUTH_SECRET ?? "local-development-secret");

  if (production && secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters in production.");
  }
  const configuredBaseDomain = baseDomain(
    "APP_BASE_DOMAIN",
    production ? required("APP_BASE_DOMAIN") : (process.env.APP_BASE_DOMAIN ?? "localhost"),
  );

  const origins = (
    production ? required("TRUSTED_ORIGINS") : (process.env.TRUSTED_ORIGINS ?? baseUrl)
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => (production ? httpsUrl("TRUSTED_ORIGINS", origin) : origin));

  return { baseDomain: configuredBaseDomain, baseUrl, databaseUrl, origins, production, secret };
}
