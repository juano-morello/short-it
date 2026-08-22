import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Inject,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { getConfig } from "../config.js";
import { getRequestId } from "../request-id.js";
import { AccountDeletionService } from "./account-deletion.service.js";
import { auth } from "./auth.js";

type AccountDeletionBody = { confirmationEmail?: unknown };

@Controller("api/account")
export class AccountDeletionController {
  constructor(
    @Inject(AccountDeletionService)
    private readonly accountDeletionService: AccountDeletionService,
  ) {}

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @Body() body: AccountDeletionBody | null | undefined,
    @Req() request: Request,
  ) {
    assertTrustedOrigin(request);
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
    if (!session) throw new UnauthorizedException();

    await this.accountDeletionService.delete({
      confirmationEmail: body?.confirmationEmail,
      email: session.user.email,
      requestId: getRequestId(request),
      userId: session.user.id,
    });
  }
}

function assertTrustedOrigin(request: Request): void {
  const origin = request.get("origin");
  if (!origin || !getConfig().origins.includes(origin)) {
    throw new ForbiddenException("Account deletion must originate from the dashboard.");
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
