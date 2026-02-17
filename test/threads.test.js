import "dotenv/config";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { dbPing, dbReset, dbClose } from "./_db.js";

describe("threads", () => {
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

  it("can create a thread and view it", async () => {
    const createRes = await request(app)
      .post("/api/threads")
      .set("content-type", "application/json")
      .send({ subject: "test thread", body: "first post" });

    expect(createRes.status).toBe(201);
    expect(createRes.body.thread?.id).toBeTruthy();

    const threadId = createRes.body.thread.id;

    const viewRes = await request(app).get(`/api/threads/${threadId}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.thread.id).toBe(threadId);
    expect(viewRes.body.posts.length).toBe(1);
    expect(viewRes.body.posts[0].body).toBe("first post");
  });

  it("replies add a post", async () => {
    const createRes = await request(app)
      .post("/api/threads")
      .set("content-type", "application/json")
      .send({ subject: "t", body: "op" });

    const threadId = createRes.body.thread.id;

    const replyRes = await request(app)
      .post(`/api/threads/${threadId}/replies`)
      .set("content-type", "application/json")
      .send({ body: "reply 1" });

    expect(replyRes.status).toBe(201);

    const viewRes = await request(app).get(`/api/threads/${threadId}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.posts.length).toBe(2);
  });

  it("list threads returns newest bumped first", async () => {
    const a = await request(app)
      .post("/api/threads")
      .set("content-type", "application/json")
      .send({ subject: "A", body: "op A" });

    const b = await request(app)
      .post("/api/threads")
      .set("content-type", "application/json")
      .send({ subject: "B", body: "op B" });

    const aId = a.body.thread.id;
    const bId = b.body.thread.id;

    // bump A so it should rise above B
    await request(app)
      .post(`/api/threads/${aId}/replies`)
      .set("content-type", "application/json")
      .send({ body: "bump" });

    const listRes = await request(app).get("/api/threads");
    expect(listRes.status).toBe(200);

    const ids = listRes.body.threads.map((t) => t.id);
    expect(ids[0]).toBe(aId);
    expect(ids).toContain(bId);
  });

  it("validation: missing body on create returns 400", async () => {
    const res = await request(app)
      .post("/api/threads")
      .set("content-type", "application/json")
      .send({ subject: "no body" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("validation: bad uuid on replies returns 400", async () => {
    const res = await request(app)
      .post("/api/threads/not-a-uuid/replies")
      .set("content-type", "application/json")
      .send({ body: "hi" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
  it("GET /api/threads/:id returns 404 when not found", async () => {
  const res = await request(app).get(
    "/api/threads/00000000-0000-0000-0000-000000000000"
  );

  expect(res.status).toBe(404);
  expect(res.body.error).toBe("not_found");
});

it("POST /api/threads/:id/replies returns 404 when thread not found", async () => {
  const res = await request(app)
    .post("/api/threads/00000000-0000-0000-0000-000000000000/replies")
    .set("content-type", "application/json")
    .send({ body: "hi" });

  expect(res.status).toBe(404);
  expect(res.body.error).toBe("not_found");
});

it("POST /api/threads rejects extra fields (strict schema)", async () => {
  const res = await request(app)
    .post("/api/threads")
    .set("content-type", "application/json")
    .send({ subject: "s", body: "b", extra: 123 });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe("validation_error");
});

it("POST /api/threads/:id/replies rejects blank body", async () => {
  const createRes = await request(app)
    .post("/api/threads")
    .set("content-type", "application/json")
    .send({ subject: "t", body: "op" });

  const threadId = createRes.body.thread.id;

  const res = await request(app)
    .post(`/api/threads/${threadId}/replies`)
    .set("content-type", "application/json")
    .send({ body: "   " });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe("validation_error");
});

});
