import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUpcomingCelebrations,
  type UpcomingCelebration,
} from "./upcomingCelebrations";
import type { DirectoryMember } from "./directoryApi";

const member = (
  overrides: Partial<DirectoryMember> = {},
): DirectoryMember => ({
  id: "member-1",
  name: "Community Member",
  city: "Imphal",
  country: "India",
  role: "Member",
  bio: "",
  status: "approved",
  joinedAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

test("home celebrations use approved shared directory entries only", () => {
  const daysByDate: Record<string, number> = {
    birthday: 1,
    aliyah: 4,
    past: -1,
    later: 8,
  };
  const result: UpcomingCelebration[] = buildUpcomingCelebrations(
    [
      member({ id: "approved", birthday: "birthday", aliyahDate: "aliyah" }),
      member({ id: "pending", status: "pending", birthday: "birthday" }),
      member({ id: "past", birthday: "past" }),
      member({ id: "later", birthday: "later" }),
    ],
    (date) => daysByDate[date] ?? -1,
  );

  assert.deepEqual(
    result.map(({ id, type, days }) => ({ id, type, days })),
    [
      { id: "approved", type: "birthday", days: 1 },
      { id: "approved-al", type: "aliyah", days: 4 },
    ],
  );
});
