import { useState } from "react";
import MoodSelector from "../MoodSelector";

export default function MoodSelectorExample() {
  const [mood, setMood] = useState<number | null>(null);

  return (
    <div className="p-8">
      <MoodSelector selectedMood={mood} onSelectMood={setMood} />
      {mood && (
        <p className="text-center mt-4 text-sm text-muted-foreground">
          Humor selecionado: {mood}
        </p>
      )}
    </div>
  );
}
