import assert from "node:assert/strict";
import test from "node:test";
import { requestPushUnsubscribe, requestTestPush } from "./pushApi";

test("push unsubscribe reports HTTP authorization failures instead of pretending success", async () => {
  let requestInit: RequestInit | undefined;
  const result = await requestPushUnsubscribe(
    "https://push.example/endpoint",
    async (_input, init) => {
      requestInit = init;
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    },
    "session-token",
  );

  assert.deepEqual(result, { ok: false, error: "Sign in required" });
  assert.equal(requestInit?.method, "DELETE");
  assert.equal(requestInit?.headers instanceof Headers, false);
  assert.match(JSON.stringify(requestInit?.headers), /Bearer session-token/);
});

test("push unsubscribe reports network failures", async () => {
  const result = await requestPushUnsubscribe(
    "https://push.example/endpoint",
    async () => {
      throw new Error("network details are not shown to the user");
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "Could not reach the notification service.",
  });
});

test("test notification reports a server rejection and accepts success", async () => {
  const rejected = await requestTestPush(async () =>
    new Response(JSON.stringify({ error: "No active subscription" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const accepted = await requestTestPush(async () => new Response(null, { status: 204 }));

  assert.deepEqual(rejected, { ok: false, error: "No active subscription" });
  assert.deepEqual(accepted, { ok: true });
});
