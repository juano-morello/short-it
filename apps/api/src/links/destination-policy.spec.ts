import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import {
  assertSafeDestinationUrl,
  assertSafeRedirectDestinationUrl,
  resolvePublicDnsAddresses,
} from "./destination-policy.js";

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
    "0.1.2.3",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.0.1",
    "192.0.2.1",
    "192.31.196.1",
    "192.52.193.1",
    "192.88.99.1",
    "192.168.0.1",
    "192.175.48.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
    "::1",
    "::ffff:7f00:1",
    "64:ff9b:1::1",
    "100::1",
    "100:0:0:1::1",
    "2001:2::1",
    "2001:db8::1",
    "2002::1",
    "3fff::1",
    "5f00::1",
    "fc00::1",
    "fe80::1",
    "fec0::1",
    "ff02::1",
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
    ).rejects.toEqual(new BadRequestException("Link destinations must not resolve privately."));
  });

  it("returns a retryable response when DNS is temporarily unavailable", async () => {
    await expect(
      assertSafeDestinationUrl("https://temporary.example", async () => {
        throw Object.assign(new Error("Temporary DNS failure"), { code: "EAI_AGAIN" });
      }),
    ).rejects.toEqual(
      new ServiceUnavailableException("Destination validation is temporarily unavailable."),
    );
  });

  it("bounds a slow DNS resolution with a retryable response", async () => {
    vi.useFakeTimers();
    let settleResolution: ((addresses: Array<{ address: string }>) => void) | undefined;
    const result = assertSafeDestinationUrl(
      "https://slow.example",
      async () =>
        new Promise<Array<{ address: string }>>((resolve) => {
          settleResolution = resolve;
        }),
    );
    const expectation = expect(result).rejects.toEqual(
      new ServiceUnavailableException("Destination validation is temporarily unavailable."),
    );

    await vi.advanceTimersByTimeAsync(2_000);
    await expectation;
    settleResolution?.([{ address: "93.184.216.34" }]);
    await vi.runAllTicks();
    vi.useRealTimers();
  });

  it("keeps timed-out DNS requests within the concurrency bound until they settle", async () => {
    vi.useFakeTimers();
    const settleResolutions: Array<(addresses: Array<{ address: string }>) => void> = [];
    const pendingResolutions: Array<Promise<Array<{ address: string }>>> = [];
    const timedOutRequests = Array.from({ length: 10 }, () =>
      assertSafeDestinationUrl("https://slow.example", async () => {
        const pendingResolution = new Promise<Array<{ address: string }>>((resolve) => {
          settleResolutions.push(resolve);
        });
        pendingResolutions.push(pendingResolution);
        return pendingResolution;
      }),
    );
    const expectations = timedOutRequests.map((result) =>
      expect(result).rejects.toEqual(
        new ServiceUnavailableException("Destination validation is temporarily unavailable."),
      ),
    );

    await vi.advanceTimersByTimeAsync(2_000);
    await Promise.all(expectations);
    await expect(
      assertSafeDestinationUrl("https://later.example", async () => [{ address: "93.184.216.34" }]),
    ).rejects.toEqual(
      new ServiceUnavailableException("Destination validation is temporarily unavailable."),
    );

    for (const settleResolution of settleResolutions) {
      settleResolution([{ address: "93.184.216.34" }]);
    }
    await Promise.all(pendingResolutions);
    await Promise.resolve();
    await expect(
      assertSafeDestinationUrl("https://recovered.example", async () => [
        { address: "93.184.216.34" },
      ]),
    ).resolves.toBe("https://recovered.example/");
    vi.useRealTimers();
  });

  it("rejects a mixed public and private resolver result", async () => {
    await expect(
      assertSafeDestinationUrl("https://mixed.example", async () => [
        { address: "93.184.216.34" },
        { address: "ff02::1" },
      ]),
    ).rejects.toEqual(new BadRequestException("Link destinations must not resolve privately."));
  });

  it("rejects local hostnames and hostnames that return no addresses", async () => {
    await expect(
      assertSafeDestinationUrl("https://localhost", async () => [{ address: "93.184.216.34" }]),
    ).rejects.toEqual(new BadRequestException("Link destinations must not resolve privately."));
    await expect(assertSafeDestinationUrl("https://empty.example", async () => [])).rejects.toEqual(
      new BadRequestException("Link destinations must not resolve privately."),
    );
    await expect(
      assertSafeDestinationUrl("https://internal.local", async () => []),
    ).rejects.toEqual(new BadRequestException("Link destinations must not resolve privately."));
  });

  it("allows a public IP literal through the default resolver", async () => {
    await expect(assertSafeDestinationUrl("https://93.184.216.34/portfolio")).resolves.toBe(
      "https://93.184.216.34/portfolio",
    );
  });

  it("allows a public IPv6 literal through the default resolver", async () => {
    await expect(assertSafeDestinationUrl("https://[2606:4700::1111]/portfolio")).resolves.toBe(
      "https://[2606:4700::1111]/portfolio",
    );
  });

  it("allows a publicly routable IPv6 address", async () => {
    await expect(
      assertSafeDestinationUrl("https://public.example", async () => [
        { address: "2606:4700::1111" },
      ]),
    ).resolves.toBe("https://public.example/");
  });
});

describe("assertSafeRedirectDestinationUrl", () => {
  it("revalidates every sequential redirect without retaining a DNS result", async () => {
    const resolveAddresses = vi.fn(async () => [{ address: "93.184.216.34" }]);

    await assertSafeRedirectDestinationUrl("https://public.example", resolveAddresses);
    await assertSafeRedirectDestinationUrl("https://public.example", resolveAddresses);

    expect(resolveAddresses).toHaveBeenCalledTimes(2);
  });

  it("coalesces only concurrent redirect validations for the same hostname", async () => {
    let settleResolution: ((addresses: Array<{ address: string }>) => void) | undefined;
    const resolveAddresses = vi.fn(
      async () =>
        new Promise<Array<{ address: string }>>((resolve) => {
          settleResolution = resolve;
        }),
    );

    const first = assertSafeRedirectDestinationUrl("https://public.example", resolveAddresses);
    const second = assertSafeRedirectDestinationUrl(
      "https://public.example/path",
      resolveAddresses,
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(resolveAddresses).toHaveBeenCalledTimes(1);

    settleResolution?.([{ address: "93.184.216.34" }]);
    await expect(first).resolves.toBe("https://public.example/");
    await expect(second).resolves.toBe("https://public.example/path");
  });

  it("keeps redirect-time resolution capacity independent from link publication capacity", async () => {
    const settlePublicationResolutions: Array<(addresses: Array<{ address: string }>) => void> = [];
    const publicationRequests = Array.from({ length: 10 }, (_, index) =>
      assertSafeDestinationUrl(
        `https://publication-${index}.example`,
        async () =>
          new Promise<Array<{ address: string }>>((resolve) => {
            settlePublicationResolutions.push(resolve);
          }),
      ),
    );
    await Promise.resolve();
    await Promise.resolve();

    await expect(
      assertSafeRedirectDestinationUrl("https://redirect.example", async () => [
        { address: "93.184.216.34" },
      ]),
    ).resolves.toBe("https://redirect.example/");

    for (const settle of settlePublicationResolutions) {
      settle([{ address: "93.184.216.34" }]);
    }
    await Promise.all(publicationRequests);
  });

  it("returns retryable capacity exhaustion after ten distinct pending redirects", async () => {
    const settleResolutions: Array<(addresses: Array<{ address: string }>) => void> = [];
    const pendingRequests = Array.from({ length: 10 }, (_, index) =>
      assertSafeRedirectDestinationUrl(
        `https://redirect-${index}.example`,
        async () =>
          new Promise<Array<{ address: string }>>((resolve) => {
            settleResolutions.push(resolve);
          }),
      ),
    );

    await expect(
      assertSafeRedirectDestinationUrl("https://over-capacity.example", async () => [
        { address: "93.184.216.34" },
      ]),
    ).rejects.toEqual(
      new ServiceUnavailableException("Destination validation is temporarily unavailable."),
    );

    await Promise.resolve();
    await Promise.resolve();
    for (const settle of settleResolutions) {
      settle([{ address: "93.184.216.34" }]);
    }
    await Promise.all(pendingRequests);
  });

  it.each(["ESERVFAIL", "ECONNREFUSED"])(
    "treats %s as retryable redirect-time DNS failure",
    async (code) => {
      await expect(
        assertSafeRedirectDestinationUrl("https://temporary.example", async () => {
          throw Object.assign(new Error("DNS resolver unavailable"), { code });
        }),
      ).rejects.toEqual(
        new ServiceUnavailableException("Destination validation is temporarily unavailable."),
      );
    },
  );
});

describe("resolvePublicDnsAddresses", () => {
  it("does not accept one address family while the other has a resolver failure", async () => {
    await expect(
      resolvePublicDnsAddresses(
        "public.example",
        async () => ["93.184.216.34"],
        async () => {
          throw Object.assign(new Error("DNS server failure"), { code: "ESERVFAIL" });
        },
      ),
    ).rejects.toMatchObject({ code: "ESERVFAIL" });
  });

  it("permits a definitive absence from one address family", async () => {
    await expect(
      resolvePublicDnsAddresses(
        "public.example",
        async () => ["93.184.216.34"],
        async () => {
          throw Object.assign(new Error("No IPv6 data"), { code: "ENODATA" });
        },
      ),
    ).resolves.toEqual([{ address: "93.184.216.34" }]);
  });
});
