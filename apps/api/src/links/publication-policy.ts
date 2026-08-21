import { HttpException, HttpStatus } from "@nestjs/common";

export const MAX_DESTINATION_URL_LENGTH = 2_048;
export const MAX_PUBLISHED_LINKS_PER_WORKSPACE = 1_000;
export const MAX_PUBLICATION_ATTEMPTS = 30;
export const PUBLICATION_ATTEMPT_WINDOW_MS = 10 * 60 * 1_000;

type AttemptWindow = {
  count: number;
  expiresAt: number;
};

export class LinkPublicationRateLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();

  constructor(private readonly now: () => number = Date.now) {}

  take(userId: string, organizationId: string): void {
    const now = this.now();
    this.pruneExpiredWindows(now);

    const key = JSON.stringify([userId, organizationId]);
    const window = this.attempts.get(key);
    if (window && window.count >= MAX_PUBLICATION_ATTEMPTS) {
      throw new HttpException(
        "Too many link publication attempts. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.attempts.set(key, {
      count: (window?.count ?? 0) + 1,
      expiresAt: window?.expiresAt ?? now + PUBLICATION_ATTEMPT_WINDOW_MS,
    });
  }

  private pruneExpiredWindows(now: number): void {
    for (const [key, window] of this.attempts) {
      if (window.expiresAt <= now) {
        this.attempts.delete(key);
      }
    }
  }
}

export class WorkspacePublicationLock {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(organizationId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(organizationId) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(organizationId, current);
    await previous;

    try {
      return await action();
    } finally {
      release();
      if (this.tails.get(organizationId) === current) {
        this.tails.delete(organizationId);
      }
    }
  }
}
