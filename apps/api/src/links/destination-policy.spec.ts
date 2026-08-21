import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { assertSafeDestinationUrl } from "./destination-policy.js";

describe("assertSafeDestinationUrl", () => {
  it("normalizes a public HTTP(S) destination after resolving every address", async () => {
    await expect(
      assertSafeDestinationUrl("https://public.example/path", async () => [
        { address: "93.184.216.34" },
      ]),
    ).resolves.toBe("https://public.example/path");
  });

  it.each([
    ["ftp://public.example/archive", "Link destinations must use HTTP or HTTPS."],
    ["not a url", "Link destinations must be valid URLs."],
    ["https://user:secret@public.example", "Link destinations must not include credentials."],
  ])("rejects an invalid destination %s", async (value, message) => {
    await expect(
      assertSafeDestinationUrl(value, async () => [{ address: "93.184.216.34" }]),
    ).rejects.toEqual(new BadRequestException(message));
  });

  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "198.51.100.1",
    "203.0.113.1",
    "::1",
    "fc00::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ])("rejects private and reserved addresses: %s", async (address) => {
    await expect(
      assertSafeDestinationUrl("https://public.example", async () => [{ address }]),
    ).rejects.toEqual(new BadRequestException("Link destinations must not resolve privately."));
  });

  it("rejects a hostname that cannot be resolved", async () => {
    await expect(
      assertSafeDestinationUrl("https://unknown.example", async () => {
        throw new Error("NXDOMAIN");
      }),
    ).rejects.toEqual(new BadRequestException("Link destinations must resolve publicly."));
  });

  it("rejects localhost and hostnames that return no addresses", async () => {
    await expect(
      assertSafeDestinationUrl("https://localhost", async () => [{ address: "93.184.216.34" }]),
    ).rejects.toEqual(new BadRequestException("Link destinations must not resolve privately."));
    await expect(assertSafeDestinationUrl("https://empty.example", async () => [])).rejects.toEqual(
      new BadRequestException("Link destinations must not resolve privately."),
    );
  });

  it("allows a public IP literal through the default resolver", async () => {
    await expect(assertSafeDestinationUrl("https://93.184.216.34/portfolio")).resolves.toBe(
      "https://93.184.216.34/portfolio",
    );
  });
});
