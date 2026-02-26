import "dotenv/config";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { dbPing, dbReset, ensureBoard } from "./_db.js";

describe.sequential("threads", () => {
  const app = createApp();

  beforeAll(async () => {
    await dbPing();
  });

  beforeEach(async () => {
    await dbReset();
    await ensureBoard("b", "Random");
  });

  async function createThread() {
    const res = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "t", body: "op" });

    expect(res.status).toBe(201);
    return { id: res.body.thread.id, slug: res.body.thread.slug };
  }

  it("can view a thread by uuid (posts ordered by post_number)", async () => {
    const { id } = await createThread();

    const viewRes = await request(app).get(`/api/threads/${id}`);
    expect(viewRes.status).toBe(200);

    expect(viewRes.body.thread.id).toBe(id);
    expect(viewRes.body.posts.length).toBe(1);
    expect(viewRes.body.posts[0].post_number).toBe(1);
    expect(viewRes.body.posts[0].body).toBe("op");
  });

  it("can reply via board+threadSlug route and post_number increments", async () => {
    const { slug: threadSlug } = await createThread();

    const r1 = await request(app)
      .post(`/api/boards/b/threads/${threadSlug}/replies`)
      .set("content-type", "application/json")
      .send({ body: "reply 1" });
    expect(r1.status).toBe(201);
    expect(r1.body.post.post_number).toBe(2);

    const viewRes = await request(app).get(
      `/api/boards/b/threads/${threadSlug}`,
    );
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.posts.map((p) => p.post_number)).toEqual([1, 2]);
  });

  it("GET /api/threads/:id returns 404 when not found", async () => {
    const res = await request(app).get(
      "/api/threads/00000000-0000-0000-0000-000000000000",
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
    const { id } = await createThread();

    const res = await request(app)
      .post(`/api/threads/${id}/replies`)
      .set("content-type", "application/json")
      .send({ body: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
});
