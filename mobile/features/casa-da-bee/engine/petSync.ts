import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBeePetStore, type BeePetTarget } from "@mobile/stores/beePetStore";
import { useAuthStore } from "@mobile/stores/authStore";
import { getBeeHouseBootstrap } from "@mobile/services/beeHouseService";

const POLLING_INTERVAL_MS = 12_000; // checa a cada 12s
const STALE_TIME_MS = 8_000;
const MISS_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6h sem visita = balao de saudade
const SAUDADE_MESSAGES = [
  "Cadê você? Sinto sua falta 🥺",
  "Sua casa tá me esperando!",
  "Volte, tenho pólen acumulado pra te dar 💛",
  "Vamos brincar de novo? 🐝",
];

interface BeeHouseTaskShape {
  id: string;
  status: string;
  targetStation?: string | null;
  taskType?: string | null;
  speechText?: string | null;
  recompensa?: number;
}

function deriveTarget(task: BeeHouseTaskShape): BeePetTarget {
  const map: Record<string, BeePetTarget> = {
    fitness: "train",
    training: "train",
    calendar: "calendar",
    agenda: "calendar",
    library: "study",
    study: "study",
    bed: "sleep",
    sleep: "sleep",
    desk: "search",
    search: "search",
    research: "search",
  };
  const key = (task.targetStation ?? task.taskType ?? "").toLowerCase();
  return map[key] ?? "search";
}

/**
 * Hook global que faz polling do backend e dispara reações da Bee
 * (PetIndicator + Casa) em todas as telas onde a Bee é montada.
 *
 * Deve ser usado uma única vez no `_layout.tsx` raiz.
 */
export function useBeePetSync() {
  const isAuthenticated = useAuthStore((s) => !!s.token);
  const startTask = useBeePetStore((s) => s.startTask);
  const finishTask = useBeePetStore((s) => s.finishTask);
  const lastVisitedHouseAt = useBeePetStore((s) => s.lastVisitedHouseAt);
  const speak = useBeePetStore((s) => s.speak);
  const isWorking = useBeePetStore((s) => s.isWorking);
  const lastTaskIdRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const saudadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const query = useQuery({
    queryKey: ["bee-pet-sync"],
    queryFn: getBeeHouseBootstrap,
    enabled: isAuthenticated,
    staleTime: STALE_TIME_MS,
    refetchInterval: POLLING_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const task = query.data?.activeTask as BeeHouseTaskShape | null | undefined;
    if (!task) {
      // Sem task ativa — limpa se havia
      if (lastTaskIdRef.current) {
        lastTaskIdRef.current = null;
        lastStatusRef.current = null;
      }
      return;
    }

    const prevId = lastTaskIdRef.current;
    const prevStatus = lastStatusRef.current;
    const currentStatus = task.status;

    // Task NOVA chegou
    if (task.id !== prevId) {
      lastTaskIdRef.current = task.id;
      lastStatusRef.current = currentStatus;
      if (currentStatus === "pending" || currentStatus === "in_progress" || currentStatus === "active") {
        startTask(task.id, deriveTarget(task), task.speechText ?? null);
      }
      return;
    }

    // Task mesma, mas status mudou
    if (prevStatus !== currentStatus) {
      lastStatusRef.current = currentStatus;
      if (currentStatus === "completed") {
        finishTask(task.recompensa ?? 10);
        lastTaskIdRef.current = null;
      }
    }
  }, [query.data?.activeTask, startTask, finishTask]);

  // "Saudade" da Bee: se ha visita ha mais de 6h, ocasionalmente fala
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isWorking) return;

    function tick() {
      if (isWorking) return;
      const last = useBeePetStore.getState().lastVisitedHouseAt;
      if (last && Date.now() - last < MISS_THRESHOLD_MS) return;
      // 25% chance a cada tick (4 min)
      if (Math.random() > 0.25) return;
      const msg = SAUDADE_MESSAGES[Math.floor(Math.random() * SAUDADE_MESSAGES.length)];
      speak(msg);
    }

    saudadeTimerRef.current = setInterval(tick, 4 * 60 * 1000);
    return () => {
      if (saudadeTimerRef.current) clearInterval(saudadeTimerRef.current);
    };
  }, [isAuthenticated, isWorking, lastVisitedHouseAt, speak]);

  return query;
}
