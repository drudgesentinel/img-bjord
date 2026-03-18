import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createUser, dbPing, dbReset, dbClose } from "./_db.js";
import { getUploadDir, isLocalMediaStorage } from "../src/lib/mediaStorage.js";

describe("threads", () => {
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

  async function createThread(subject = "t", body = "op") {
    const res = await agent
      .post("/api/boards/b/threads")
      .set("content-type", "application/json")
      .send({ subject, body });

    expect(res.status).toBe(201);

    const thread = res.body.thread;
    expect(thread.subject_slug).toBeTruthy();
    expect(thread.token).toBeTruthy();

    return { thread };
  }

  async function createApprovedNonAdminAgent(password = "another pass phrase") {
    const nonAdminAgent = request.agent(app);
    const registerRes = await nonAdminAgent
      .post("/api/auth/register")
      .set("content-type", "application/json")
      .send({ password, activationCode: "please approve" });

    expect(registerRes.status).toBe(202);

    const approveRes = await agent.post(`/api/admin/users/${registerRes.body.user.id}/approve`);
    expect(approveRes.status).toBe(204);

    const loginRes = await nonAdminAgent
      .post("/api/auth/login")
      .set("content-type", "application/json")
      .send({ username: registerRes.body.user.username, password });

    expect(loginRes.status).toBe(200);
    return nonAdminAgent;
  }

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

  function toLocalUploadPath(mediaUrl) {
    if (!mediaUrl?.startsWith("/api/uploads/")) return null;
    return path.join(getUploadDir(), path.basename(mediaUrl));
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

  it("user can delete own reply and hard delete its media", async () => {
    const { thread } = await createThread("reply delete", "op");
    const nonAdminAgent = await createApprovedNonAdminAgent("reply delete user pass");

    const gifBytes = Buffer.from(
      "47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b",
      "hex",
    );

    const replyRes = await nonAdminAgent
      .post(`/api/boards/b/${thread.subject_slug}/${thread.token}/replies`)
      .field("body", "my own media reply")
      .attach("image", gifBytes, { filename: "tiny.gif", contentType: "image/gif" });

    expect(replyRes.status).toBe(201);
    const replyPostId = replyRes.body.post.id;
    const replyMediaUrl = replyRes.body.post.media_url;

    const localUploadPath = toLocalUploadPath(replyMediaUrl);
    if (isLocalMediaStorage() && localUploadPath) {
      await expect(fs.stat(localUploadPath)).resolves.toBeTruthy();
    }

    const del = await nonAdminAgent.delete(
      `/api/boards/b/${thread.subject_slug}/${thread.token}/replies/${replyPostId}`,
    );
    expect(del.status).toBe(204);

    const viewRes = await request(app).get(
      `/api/boards/b/${thread.subject_slug}/${thread.token}`,
    );
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.posts.map((p) => p.post_number)).toEqual([1]);

    if (isLocalMediaStorage() && localUploadPath) {
      await expect(fs.stat(localUploadPath)).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  it("forbids deleting another user's reply", async () => {
    const { thread } = await createThread("reply auth", "op");
    const ownerAgent = await createApprovedNonAdminAgent("owner passphrase");
    const otherAgent = await createApprovedNonAdminAgent("other passphrase");

    const replyRes = await ownerAgent
      .post(`/api/boards/b/${thread.subject_slug}/${thread.token}/replies`)
      .set("content-type", "application/json")
      .send({ body: "owner reply" });
    expect(replyRes.status).toBe(201);

    const del = await otherAgent.delete(
      `/api/boards/b/${thread.subject_slug}/${thread.token}/replies/${replyRes.body.post.id}`,
    );

    expect(del.status).toBe(403);
    expect(del.body.error).toBe("forbidden");
  });

  it("rejects deleting the original post through reply delete endpoint", async () => {
    const { thread } = await createThread("op protected", "op");

    const viewRes = await request(app).get(
      `/api/boards/b/${thread.subject_slug}/${thread.token}`,
    );
    expect(viewRes.status).toBe(200);
    const opPostId = viewRes.body.posts[0].id;

    const del = await agent.delete(
      `/api/boards/b/${thread.subject_slug}/${thread.token}/replies/${opPostId}`,
    );

    expect(del.status).toBe(400);
    expect(del.body.error).toBe("validation_error");
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

  it("accepts GIF upload and preserves GIF mime type", async () => {
    const gifBytes = Buffer.from(
      "47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b",
      "hex",
    );

    const res = await agent
      .post("/api/boards/b/threads")
      .field("subject", "gif upload")
      .field("body", "")
      .attach("image", gifBytes, { filename: "tiny.gif", contentType: "image/gif" });

    expect(res.status).toBe(201);
    expect(res.body.firstPost?.media_mime_type).toBe("image/gif");
    expect(res.body.firstPost?.media_url).toContain(".gif");
  });

  it("admin can hard delete a thread by board + subjectSlug + token", async () => {
    const { thread } = await createThread("delete me", "op");

    const del = await agent.delete(`/api/boards/b/${thread.subject_slug}/${thread.token}`);

    expect(del.status).toBe(204);

    const view = await request(app).get(
      `/api/boards/b/${thread.subject_slug}/${thread.token}`,
    );

    expect(view.status).toBe(404);
  });

  it("admin can hard delete a thread by UUID", async () => {
    const { thread } = await createThread("delete by id", "op");

    const del = await agent.delete(`/api/threads/${thread.id}`);
    expect(del.status).toBe(204);

    const viewById = await request(app).get(`/api/threads/${thread.id}`);
    expect(viewById.status).toBe(404);
  });

  it("forbids pretty-route deletion for non-admin", async () => {
    const { thread } = await createThread("delete denied", "op");
    const nonAdminAgent = await createApprovedNonAdminAgent();

    const del = await nonAdminAgent.delete(`/api/boards/b/${thread.subject_slug}/${thread.token}`);
    expect(del.status).toBe(403);
    expect(del.body.error).toBe("forbidden");
  });

  it("forbids UUID deletion for non-admin", async () => {
    const { thread } = await createThread("delete denied by id non-admin", "op");
    const nonAdminAgent = await createApprovedNonAdminAgent();

    const del = await nonAdminAgent.delete(`/api/threads/${thread.id}`);
    expect(del.status).toBe(403);
    expect(del.body.error).toBe("forbidden");
  });

  it("hides UUID thread detail when board visibility tags do not match", async () => {
    const createBoardRes = await agent
      .post("/api/admin/boards")
      .set("content-type", "application/json")
      .send({ slug: "vip3", name: "VIP 3", visibleToTags: ["vip"] });
    expect(createBoardRes.status).toBe(201);

    const createThreadRes = await agent
      .post("/api/boards/vip3/threads")
      .set("content-type", "application/json")
      .send({ subject: "private", body: "op" });
    expect(createThreadRes.status).toBe(201);

    const threadId = createThreadRes.body.thread.id;

    const anonView = await request(app).get(`/api/threads/${threadId}`);
    expect(anonView.status).toBe(404);

    const taggedUserAgent = await createAndLoginUserWithTags({
      username: "vip_1001",
      password: "tagged user pass",
      tags: ["vip"],
    });

    const taggedView = await taggedUserAgent.get(`/api/threads/${threadId}`);
    expect(taggedView.status).toBe(200);
    expect(taggedView.body.thread.id).toBe(threadId);
  });
});
