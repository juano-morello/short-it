export type PublishedLink = {
  createdAt: string;
  destinationUrl: string;
  id: string;
  organizationId: string;
  publishedAt: string;
  slug: string;
};

type CreateLinkRequest = {
  destinationUrl: string;
  organizationId: string;
};

type GatewayResult =
  | { data: PublishedLink; error?: undefined }
  | { data?: undefined; error: string };

export const linkGateway = {
  async publish(input: CreateLinkRequest): Promise<GatewayResult> {
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
