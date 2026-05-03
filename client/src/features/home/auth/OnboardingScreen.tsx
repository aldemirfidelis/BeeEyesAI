import { useState } from "react";
import BeeEyes from "@/components/BeeEyes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@/features/home/types";
import { apiFetch, getApiErrorMessage } from "@/features/home/shared/api";

interface OnboardingScreenProps {
  authHeaders: () => Record<string, string>;
  onComplete: (user: User) => void;
}

export function OnboardingScreen({ authHeaders, onComplete }: OnboardingScreenProps) {
  const [objective, setObjective] = useState("");
  const [routine, setRoutine] = useState("");
  const [interests, setInterests] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!objective.trim() || !routine.trim() || !interests.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const updated = await apiFetch<User>("/api/me/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ objective: objective.trim(), routine: routine.trim(), interests: interests.trim() }),
      });
      onComplete(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, "Nao foi possivel salvar suas informacoes agora."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-5 space-y-5">
        <div className="flex items-center gap-3">
          <BeeEyes expression="happy" />
          <div>
            <h1 className="text-xl font-black">Antes de entrar</h1>
            <p className="text-sm text-muted-foreground">Esses dados ajudam a Bee a conversar melhor com voce.</p>
          </div>
        </div>
        <div className="space-y-3">
          <Input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Objetivo: dinheiro, treino, estudo..." />
          <Textarea value={routine} onChange={(event) => setRoutine(event.target.value)} placeholder="Como e sua rotina hoje?" className="min-h-[88px]" />
          <Textarea value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Interesses, assuntos e areas que voce gosta" className="min-h-[88px]" />
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={!objective.trim() || !routine.trim() || !interests.trim() || loading} onClick={submit}>
          {loading ? "Salvando..." : "Continuar"}
        </Button>
      </Card>
    </div>
  );
}
