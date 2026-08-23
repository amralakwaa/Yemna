import "reflect-metadata";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { bootstrapNestApi } from "../src/nest";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, service: "yemna" });
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // NestJS installs a terminal 404 handler during init. Keeping it in its own
  // sub-application prevents that handler from shadowing Vite's client route
  // fallback while preserving the public /api/v1 REST contract.
  const nestApi = express();
  app.use("/api", nestApi);
  await bootstrapNestApi(nestApi, "");
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = Number.parseInt(process.env.PORT || "3000", 10);
  const isDevelopment = process.env.NODE_ENV === "development";
  // The hosting gateway routes exclusively to PORT. Falling back to another
  // port is convenient locally, but turns a healthy application into an
  // unreachable production deployment.
  const port = isDevelopment ? await findAvailablePort(preferredPort) : preferredPort;

  if (isDevelopment && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.once("error", error => {
    console.error(`Unable to listen on required port ${port}`, error);
    process.exitCode = 1;
  });
  // Bind explicitly to the public container interface. This avoids relying on
  // platform-specific IPv6 dual-stack behavior for the deployment TCP probe.
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
