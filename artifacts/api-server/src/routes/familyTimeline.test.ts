import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import express from "express";
import type { Server } from "node:http";

import { pool } from "@workspace/db";
import type { RequestAuth } from "../lib/supabaseAuth";
import familyTimelineRouter from "./familyTimeline";

const userA = `family-timeline-test-${randomUUID()}`;
const userB = `family-timeline-test-${randomUUID()}`;
const tokenA = "family-timeline-test-user-a";
const tokenB = "family-timeline-test-user-b";

let server: Server;
let baseUrl: string;

function authFor(userId: string): RequestAuth {
  return {
    provider: "supabase",
    subject: userId,
    userId,
    email: null,
    name: "Timeline test",
    imageUrl: null,
    isAdmin: false,
    createdAt: new Date().toISOString(),
  };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers.authorization === `Bearer ${tokenA}`) {
      req.supabaseAuth = authFor(userA);
    } else if (req.headers.authorization === `Bearer ${tokenB}`) {
      req.supabaseAuth = authFor(userB);
    }
    next();
  });
  app.use(familyTimelineRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Test server did not bind to a TCP port");
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  try {
    await pool.query(
      "DELETE FROM family_timeline WHERE user_id = ANY($1::text[])",
      [[userA, userB]],
    );
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await pool.end();
  }
});

async function request(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

describe("family timeline authentication and ownership", () => {
  it("uses the authenticated user ID for timeline CRUD and isolates other users", async () => {
    const anonymous = await request("/family-timeline");
    assert.equal(anonymous.status, 401);

    const initial = await request("/family-timeline", tokenA);
    assert.equal(initial.status, 200);
    const initialBody = (await initial.json()) as { events: unknown[] };
    assert.deepEqual(initialBody.events, []);

    const createdResponse = await request("/family-timeline", tokenA, {
      method: "POST",
      body: JSON.stringify({
        eventType: "birth",
        title: "Family timeline regression fixture",
        gregorianDate: "2024-06-01",
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as {
      id: string;
      userId: string;
    };
    assert.equal(created.userId, userA);

    const otherUsersList = await request("/family-timeline", tokenB);
    assert.equal(otherUsersList.status, 200);
    const otherUsersBody = (await otherUsersList.json()) as {
      events: unknown[];
    };
    assert.deepEqual(otherUsersBody.events, []);

    const otherUsersUpdate = await request(
      `/family-timeline/${created.id}`,
      tokenB,
      {
        method: "PATCH",
        body: JSON.stringify({ title: "Unauthorized change" }),
      },
    );
    assert.equal(otherUsersUpdate.status, 404);

    const updatedResponse = await request(
      `/family-timeline/${created.id}`,
      tokenA,
      {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated regression fixture" }),
      },
    );
    assert.equal(updatedResponse.status, 200);
    const updated = (await updatedResponse.json()) as {
      title: string;
      userId: string;
    };
    assert.equal(updated.title, "Updated regression fixture");
    assert.equal(updated.userId, userA);

    const otherUsersDelete = await request(
      `/family-timeline/${created.id}`,
      tokenB,
      { method: "DELETE" },
    );
    assert.equal(otherUsersDelete.status, 404);

    const deleted = await request(
      `/family-timeline/${created.id}`,
      tokenA,
      { method: "DELETE" },
    );
    assert.equal(deleted.status, 204);
  });
});
