export type PublishedLink = {
  createdAt: string;
  destinationUrl: string;
  id: string;
  organizationId: string;
  publishedAt: string;
  slug: string;
};

export type WorkspaceLink = Omit<PublishedLink, "organizationId">;

export type LinkPage = {
  links: WorkspaceLink[];
  nextCursor?: string;
};

type CreateLinkRequest = {
  destinationUrl: string;
  organizationId: string;
};

type ListLinksRequest = {
  cursor?: string;
  organizationId: string;
};

type GatewayResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export const linkGateway = {
  async list(input: ListLinksRequest): Promise<GatewayResult<LinkPage>> {
    try {
      const search = new URLSearchParams({ organizationId: input.organizationId });
      if (input.cursor) search.set("cursor", input.cursor);
      const response = await fetch(`/api/links?${search.toString()}`, {
        credentials: "same-origin",
      });
      const body = (await response.json()) as LinkPage | { message?: string };

      if (!response.ok) {
        return { error: "We couldn't load links right now. Please try again." };
      }

      return { data: body as LinkPage };
    } catch {
      return { error: "We couldn't load links right now. Please try again." };
    }
  },

  async publish(input: CreateLinkRequest): Promise<GatewayResult<PublishedLink>> {
    try {
      const response = await fetch("/api/links", {
        body: JSON.stringify(input),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as PublishedLink | { message?: string };

      if (!response.ok) {
        return {
          error:
            "message" in body && typeof body.message === "string"
              ? body.message
              : "We couldn't publish your link. Please try again.",
        };
      }

      return { data: body as PublishedLink };
    } catch {
      return { error: "We couldn't publish your link. Please try again." };
    }
  },
};
