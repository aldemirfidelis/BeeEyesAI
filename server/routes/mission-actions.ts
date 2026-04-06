import { generateMissionCelebration } from "../ai";
import { storage } from "../storage";

export function createMissionActionTrigger() {
  return async function triggerMissionAction(userId: string, actionType: string) {
    try {
      const mission = await storage.completeMissionByAction(userId, actionType);
      if (!mission) return;

      const [updatedUser, personality] = await Promise.all([
        storage.updateUserXP(userId, mission.xpReward),
        storage.getPersonality(userId),
      ]);

      if (!updatedUser || !personality) return;

      generateMissionCelebration(updatedUser, personality, mission.title, mission.xpReward)
        .then((content) => storage.createMessage({ userId, role: "assistant", content }))
        .catch(() => {});
    } catch {
      // non-critical side effect
    }
  };
}
