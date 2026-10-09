import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import express from "express";
import type { Server } from "node:http";

import { pool } from "@workspace/db";
import type { RequestAuth } from "../lib/supabaseAuth";
import userRouter from "./user";

const userA = `user-profile-test-${randomUUID()}`;
const userB = `user-profile-test-${randomUUID()}`;
const tokenA = "user-profile-test-user-a";
const tokenB = "user-profile-test-user-b";

type ProfileResponse = {
  theme: string;
  location: Record<string, unknown> | null;
  isPremium: boolean;
  candleEnabled: boolean;
  language: string;
  notifPrefs: Record<string, unknown> | null;
  leadTime: number;
};

let server: Server;
let baseUrl: string;

function authFor(userId: string): RequestAuth {
  return {
    provider: "supabase",
    subject: userId,
    userId,
    email: null,
    name: "Profile test",
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
  app.use(userRouter);

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
      "DELETE FROM user_profiles WHERE user_id = ANY($1::text[])",
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
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

describe("user profile partial updates", () => {
  it("preserves omitted preferences and server-managed premium status", async () => {
    const location = {
      name: "Churachandpur",
      lat: 24.33,
      lng: 93.68,
      tz: "Asia/Kolkata",
    };
    const prefs = { shabbat: true, holiday: false };
    await pool.query(
      `INSERT INTO user_profiles
         (user_id, theme, location, is_premium, candle_enabled, language, notif_prefs, lead_time)
       VALUES ($1, 'sapphire', $2::jsonb, true, false, 'tk', $3::jsonb, 45)`,
      [userA, JSON.stringify(location), JSON.stringify(prefs)],
    );

    const update = await request("/user/profile", tokenA, {
      method: "PUT",
      body: JSON.stringify({
        notifPrefs: { shabbat: false, holiday: false },
        leadTime: 20,
      }),
    });
    assert.equal(update.status, 200);

    const response = await request("/user/profile", tokenA);
    assert.equal(response.status, 200);
    const profile = (await response.json()) as ProfileResponse;
    assert.equal(profile.theme, "sapphire");
    assert.deepEqual(profile.location, location);
    assert.equal(profile.isPremium, true);
    assert.equal(profile.candleEnabled, false);
    assert.equal(profile.language, "tk");
    assert.deepEqual(profile.notifPrefs, { shabbat: false, holiday: false });
    assert.equal(profile.leadTime, 20);
  });

  it("uses profile defaults when creating a row from a partial update", async () => {
    const update = await request("/user/profile", tokenB, {
      method: "PUT",
      body: JSON.stringify({ theme: "light" }),
    });
    assert.equal(update.status, 200);

    const response = await request("/user/profile", tokenB);
    assert.equal(response.status, 200);
    const profile = (await response.json()) as ProfileResponse;
    assert.equal(profile.theme, "light");
    assert.equal(profile.location, null);
    assert.equal(profile.isPremium, false);
    assert.equal(profile.candleEnabled, true);
    assert.equal(profile.language, "en");
    assert.equal(profile.notifPrefs, null);
    assert.equal(profile.leadTime, 10);
  });
});
