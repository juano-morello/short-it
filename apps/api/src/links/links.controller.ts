import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { auth } from "../auth/auth.js";
import { getConfig } from "../config.js";
import { getRequestId } from "../request-id.js";
import { LinksService } from "./links.service.js";

type CreateLinkBody = {
  destinationUrl?: unknown;
  organizationId?: unknown;
};

type ListLinksQuery = {
  cursor?: unknown;
  organizationId?: unknown;
};

@Controller("api/links")
export class LinksController {
  constructor(@Inject(LinksService) private readonly linksService: LinksService) {}

  @Post()
  async create(@Body() body: CreateLinkBody | null | undefined, @Req() request: Request) {
    assertTrustedOrigin(request);
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
    if (!session) {
      throw new UnauthorizedException();
    }

    return this.linksService.create({
      destinationUrl: body?.destinationUrl,
      requestedOrganizationId: body?.organizationId,
      requestId: getRequestId(request),
      userId: session.user.id,
    });
  }

  @Get()
  async list(@Query() query: ListLinksQuery | null | undefined, @Req() request: Request) {
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
    if (!session) {
      throw new UnauthorizedException();
    }

    return this.linksService.list({
      cursor: query?.cursor,
      requestedOrganizationId: query?.organizationId,
      userId: session.user.id,
    });
  }
}

function assertTrustedOrigin(request: Request): void {
  const origin = request.get("origin");
  if (!origin || !getConfig().origins.includes(origin)) {
    throw new ForbiddenException("Link publication must originate from the dashboard.");
  }
}

function toHeaders(headers: Request["headers"]): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      result.set(name, value);
    } else if (Array.isArray(value)) {
      result.set(name, value.join(", "));
    }
  }
  return result;
}
