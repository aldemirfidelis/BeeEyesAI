import { useCallback, useRef, useState } from "react";

const COMBO_WINDOW_MS = 5000;

export function useCombo() {
  const [count, setCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setCount(0);
  }, []);

  const trigger = useCallback((): number => {
    setCount((prev) => {
      const next = prev + 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { timerRef.current = null; setCount(0); }, COMBO_WINDOW_MS);
      return next;
    });
    return count + 1 >= 3 ? 2 : count + 1 === 2 ? 1.5 : 1;
  }, [count]);

  return { count, reset, trigger };
}
