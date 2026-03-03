import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { dbPing, dbClose } from "./_db.js";

describe("smoke", () => {
  const app = createApp();

  beforeAll(async () => {
    await dbPing();
  });

  afterAll(async () => {
    await dbClose();
  });

  it("GET /healthz returns ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /readyz returns ok when DB is reachable", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
