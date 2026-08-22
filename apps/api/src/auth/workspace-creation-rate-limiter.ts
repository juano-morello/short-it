import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

const maximumWorkspaceCreationAttempts = 100;
const workspaceCreationWindowMs = 60_000;

type AttemptWindow = { count: number; expiresAt: number };

@Injectable()
export class WorkspaceCreationRateLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();

  constructor(private readonly now: () => number = Date.now) {}

  take(userId: string): void {
    const now = this.now();
    this.pruneExpired(now);
    const window = this.attempts.get(userId);
    if (window && window.count >= maximumWorkspaceCreationAttempts) {
      throw new HttpException(
        "Too many workspace creation attempts. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.attempts.set(userId, {
      count: (window?.count ?? 0) + 1,
      expiresAt: window?.expiresAt ?? now + workspaceCreationWindowMs,
    });
  }

  private pruneExpired(now: number): void {
    for (const [userId, window] of this.attempts) {
      if (window.expiresAt <= now) this.attempts.delete(userId);
    }
  }
}
