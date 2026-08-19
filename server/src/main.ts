import "reflect-metadata";
import { createStandaloneNestApi } from "./nest";

async function start() {
  const app = await createStandaloneNestApi();
  await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
}

start().catch(error => { console.error("Failed to start Yemna NestJS API", error); process.exitCode = 1; });
