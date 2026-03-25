import { useState } from "react";
import MissionCard from "../MissionCard";

export default function MissionCardExample() {
  const [completed, setCompleted] = useState(false);

  return (
    <div className="max-w-md p-4">
      <MissionCard
        id="1"
        title="Beber 8 copos de água hoje"
        description="Mantenha-se hidratado ao longo do dia"
        xpReward={20}
        completed={completed}
        onToggle={() => setCompleted(!completed)}
        onDelete={() => {}}
      />
    </div>
  );
}
