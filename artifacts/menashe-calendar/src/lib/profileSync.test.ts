import assert from "node:assert/strict";
import test from "node:test";

import {
  isProfileSyncedForUser,
  shouldResetProfileForUser,
} from "./profileSync";

test("profile state resets when the cached owner is unknown or changes", () => {
  assert.equal(shouldResetProfileForUser(null, "user-a"), true);
  assert.equal(shouldResetProfileForUser("user-a", "user-a"), false);
  assert.equal(shouldResetProfileForUser("user-a", "user-b"), true);
});

test("profile writes are enabled only for the account whose profile loaded", () => {
  assert.equal(isProfileSyncedForUser("user-a", "user-a"), true);
  assert.equal(isProfileSyncedForUser("user-a", "user-b"), false);
  assert.equal(isProfileSyncedForUser(null, "user-a"), false);
  assert.equal(isProfileSyncedForUser("user-a", null), false);
});
