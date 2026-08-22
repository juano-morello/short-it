import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type DeviceCategory = "bot" | "desktop" | "mobile" | "tablet" | "unknown";

export function getAnalyticsDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export function createDailyVisitorDigest(input: {
  day: Date;
  ipAddress: string;
  linkId: string;
  organizationId: string;
  secret: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(
      `${input.day.toISOString().slice(0, 10)}\u0000${input.organizationId}\u0000${input.linkId}\u0000${input.ipAddress}`,
    )
    .digest("hex");
}

export function getVisitorExpiry(day: Date): Date {
  return new Date(day.getTime() + 24 * 60 * 60 * 1000);
}

export function classifyDevice(userAgent: string | undefined): DeviceCategory {
  if (!userAgent) return "unknown";
  if (/bot|crawler|spider|slurp/i.test(userAgent)) return "bot";
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

export function normalizeReferrerHost(referrer: string | undefined): string {
  if (!referrer) return "direct";
  if (referrer.length > 2_048) return "unknown";

  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "unknown";
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !hostname ||
      hostname.length > 253 ||
      isIP(hostname) !== 0 ||
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".localhost") ||
      !hostname.includes(".")
    ) {
      return "unknown";
    }
    return hostname;
  } catch {
    return "unknown";
  }
}

export function normalizeTrustedIp(value: string | undefined): string | undefined {
  return value && isIP(value) !== 0 ? value : undefined;
}
