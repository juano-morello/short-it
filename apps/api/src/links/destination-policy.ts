import { lookup } from "node:dns/promises";
import { BadRequestException } from "@nestjs/common";

type AddressResolver = (hostname: string) => Promise<Array<{ address: string }>>;

const defaultAddressResolver: AddressResolver = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

export async function assertSafeDestinationUrl(
  value: unknown,
  resolveAddresses: AddressResolver = defaultAddressResolver,
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
  if (url.hostname.toLowerCase() === "localhost") {
    throw new BadRequestException("Link destinations must not resolve privately.");
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await resolveAddresses(url.hostname);
  } catch {
    throw new BadRequestException("Link destinations must resolve publicly.");
  }

  if (!addresses.length || addresses.some(({ address }) => isPrivateOrReservedAddress(address))) {
    throw new BadRequestException("Link destinations must not resolve privately.");
  }

  return url.toString();
}

function isPrivateOrReservedAddress(address: string): boolean {
  const ipv4 = parseIpv4(address);
  if (ipv4) {
    const [first, second] = ipv4;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && (second === 0 || second === 168)) ||
      (first === 198 && (second === 18 || second === 19 || second === 51)) ||
      (first === 203 && second === 0)
    );
  }

  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) {
    return isPrivateOrReservedAddress(mappedIpv4);
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("2001:db8:") ||
    /^fe[89ab][0-9a-f]:/.test(normalized)
  );
}

function parseIpv4(address: string): number[] | undefined {
  const segments = address.split(".");
  if (segments.length !== 4 || segments.some((segment) => !/^\d{1,3}$/.test(segment))) {
    return undefined;
  }

  const values = segments.map(Number);
  return values.every((segment) => segment <= 255) ? values : undefined;
}
