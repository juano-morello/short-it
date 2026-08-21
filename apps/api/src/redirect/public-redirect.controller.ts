import {
  Controller,
  Get,
  Head,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { getRequestId } from "../request-id.js";
import { PublicRedirectService } from "./public-redirect.service.js";

@Controller()
export class PublicRedirectController {
  private readonly logger = new Logger(PublicRedirectController.name);

  constructor(
    @Inject(PublicRedirectService) private readonly publicRedirectService: PublicRedirectService,
  ) {}

  @Get(":slug")
  async get(
    @Param("slug") slug: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.redirect(slug, request, response);
  }

  @Head(":slug")
  async head(
    @Param("slug") slug: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.redirect(slug, request, response);
  }

  private async redirect(slug: string, request: Request, response: Response): Promise<void> {
    const requestId = getRequestId(request);
    const startedAt = performance.now();
    let destinationUrl: string;
    try {
      destinationUrl = await this.publicRedirectService.resolve({
        host: request.headers.host,
        requestId,
        slug,
      });
    } catch (error) {
      const status =
        error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      if (status === HttpStatus.SERVICE_UNAVAILABLE) {
        response.setHeader("Retry-After", "2");
      }
      this.logOutcome(status, requestId, startedAt);
      throw error;
    }

    response
      .status(HttpStatus.FOUND)
      .setHeader("Cache-Control", "no-store")
      .setHeader("Location", destinationUrl)
      .setHeader("Referrer-Policy", "no-referrer")
      .end();
    this.logOutcome(HttpStatus.FOUND, requestId, startedAt);
  }

  private logOutcome(status: number, requestId: string, startedAt: number): void {
    this.logger.log(
      JSON.stringify({
        durationMs: Math.round(performance.now() - startedAt),
        event: "public_redirect",
        outcome:
          status === HttpStatus.FOUND
            ? "redirected"
            : status === HttpStatus.NOT_FOUND
              ? "not_found"
              : status === HttpStatus.SERVICE_UNAVAILABLE
                ? "unavailable"
                : "failed",
        requestId,
        status,
      }),
    );
  }
}
