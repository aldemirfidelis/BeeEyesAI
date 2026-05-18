import { useCallback, useEffect, useState } from "react";
import { SecureStore } from "./storage";

const KEY = "bee-house-onboarded-v1";

export function useOnboarding() {
  const [shouldShow, setShouldShow] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const value = await SecureStore.getItemAsync(KEY);
        setShouldShow(!value);
      } catch {
        setShouldShow(true);
      }
      setLoaded(true);
    })();
  }, []);

  const complete = useCallback(async () => {
    setShouldShow(false);
    try { await SecureStore.setItemAsync(KEY, "1"); } catch { /* ignora */ }
  }, []);

  return { shouldShow, complete, loaded };
}
