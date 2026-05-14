import test from "node:test";
import assert from "node:assert/strict";
import {
  ANONYMOUS_PROFILE_VISITS_UNLOCK_LEVEL,
  getAnonymousProfileVisitsUnlockMessage,
  hasAnonymousProfileVisitsUnlocked,
} from "../shared/unlocks";

test("anonymous profile visits are always available", () => {
  assert.equal(ANONYMOUS_PROFILE_VISITS_UNLOCK_LEVEL, 3);
  assert.equal(hasAnonymousProfileVisitsUnlocked({ level: 0 }), true);
  assert.equal(hasAnonymousProfileVisitsUnlocked(null), true);
  assert.equal(getAnonymousProfileVisitsUnlockMessage(), "");
});
