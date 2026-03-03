import "dotenv/config";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { dbPing, dbReset, dbClose } from "./_db.js";

describe("boards", () => {
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

  it("can create a thread on a board (OP is post #1) and includes token/subject_slug", async () => {
    const createRes = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "Lifting Routine", body: "op" });

    expect(createRes.status).toBe(201);

    const thread = createRes.body.thread;
    const firstPost = createRes.body.firstPost;

    expect(thread).toBeTruthy();
    expect(thread.board_slug).toBe("b");
    expect(thread.subject_slug).toBeTruthy();
    expect(thread.token).toBeTruthy();

    expect(firstPost.post_number).toBe(1);
    expect(firstPost.body).toBe("op");

    // canonicalPath is optional, but if present it should be usable
    if (createRes.body.canonicalPath) {
      expect(createRes.body.canonicalPath).toContain(`/api/boards/b/`);
      expect(createRes.body.canonicalPath).toContain(thread.token);
    }
  });

  it("lists threads for a board", async () => {
    await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "A", body: "op A" });

    const listRes = await request(app).get("/api/boards/b/threads?limit=10");
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.threads)).toBe(true);
    expect(listRes.body.threads.length).toBe(1);

    const t0 = listRes.body.threads[0];
    expect(t0.board_slug).toBe("b");
    expect(t0.subject_slug).toBeTruthy();
    expect(t0.token).toBeTruthy();
  });

  it("list threads returns newest bumped first within the board", async () => {
    const a = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "A", body: "op A" });

    const b = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "B", body: "op B" });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const aThread = a.body.thread;
    const bThread = b.body.thread;

    // bump A so it should rise above B
    const bump = await request(app)
      .post(`/api/boards/b/${aThread.subject_slug}/${aThread.token}/replies`)
      .set("content-type", "application/json")
      .send({ body: "bump" });

    expect(bump.status).toBe(201);

    const listRes = await request(app).get("/api/boards/b/threads?limit=10");
    expect(listRes.status).toBe(200);

    const ids = listRes.body.threads.map((t) => t.id);
    expect(ids[0]).toBe(aThread.id);
    expect(ids).toContain(bThread.id);
  });

  it("returns 404 for unknown board", async () => {
    const res = await request(app).get("/api/boards/doesnotexist/threads");
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
