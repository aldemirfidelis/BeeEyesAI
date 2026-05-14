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
        title="Primeiro check-in!"
        description="Você registrou seu primeiro avanço. Continue assim!"
        isVisible={visible}
        onClose={() => setVisible(false)}
      />
    </div>
  );
}
