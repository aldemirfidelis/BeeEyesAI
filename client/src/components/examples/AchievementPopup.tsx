import { useState } from "react";
import AchievementPopup from "../AchievementPopup";
import { Button } from "@/components/ui/button";

export default function AchievementPopupExample() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setVisible(true)} data-testid="button-show-achievement">
        Mostrar Conquista
      </Button>
      <AchievementPopup
        title="Primeira MissÃ£o!"
        description="VocÃª completou sua primeira missÃ£o. Continue assim!"
        isVisible={visible}
        onClose={() => setVisible(false)}
      />
    </div>
  );
}
