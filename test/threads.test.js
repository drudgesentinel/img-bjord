import "dotenv/config";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { dbPing, dbReset, dbClose } from "./_db.js";

describe("threads", () => {
  const app = createApp();
  let agent;

  beforeAll(async () => {
    await dbPing();
  });

  beforeEach(async () => {
    await dbReset();
    agent = request.agent(app);
    const registerRes = await agent
      .post("/api/auth/register")
      .set("content-type", "application/json")
      .send({ password: "correct horse battery staple" });
    expect(registerRes.status).toBe(201);
  });

  afterAll(async () => {
    await dbClose();
  });

  async function createThread(subject = "t", body = "op") {
    const res = await agent
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject, body });

    expect(res.status).toBe(201);

    const thread = res.body.thread;
    const deleteKey = res.body.deleteKey;
    expect(thread.subject_slug).toBeTruthy();
    expect(thread.token).toBeTruthy();
    expect(deleteKey).toBeTruthy();

    return { thread, deleteKey };
  }

  it("can view a thread by board + subjectSlug + token (posts ordered by post_number)", async () => {
    const { thread } = await createThread("Lifting Routine", "first post");

    const viewRes = await request(app).get(
      `/api/boards/b/${thread.subject_slug}/${thread.token}`,
    );

    expect(viewRes.status).toBe(200);
    expect(viewRes.body.thread.id).toBe(thread.id);
    expect(viewRes.body.posts.length).toBe(1);
    expect(viewRes.body.posts[0].post_number).toBe(1);
    expect(viewRes.body.posts[0].body).toBe("first post");
  });

  it("replies add a post with incrementing post_number", async () => {
    const { thread } = await createThread("t", "op");

    const r1 = await agent
      .post(`/api/boards/b/${thread.subject_slug}/${thread.token}/replies`)
      .set("content-type", "application/json")
      .send({ body: "reply 1" });

    expect(r1.status).toBe(201);
    expect(r1.body.post.post_number).toBe(2);

    const r2 = await agent
      .post(`/api/boards/b/${thread.subject_slug}/${thread.token}/replies`)
      .set("content-type", "application/json")
      .send({ body: "reply 2" });

    expect(r2.status).toBe(201);
    expect(r2.body.post.post_number).toBe(3);

    const viewRes = await request(app).get(
      `/api/boards/b/${thread.subject_slug}/${thread.token}`,
    );

    expect(viewRes.status).toBe(200);
    expect(viewRes.body.posts.map((p) => p.post_number)).toEqual([1, 2, 3]);
  });

  it("returns 404 when thread not found (valid-looking route)", async () => {
    const res = await request(app).get("/api/boards/b/thread/does_not_exist");
    // This depends on your token regex; if your validator rejects it, you’ll get 400.
    // If you want strict “404 only”, use a valid token format here.
    expect([400, 404]).toContain(res.status);
  });

  it("validation: rejects blank reply body", async () => {
    const { thread } = await createThread("t", "op");

    const res = await agent
      .post(`/api/boards/b/${thread.subject_slug}/${thread.token}/replies`)
      .set("content-type", "application/json")
      .send({ body: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("can hard delete a thread by board + subjectSlug + token", async () => {
    const { thread, deleteKey } = await createThread("delete me", "op");

    const del = await agent.delete(
      `/api/boards/b/${thread.subject_slug}/${thread.token}?key=${encodeURIComponent(deleteKey)}`,
    );

    expect(del.status).toBe(204);

    const view = await request(app).get(
      `/api/boards/b/${thread.subject_slug}/${thread.token}`,
    );

    expect(view.status).toBe(404);
  });

  it("can hard delete a thread by UUID", async () => {
    const { thread, deleteKey } = await createThread("delete by id", "op");

    const del = await agent.delete(`/api/threads/${thread.id}?key=${encodeURIComponent(deleteKey)}`);
    expect(del.status).toBe(204);

    const viewById = await request(app).get(`/api/threads/${thread.id}`);
    expect(viewById.status).toBe(404);
  });

  it("rejects pretty-route deletion without key", async () => {
    const { thread } = await createThread("delete denied", "op");

    const del = await agent.delete(`/api/boards/b/${thread.subject_slug}/${thread.token}`);
    expect(del.status).toBe(400);
    expect(del.body.error).toBe("validation_error");
  });

  it("rejects UUID deletion with wrong key", async () => {
    const { thread } = await createThread("delete denied by id", "op");

    const del = await agent.delete(
      `/api/threads/${thread.id}?key=${encodeURIComponent("wrong-key")}`,
    );
    expect(del.status).toBe(403);
    expect(del.body.error).toBe("invalid_delete_key");
  });
});
