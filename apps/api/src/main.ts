import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { AppModule } from "./app.module.js";
import { auth } from "./auth/auth.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ["error", "warn", "log"],
  });
  const expressApp = app.getHttpAdapter().getInstance();

  // Better Auth consumes its own payload before Nest's JSON middleware.
  expressApp.all("/api/auth/*splat", toNodeHandler(auth));
  expressApp.use(express.json());
  expressApp.use(express.urlencoded({ extended: true }));

  await app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
}

void bootstrap();
