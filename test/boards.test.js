import "dotenv/config";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { dbPing, dbReset, ensureBoard } from "./_db.js";

describe.sequential("boards", () => {
  const app = createApp();

  beforeAll(async () => {
    await dbPing();
  });

  beforeEach(async () => {
    await dbReset();
    await ensureBoard("b", "Random");
  });

  it("can create a thread on a board (thread has slug, OP is post #1)", async () => {
    const res = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "Hello World", body: "first post" });

    expect(res.status).toBe(201);
    expect(res.body.thread?.id).toBeTruthy();
    expect(res.body.thread.board_slug).toBe("b");
    expect(typeof res.body.thread.slug).toBe("string");
    expect(res.body.thread.slug.length).toBeGreaterThan(2);

    expect(res.body.firstPost?.post_number).toBe(1);
    expect(res.body.firstPost?.body).toBe("first post");
  });

  it("lists threads for a board includes slug", async () => {
    const createRes = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "A", body: "op A" });

    expect(createRes.status).toBe(201);

    const listRes = await request(app).get("/api/boards/b/threads?limit=10");
    expect(listRes.status).toBe(200);

    expect(listRes.body.threads.length).toBe(1);
    expect(listRes.body.threads[0].board_slug).toBe("b");
    expect(typeof listRes.body.threads[0].slug).toBe("string");
  });

  it("view thread by board+thread slug", async () => {
    const createRes = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "Slug Test", body: "op" });

    const threadSlug = createRes.body.thread.slug;

    const viewRes = await request(app).get(
      `/api/boards/b/threads/${threadSlug}`,
    );
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.thread.slug).toBe(threadSlug);
    expect(viewRes.body.posts.length).toBe(1);
    expect(viewRes.body.posts[0].post_number).toBe(1);
  });

  it("returns 404 for unknown board", async () => {
    const res = await request(app)
      .post("/api/boards/nope/threads")
      .set("content-type", "application/json")
      .send({ subject: "x", body: "y" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("board_not_found");
  });

  it("validation: rejects bad board slug", async () => {
    const res = await request(app)
      .post("/api/boards/bad!/threads")
      .set("content-type", "application/json")
      .send({ subject: "x", body: "y" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
});
