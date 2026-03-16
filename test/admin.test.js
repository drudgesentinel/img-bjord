import "dotenv/config";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { dbPing, dbReset, dbClose } from "./_db.js";

describe("admin", () => {
  const app = createApp();

  beforeAll(async () => {
    await dbPing();
  });

  beforeEach(async () => {
    await dbReset();
  });

  afterAll(async () => {
    await dbClose();
  });

  async function register(agent, password = "correct horse battery staple") {
    const res = await agent
      .post("/api/auth/register")
      .set("content-type", "application/json")
      .send({ password });

    expect(res.status).toBe(201);
    return res.body.user;
  }

  it("admin can list users, set tags, and delete a non-admin user", async () => {
    const adminAgent = request.agent(app);
    const admin = await register(adminAgent);

    const userAgent = request.agent(app);
    const user = await register(userAgent, "another pass phrase");

    expect(admin.is_admin).toBe(true);
    expect(user.is_admin).toBe(false);

    const list = await adminAgent.get("/api/admin/users");
    expect(list.status).toBe(200);
    expect(list.body.users.length).toBe(2);

    const tagsRes = await adminAgent
      .put(`/api/admin/users/${user.id}/tags`)
      .set("content-type", "application/json")
      .send({ tags: ["mod", "vip", "vip"] });

    expect(tagsRes.status).toBe(200);
    expect(tagsRes.body.user.tags).toEqual(["mod", "vip"]);

    const del = await adminAgent.delete(`/api/admin/users/${user.id}`);
    expect(del.status).toBe(204);

    const list2 = await adminAgent.get("/api/admin/users");
    expect(list2.status).toBe(200);
    expect(list2.body.users.length).toBe(1);
  });

  it("non-admin user is forbidden from admin endpoints", async () => {
    const adminAgent = request.agent(app);
    await register(adminAgent);

    const userAgent = request.agent(app);
    await register(userAgent, "another pass phrase");

    const list = await userAgent.get("/api/admin/users");
    expect(list.status).toBe(403);
    expect(list.body.error).toBe("forbidden");
  });

  it("cannot delete the last remaining admin", async () => {
    const adminAgent = request.agent(app);
    const admin = await register(adminAgent);

    const del = await adminAgent.delete(`/api/admin/users/${admin.id}`);
    expect(del.status).toBe(400);
    expect(del.body.error).toBe("last_admin");
  });

  it("admin can create and remove boards", async () => {
    const adminAgent = request.agent(app);
    await register(adminAgent);

    const boardSlug = `x${Date.now().toString().slice(-8)}`;
    const create = await adminAgent
      .post("/api/admin/boards")
      .set("content-type", "application/json")
      .send({ slug: boardSlug, name: "Temp Board" });

    expect(create.status).toBe(201);
    expect(create.body.board.slug).toBe(boardSlug);

    const list = await adminAgent.get("/api/admin/boards");
    expect(list.status).toBe(200);
    expect(list.body.boards.some((b) => b.slug === boardSlug)).toBe(true);

    const del = await adminAgent.delete(`/api/admin/boards/${boardSlug}`);
    expect(del.status).toBe(204);
  });

  it("cannot remove board when it has threads", async () => {
    const adminAgent = request.agent(app);
    await register(adminAgent);

    const boardSlug = `y${Date.now().toString().slice(-8)}`;
    const createBoardRes = await adminAgent
      .post("/api/admin/boards")
      .set("content-type", "application/json")
      .send({ slug: boardSlug, name: "Busy Board" });
    expect(createBoardRes.status).toBe(201);

    const createThreadRes = await adminAgent
      .post(`/api/boards/${boardSlug}/threads`)
      .set("content-type", "application/json")
      .send({ subject: "hello", body: "world" });
    expect(createThreadRes.status).toBe(201);

    const del = await adminAgent.delete(`/api/admin/boards/${boardSlug}`);
    expect(del.status).toBe(409);
    expect(del.body.error).toBe("board_not_empty");
  });
});
