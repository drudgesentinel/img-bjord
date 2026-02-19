import "dotenv/config";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { dbPing, dbReset, ensureBoard, dbClose } from "./_db.js";

describe.sequential("threads", () => {
  const app = createApp();

  beforeAll(async () => {
    await dbPing();
  });

  beforeEach(async () => {
    await dbReset();
    await ensureBoard("b", "Random");
  });

  // afterAll(async () => {
  //   await dbClose();
  // });

  async function createThread() {
    const res = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "t", body: "op" });

    expect(res.status).toBe(201);
    return res.body.thread.id;
  }

  it("can view a thread by id", async () => {
    const threadId = await createThread();

    const viewRes = await request(app).get(`/api/threads/${threadId}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.thread.id).toBe(threadId);
    expect(viewRes.body.posts.length).toBe(1);
    expect(viewRes.body.posts[0].body).toBe("op");
  });

  it("replies add a post", async () => {
    const threadId = await createThread();

    const replyRes = await request(app)
      .post(`/api/threads/${threadId}/replies`)
      .set("content-type", "application/json")
      .send({ body: "reply 1" });

    expect(replyRes.status).toBe(201);

    const viewRes = await request(app).get(`/api/threads/${threadId}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.posts.length).toBe(2);
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

  it("validation: bad uuid on replies returns 400", async () => {
    const res = await request(app)
      .post("/api/threads/not-a-uuid/replies")
      .set("content-type", "application/json")
      .send({ body: "hi" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("validation: blank reply body returns 400", async () => {
    const threadId = await createThread();

    const res = await request(app)
      .post(`/api/threads/${threadId}/replies`)
      .set("content-type", "application/json")
      .send({ body: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
});
