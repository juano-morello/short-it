import {
  Controller,
  Get,
  Head,
  HttpStatus,
  Inject,
  Param,
  Req,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { PublicRedirectService } from "./public-redirect.service.js";

@Controller()
export class PublicRedirectController {
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
    let destinationUrl: string;
    try {
      destinationUrl = await this.publicRedirectService.resolve({
        host: request.headers.host,
        slug,
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        response.setHeader("Retry-After", "2");
      }
      throw error;
    }

    response
      .status(HttpStatus.FOUND)
      .setHeader("Cache-Control", "no-store")
      .setHeader("Location", destinationUrl)
      .setHeader("Referrer-Policy", "no-referrer")
      .end();
  }
}
