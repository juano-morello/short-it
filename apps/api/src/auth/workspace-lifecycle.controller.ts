import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { getConfig } from "../config.js";
import { auth } from "./auth.js";
import { WorkspaceLifecycleService } from "./workspace-lifecycle.service.js";

type WorkspaceCreationBody = { name?: unknown; slug?: unknown };

@Controller("api/workspaces")
export class WorkspaceLifecycleController {
  constructor(
    @Inject(WorkspaceLifecycleService)
    private readonly workspaceLifecycleService: WorkspaceLifecycleService,
  ) {}

  @Post()
  @HttpCode(200)
  async createWorkspace(
    @Body() body: WorkspaceCreationBody | null | undefined,
    @Req() request: Request,
  ) {
    assertTrustedOrigin(request);
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
    if (!session) throw new UnauthorizedException();

    return this.workspaceLifecycleService.create({
      name: body?.name,
      slug: body?.slug,
      userId: session.user.id,
    });
  }
}

function assertTrustedOrigin(request: Request): void {
  const origin = request.get("origin");
  if (!origin || !getConfig().origins.includes(origin)) {
    throw new ForbiddenException("Workspace creation must originate from the dashboard.");
  }
}

function toHeaders(headers: Request["headers"]): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string") result.set(name, value);
    else if (Array.isArray(value)) result.set(name, value.join(", "));
  }
  return result;
}
