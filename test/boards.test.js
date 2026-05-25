import "dotenv/config";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createUser, dbPing, dbReset, dbClose } from "./_db.js";

describe("boards", () => {
  const app = createApp();
  let agent;

  beforeAll(async () => {
    await dbPing();
  });

  beforeEach(async () => {
    await dbReset();
    await createUser({
      username: "admin_0001",
      password: "correct horse battery staple",
      isApproved: true,
      isAdmin: true,
    });

    agent = request.agent(app);
    const loginRes = await agent
      .post("/api/auth/login")
      .set("content-type", "application/json")
      .send({ username: "admin_0001", password: "correct horse battery staple" });
    expect(loginRes.status).toBe(200);
  });

  afterAll(async () => {
    await dbClose();
  });

  async function createAndLoginUserWithTags({ username, password, tags = [] }) {
    await createUser({
      username,
      password,
      isApproved: true,
      isAdmin: false,
      tags,
    });

    const userAgent = request.agent(app);
    const loginRes = await userAgent
      .post("/api/auth/login")
      .set("content-type", "application/json")
      .send({ username, password });
    expect(loginRes.status).toBe(200);

    return userAgent;
  }

  it("can create a thread on a board (OP is post #1) and includes token/subject_slug", async () => {
    const createRes = await agent
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
    await agent
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "A", body: "op A" });

    const listRes = await agent.get("/api/boards/b/threads?limit=10");
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.threads)).toBe(true);
    expect(listRes.body.threads.length).toBe(1);

    const t0 = listRes.body.threads[0];
    expect(t0.board_slug).toBe("b");
    expect(t0.subject_slug).toBeTruthy();
    expect(t0.token).toBeTruthy();
  });

  it("supports page query for board thread listings", async () => {
    for (let i = 1; i <= 25; i += 1) {
      const createRes = await agent
        .post("/api/boards/b/threads")
        .set("content-type", "application/json")
        .send({ subject: `Thread ${i}`, body: `op ${i}` });
      expect(createRes.status).toBe(201);
    }

    const pageOneRes = await agent.get("/api/boards/b/threads?limit=20&page=1");
    const pageTwoRes = await agent.get("/api/boards/b/threads?limit=20&page=2");

    expect(pageOneRes.status).toBe(200);
    expect(pageTwoRes.status).toBe(200);
    expect(pageOneRes.body.threads.length).toBe(20);
    expect(pageTwoRes.body.threads.length).toBe(5);

    const pageOneIds = new Set(pageOneRes.body.threads.map((thread) => thread.id));
    const overlapCount = pageTwoRes.body.threads.filter((thread) => pageOneIds.has(thread.id)).length;
    expect(overlapCount).toBe(0);
  });

  it("list threads returns newest bumped first within the board", async () => {
    const a = await agent
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "A", body: "op A" });

    const b = await agent
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "B", body: "op B" });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const aThread = a.body.thread;
    const bThread = b.body.thread;

    // bump A so it should rise above B
    const bump = await agent
      .post(`/api/boards/b/${aThread.subject_slug}/${aThread.token}/replies`)
      .set("content-type", "application/json")
      .send({ body: "bump" });

    expect(bump.status).toBe(201);

    const listRes = await agent.get("/api/boards/b/threads?limit=10");
    expect(listRes.status).toBe(200);

    const ids = listRes.body.threads.map((t) => t.id);
    expect(ids[0]).toBe(aThread.id);
    expect(ids).toContain(bThread.id);
  });

  it("serves board RSS feed ordered by latest bump", async () => {
    const a = await agent
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "A", body: "op A" });

    const b = await agent
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "B", body: "op B" });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const aThread = a.body.thread;
    const bThread = b.body.thread;

    const bump = await agent
      .post(`/api/boards/b/${aThread.subject_slug}/${aThread.token}/replies`)
      .set("content-type", "application/json")
      .send({ body: "bump" });
    expect(bump.status).toBe(201);

    const res = await request(app).get("/api/boards/b/rss.xml?limit=10");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/rss\+xml/);
    expect(res.text).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(res.text).toContain("<rss version=\"2.0\">");
    expect(res.text).toContain("<channel>");

    const aPath = `/boards/b/${aThread.subject_slug}/${aThread.token}`;
    const bPath = `/boards/b/${bThread.subject_slug}/${bThread.token}`;
    expect(res.text).toContain(aPath);
    expect(res.text).toContain(bPath);
    expect(res.text.indexOf(aPath)).toBeLessThan(res.text.indexOf(bPath));
  });

  it("serves global RSS feed across boards ordered by latest bump", async () => {
    const createBoardRes = await agent
      .post("/api/admin/boards")
      .set("content-type", "application/json")
      .send({ slug: "tech", name: "Technology" });
    expect(createBoardRes.status).toBe(201);

    const bThreadRes = await agent
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject: "B board", body: "op b" });

    const techThreadRes = await agent
      .post("/api/boards/tech/threads")
      .set("content-type", "application/json")
      .send({ subject: "Tech board", body: "op tech" });

    expect(bThreadRes.status).toBe(201);
    expect(techThreadRes.status).toBe(201);

    const bThread = bThreadRes.body.thread;
    const techThread = techThreadRes.body.thread;

    const bump = await agent
      .post(`/api/boards/b/${bThread.subject_slug}/${bThread.token}/replies`)
      .set("content-type", "application/json")
      .send({ body: "bump b" });
    expect(bump.status).toBe(201);

    const res = await request(app).get("/api/boards/rss.xml?limit=10");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/rss\+xml/);
    expect(res.text).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(res.text).toContain("<rss version=\"2.0\">");
    expect(res.text).toContain("<channel>");

    const bPath = `/boards/b/${bThread.subject_slug}/${bThread.token}`;
    const techPath = `/boards/tech/${techThread.subject_slug}/${techThread.token}`;
    expect(res.text).toContain(bPath);
    expect(res.text).toContain(techPath);
    expect(res.text.indexOf(bPath)).toBeLessThan(res.text.indexOf(techPath));
  });

  it("returns 404 for unknown board RSS feed", async () => {
    const res = await request(app).get("/api/boards/doesnotexist/rss.xml");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("board_not_found");
  });

  it("returns 404 for unknown board", async () => {
    const res = await request(app).get("/api/boards/doesnotexist/threads");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("board_not_found");
  });

  it("validation: rejects bad board slug", async () => {
    const res = await agent
      .post("/api/boards/bad!/threads")
      .set("content-type", "application/json")
      .send({ subject: "x", body: "y" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("hides restricted boards from users without matching tags", async () => {
    const createBoardRes = await agent
      .post("/api/admin/boards")
      .set("content-type", "application/json")
      .send({ slug: "vip", name: "VIP", visibleToTags: ["vip"] });
    expect(createBoardRes.status).toBe(201);

    const anonList = await request(app).get("/api/boards");
    expect(anonList.status).toBe(200);
    expect(anonList.body.boards.some((b) => b.slug === "vip")).toBe(false);

    const taggedUserAgent = await createAndLoginUserWithTags({
      username: "vip_0001",
      password: "tagged user pass",
      tags: ["vip"],
    });

    const taggedList = await taggedUserAgent.get("/api/boards");
    expect(taggedList.status).toBe(200);
    expect(taggedList.body.boards.some((b) => b.slug === "vip")).toBe(true);
  });

  it("returns 404 for restricted board thread listing without matching tags", async () => {
    const createBoardRes = await agent
      .post("/api/admin/boards")
      .set("content-type", "application/json")
      .send({ slug: "vip2", name: "VIP 2", visibleToTags: ["vip"] });
    expect(createBoardRes.status).toBe(201);

    const createThreadRes = await agent
      .post("/api/boards/vip2/threads")
      .set("content-type", "application/json")
      .send({ subject: "private", body: "op" });
    expect(createThreadRes.status).toBe(201);

    const anonListThreads = await request(app).get("/api/boards/vip2/threads");
    expect(anonListThreads.status).toBe(404);
    expect(anonListThreads.body.error).toBe("board_not_found");

    const taggedUserAgent = await createAndLoginUserWithTags({
      username: "vip_0002",
      password: "tagged user pass",
      tags: ["vip"],
    });

    const taggedListThreads = await taggedUserAgent.get("/api/boards/vip2/threads");
    expect(taggedListThreads.status).toBe(200);
    expect(taggedListThreads.body.threads.length).toBe(1);
  });
});
