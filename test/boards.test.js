import "dotenv/config";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { dbPing, dbReset, ensureBoard, dbClose } from "./_db.js";

describe.sequential("boards", () => {
  const app = createApp();

  beforeAll(async () => {
    await dbPing();
  });

  beforeEach(async () => {
    await dbReset();
    await ensureBoard("b", "Random");
  });

//   afterAll(async () => {
//     await dbClose();
//   });

  it("can create a thread on a board", async () => {
    const res = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "test thread", body: "first post" });

    expect(res.status).toBe(201);
    expect(res.body.thread?.id).toBeTruthy();
    expect(res.body.thread.board_slug).toBe("b");
  });

  it("lists threads for a board", async () => {
    const createRes = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "A", body: "op A" });

    // critical: ensure creation succeeded
    expect(createRes.status).toBe(201);

    const listRes = await request(app).get("/api/boards/b/threads?limit=10");
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.threads)).toBe(true);

    expect(listRes.body.threads.length).toBe(1);
    expect(listRes.body.threads[0].board_slug).toBe("b");
  });

  it("list threads returns newest bumped first within the board", async () => {
    const a = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "A", body: "op A" });
    expect(a.status).toBe(201);

    const b = await request(app)
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "B", body: "op B" });
    expect(b.status).toBe(201);

    const aId = a.body.thread.id;
    const bId = b.body.thread.id;

    const bump = await request(app)
      .post(`/api/threads/${aId}/replies`)
      .set("content-type", "application/json")
      .send({ body: "bump" });
    expect(bump.status).toBe(201);

    const listRes = await request(app).get("/api/boards/b/threads");
    expect(listRes.status).toBe(200);

    const ids = listRes.body.threads.map((t) => t.id);
    expect(ids[0]).toBe(aId);
    expect(ids).toContain(bId);
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
