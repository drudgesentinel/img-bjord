import "dotenv/config";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getAllGeneratedUsernameSingles } from "../src/lib/threadSlug.js";
import { dbPing, dbReset, dbClose } from "./_db.js";

describe("auth", () => {
  const app = createApp();
  const singlesSet = new Set(getAllGeneratedUsernameSingles());

  beforeAll(async () => {
    await dbPing();
  });

  beforeEach(async () => {
    await dbReset();
  });

  afterAll(async () => {
    await dbClose();
  });

  it("register returns generated username and creates authenticated session", async () => {
    const agent = request.agent(app);

    const registerRes = await agent
      .post("/api/auth/register")
      .set("content-type", "application/json")
      .send({ password: "correct horse battery staple" });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.user.username).toMatch(/^[a-z0-9_]+$/);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe(registerRes.body.user.username);
  });

  it("blocks thread creation when unauthenticated", async () => {
    const res = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "A", body: "op" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("supports login/logout with generated username and password", async () => {
    const registrationAgent = request.agent(app);

    const registerRes = await registrationAgent
      .post("/api/auth/register")
      .set("content-type", "application/json")
      .send({ password: "correct horse battery staple" });

    const username = registerRes.body.user.username;

    const loginAgent = request.agent(app);
    const loginRes = await loginAgent
      .post("/api/auth/login")
      .set("content-type", "application/json")
      .send({ username, password: "correct horse battery staple" });

    expect(loginRes.status).toBe(200);

    const meBeforeLogout = await loginAgent.get("/api/auth/me");
    expect(meBeforeLogout.status).toBe(200);

    const logoutRes = await loginAgent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(204);

    const meAfterLogout = await loginAgent.get("/api/auth/me");
    expect(meAfterLogout.status).toBe(401);
  });

  it("allows login with display username when unique", async () => {
    const registrationAgent = request.agent(app);

    const registerRes = await registrationAgent
      .post("/api/auth/register")
      .set("content-type", "application/json")
      .send({ password: "correct horse battery staple" });

    const username = registerRes.body.user.username;
    const displayUsername = username.replace(/_\d+$/, "");

    const loginAgent = request.agent(app);
    const loginRes = await loginAgent
      .post("/api/auth/login")
      .set("content-type", "application/json")
      .send({ username: displayUsername, password: "correct horse battery staple" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.username).toBe(username);
  });

  it("supports username candidate selection at registration", async () => {
    const agent = request.agent(app);

    const candidates = await agent.get("/api/auth/username-candidates");
    expect(candidates.status).toBe(200);
    expect(Array.isArray(candidates.body.usernames)).toBe(true);
    expect(candidates.body.usernames.length).toBe(10);

    const singles = candidates.body.usernames.filter((name) => singlesSet.has(name));
    expect(singles.length).toBe(5);

    for (const username of candidates.body.usernames) {
      expect(username).toMatch(/^[a-z0-9_]{3,64}$/);
    }
    const selected = candidates.body.usernames[2];

    const registerRes = await agent
      .post("/api/auth/register")
      .set("content-type", "application/json")
      .send({ password: "correct horse battery staple", username: selected });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.user.username).toBe(selected);
  });

  it("does not offer a consumed username again", async () => {
    const agent = request.agent(app);

    const firstCandidates = await agent.get("/api/auth/username-candidates");
    expect(firstCandidates.status).toBe(200);

    const selected = firstCandidates.body.usernames[0];
    const registerRes = await agent
      .post("/api/auth/register")
      .set("content-type", "application/json")
      .send({ password: "correct horse battery staple", username: selected });

    expect(registerRes.status).toBe(201);

    const secondCandidates = await request(app).get("/api/auth/username-candidates");
    expect(secondCandidates.status).toBe(200);
    expect(secondCandidates.body.usernames.includes(selected)).toBe(false);
  });
});
