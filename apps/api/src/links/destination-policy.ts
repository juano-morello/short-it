import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";
import { BadRequestException, Logger, ServiceUnavailableException } from "@nestjs/common";

type AddressResolver = (hostname: string) => Promise<Array<{ address: string }>>;
type AddressFamilyResolver = (hostname: string) => Promise<string[]>;
type IpRange = readonly [network: string, prefixLength: number];

const resolutionLogger = new Logger("DestinationPolicy");
const resolutionTimeoutMs = 2_000;
const maximumConcurrentResolutions = 10;

// IANA Special-Purpose Address registries, reviewed 2026-08-21.
const nonPublicIpv4Ranges: readonly IpRange[] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.31.196.0", 24],
  ["192.52.193.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["192.175.48.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const nonPublicIpv6Ranges: readonly IpRange[] = [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["100:0:0:1::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["5f00::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
];

const defaultAddressResolver: AddressResolver = async (hostname) => {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "");
  if (isIP(normalizedHostname)) {
    return [{ address: normalizedHostname }];
  }

  return resolvePublicDnsAddresses(normalizedHostname);
};

export async function resolvePublicDnsAddresses(
  hostname: string,
  resolveIpv4: AddressFamilyResolver = resolve4,
  resolveIpv6: AddressFamilyResolver = resolve6,
): Promise<Array<{ address: string }>> {
  const results = await Promise.allSettled([resolveIpv4(hostname), resolveIpv6(hostname)]);
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  const resolverFailure = failures.find(
    (failure) => !isDefinitiveAddressFamilyAbsence(failure.reason),
  );
  if (resolverFailure) {
    throw resolverFailure.reason;
  }
  const addresses = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value.map((address) => ({ address })) : [],
  );
  if (addresses.length) {
    return addresses;
  }
  throw failures[0]?.reason ?? new Error("DNS resolution failed.");
}

export async function assertSafeDestinationUrl(
  value: unknown,
  resolveAddresses: AddressResolver = defaultAddressResolver,
  requestId?: string,
): Promise<string> {
  return assertSafeUrl(value, resolveAddresses, requestId, publicationResolutionPool);
}

export async function assertSafeRedirectDestinationUrl(
  value: unknown,
  resolveAddresses: AddressResolver = defaultAddressResolver,
  requestId?: string,
): Promise<string> {
  return assertSafeUrl(value, resolveAddresses, requestId, redirectResolutionPool);
}

async function assertSafeUrl(
  value: unknown,
  resolveAddresses: AddressResolver,
  requestId: string | undefined,
  resolutionPool: ResolutionPool,
): Promise<string> {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException("A link destination is required.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException("Link destinations must be valid URLs.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BadRequestException("Link destinations must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new BadRequestException("Link destinations must not include credentials.");
  }
  if (isLocalHostname(url.hostname)) {
    throw new BadRequestException("Link destinations must not resolve privately.");
  }

  const addresses = await resolutionPool.resolve(url.hostname, resolveAddresses, requestId);
  if (!addresses.length || addresses.some(({ address }) => isPrivateOrReservedAddress(address))) {
    throw new BadRequestException("Link destinations must not resolve privately.");
  }

  return url.toString();
}

class ResolutionPool {
  private activeResolutions = 0;
  private readonly inFlight = new Map<string, Promise<Array<{ address: string }>>>();

  constructor(
    private readonly event: string,
    private readonly coalesceInFlight: boolean,
  ) {}

  async resolve(
    hostname: string,
    resolveAddresses: AddressResolver,
    requestId: string | undefined,
  ): Promise<Array<{ address: string }>> {
    let resolution = this.coalesceInFlight ? this.inFlight.get(hostname) : undefined;
    if (!resolution) {
      if (this.activeResolutions >= maximumConcurrentResolutions) {
        logResolution(this.event, "capacity-exhausted", 0, requestId);
        throw new ServiceUnavailableException("Destination validation is temporarily unavailable.");
      }

      this.activeResolutions += 1;
      const startedResolution = Promise.resolve().then(() => resolveAddresses(hostname));
      resolution = startedResolution;
      if (this.coalesceInFlight) {
        this.inFlight.set(hostname, startedResolution);
      }
      void startedResolution.then(
        () => this.release(hostname, startedResolution),
        () => this.release(hostname, startedResolution),
      );
    }

    const startedAt = performance.now();
    try {
      const addresses = await resolveWithTimeout(resolution);
      logResolution(this.event, "resolved", performance.now() - startedAt, requestId);
      return addresses;
    } catch (error) {
      const elapsedMs = performance.now() - startedAt;
      if (isTransientResolutionError(error)) {
        logResolution(this.event, "unavailable", elapsedMs, requestId);
        throw new ServiceUnavailableException("Destination validation is temporarily unavailable.");
      }
      logResolution(this.event, "unresolvable", elapsedMs, requestId);
      throw new BadRequestException("Link destinations must not resolve privately.");
    }
  }

  private release(hostname: string, resolution: Promise<Array<{ address: string }>>): void {
    this.activeResolutions -= 1;
    if (this.inFlight.get(hostname) === resolution) {
      this.inFlight.delete(hostname);
    }
  }
}

const publicationResolutionPool = new ResolutionPool("link_destination_resolution", false);
const redirectResolutionPool = new ResolutionPool("redirect_destination_resolution", true);

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")
  );
}

function resolveWithTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(Object.assign(new Error("DNS resolution timed out."), { code: "ETIMEOUT" }));
    }, resolutionTimeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function isTransientResolutionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EAI_AGAIN" ||
      error.code === "ECONNREFUSED" ||
      error.code === "ECONNRESET" ||
      error.code === "EHOSTUNREACH" ||
      error.code === "ENETUNREACH" ||
      error.code === "ESERVFAIL" ||
      error.code === "ETIMEOUT")
  );
}

function isDefinitiveAddressFamilyAbsence(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENODATA" || error.code === "ENOTFOUND")
  );
}

function logResolution(
  event: string,
  outcome: string,
  durationMs: number,
  requestId: string | undefined,
): void {
  resolutionLogger.log(
    JSON.stringify({
      durationMs: Math.round(durationMs),
      event,
      outcome,
      requestId: requestId ?? "unavailable",
    }),
  );
}

function isPrivateOrReservedAddress(address: string): boolean {
  const ipv4 = parseIpv4(address);
  if (ipv4 !== undefined) {
    return nonPublicIpv4Ranges.some((range) => isInRange(ipv4, range, 32));
  }

  const ipv6 = parseIpv6(address);
  if (ipv6 === undefined) {
    return true;
  }
  if (!isInRange(ipv6, ["2000::", 3], 128)) {
    return true;
  }
  return nonPublicIpv6Ranges.some((range) => isInRange(ipv6, range, 128));
}

function isInRange(address: bigint, range: IpRange, addressBits: number): boolean {
  const network = addressBits === 32 ? parseIpv4(range[0]) : parseIpv6(range[0]);
  if (network === undefined) {
    return true;
  }
  const shift = BigInt(addressBits - range[1]);
  return address >> shift === network >> shift;
}

function parseIpv4(address: string): bigint | undefined {
  const segments = address.split(".");
  if (segments.length !== 4 || segments.some((segment) => !/^\d{1,3}$/.test(segment))) {
    return undefined;
  }
  const values = segments.map(Number);
  if (!values.every((segment) => segment <= 255)) {
    return undefined;
  }
  return values.reduce((value, segment) => (value << 8n) + BigInt(segment), 0n);
}

function parseIpv6(address: string): bigint | undefined {
  const normalized = address.toLowerCase();
  if (normalized.includes(".")) {
    return undefined;
  }
  const sections = normalized.split("::");
  if (sections.length > 2) {
    return undefined;
  }
  const left = sections[0] ? sections[0].split(":") : [];
  const right = sections[1] ? sections[1].split(":") : [];
  if (
    left.some((part) => !/^[0-9a-f]{1,4}$/.test(part)) ||
    right.some((part) => !/^[0-9a-f]{1,4}$/.test(part)) ||
    (sections.length === 1 && left.length !== 8) ||
    (sections.length === 2 && left.length + right.length > 7)
  ) {
    return undefined;
  }
  const groups = [
    ...left,
    ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"),
    ...right,
  ];
  if (groups.length !== 8) {
    return undefined;
  }
  return groups.reduce((value, group) => (value << 16n) + BigInt(`0x${group}`), 0n);
}
