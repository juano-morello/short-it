import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { getConfig } from "../config.js";
import { prisma } from "../database.js";
import { assertSafeRedirectDestinationUrl } from "../links/destination-policy.js";
import { getPublicWorkspaceHandle, isPublishedLinkSlug } from "./public-host.js";

type RedirectDatabase = Pick<typeof prisma, "link" | "organization">;

type PublicRedirectInput = {
  host: string | undefined;
  slug: string;
};

type PublicRedirectDependencies = {
  baseDomain: string;
  database: RedirectDatabase;
  validateDestination: typeof assertSafeRedirectDestinationUrl;
};

@Injectable()
export class PublicRedirectService {
  private dependencies: PublicRedirectDependencies = {
    baseDomain: getConfig().baseDomain,
    database: prisma,
    validateDestination: assertSafeRedirectDestinationUrl,
  };

  static forTesting(overrides: Partial<PublicRedirectDependencies>): PublicRedirectService {
    const service = new PublicRedirectService();
    service.dependencies = { ...service.dependencies, ...overrides };
    return service;
  }

  async resolve(input: PublicRedirectInput): Promise<string> {
    const workspaceHandle = getPublicWorkspaceHandle(input.host, this.dependencies.baseDomain);
    if (!workspaceHandle || !isPublishedLinkSlug(input.slug)) {
      throw new NotFoundException();
    }

    const organization = await this.dependencies.database.organization.findUnique({
      select: { id: true },
      where: { slug: workspaceHandle },
    });
    if (!organization) {
      throw new NotFoundException();
    }

    const link = await this.dependencies.database.link.findUnique({
      select: { destinationUrl: true, publishedAt: true },
      where: { organizationId_slug: { organizationId: organization.id, slug: input.slug } },
    });
    if (!link?.publishedAt) {
      throw new NotFoundException();
    }

    try {
      return await this.dependencies.validateDestination(link.destinationUrl);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}
