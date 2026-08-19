import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import type { Express } from "express";
import * as express from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";

function configure(app: INestApplication): void {
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.enableCors({ origin: process.env.YEMNA_CORS_ORIGINS?.split(",") ?? true, credentials: true, methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] });
  app.setGlobalPrefix("api", { exclude: ["health"] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle("Yemna API").setVersion("1.0").addBearerAuth().build());
  SwaggerModule.setup("api/docs", app, document);
}

export async function bootstrapNestApi(expressApp: Express): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false });
  configure(app);
  await app.init();
  return app;
}

export async function createStandaloneNestApi(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configure(app);
  return app;
}
