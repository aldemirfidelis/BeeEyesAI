import test from "node:test";
import assert from "node:assert/strict";
import {
  ANONYMOUS_PROFILE_VISITS_UNLOCK_LEVEL,
  getAnonymousProfileVisitsUnlockMessage,
  hasAnonymousProfileVisitsUnlocked,
} from "../shared/unlocks";

test("anonymous profile visits unlock at level 3", () => {
  assert.equal(hasAnonymousProfileVisitsUnlocked({ level: ANONYMOUS_PROFILE_VISITS_UNLOCK_LEVEL - 1 }), false);
  assert.equal(hasAnonymousProfileVisitsUnlocked({ level: ANONYMOUS_PROFILE_VISITS_UNLOCK_LEVEL }), true);
  assert.match(getAnonymousProfileVisitsUnlockMessage(), /nível 3|nivel 3/i);
});
