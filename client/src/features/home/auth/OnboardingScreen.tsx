import { useState } from "react";
import BeeEyes from "@/components/BeeEyes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@/features/home/types";
import { apiFetch, getApiErrorMessage } from "@/features/home/shared/api";

interface OnboardingScreenProps {
  authHeaders: () => Record<string, string>;
  onComplete: (user: User) => void;
}

const OBJECTIVES = [
  { emoji: "ðŸ’°", label: "Dinheiro" },
  { emoji: "ðŸ‹ï¸", label: "Treino" },
  { emoji: "ðŸ“š", label: "Estudos" },
  { emoji: "ðŸ’¼", label: "Carreira" },
  { emoji: "â¤ï¸", label: "Relacionamentos" },
  { emoji: "ðŸ§˜", label: "Bem-estar" },
  { emoji: "ðŸš€", label: "NegÃ³cios" },
  { emoji: "ðŸŽ", label: "SaÃºde" },
  { emoji: "ðŸŽ¨", label: "Criatividade" },
  { emoji: "ðŸ ", label: "FamÃ­lia" },
  { emoji: "âœˆï¸", label: "Viagens" },
  { emoji: "ðŸŽ¯", label: "Produtividade" },
];

const WORK_PROFILES = [
  { emoji: "ðŸ‘”", label: "Empregado" },
  { emoji: "ðŸ§‘â€ðŸ’»", label: "AutÃ´nomo" },
  { emoji: "ðŸŽ“", label: "Estudante" },
  { emoji: "ðŸ ", label: "Do lar" },
  { emoji: "ðŸ”", label: "Em transiÃ§Ã£o" },
];

const ACTIVE_PERIODS = [
  { emoji: "ðŸŒ…", label: "ManhÃ£" },
  { emoji: "â˜€ï¸", label: "Tarde" },
  { emoji: "ðŸŒ™", label: "Noite" },
];

const INTERESTS = [
  { emoji: "ðŸ¤–", label: "IA" },
  { emoji: "ðŸ’¹", label: "FinanÃ§as" },
  { emoji: "ðŸƒ", label: "Fitness" },
  { emoji: "ðŸ“°", label: "NotÃ­cias" },
  { emoji: "âš¡", label: "Produtividade" },
  { emoji: "ðŸ§ ", label: "Autoconhecimento" },
  { emoji: "ðŸ’»", label: "Tecnologia" },
  { emoji: "ðŸ“–", label: "Leitura" },
  { emoji: "ðŸŽµ", label: "MÃºsica" },
  { emoji: "ðŸŽ®", label: "Games" },
  { emoji: "ðŸ•", label: "Gastronomia" },
  { emoji: "ðŸŒ¿", label: "Sustentabilidade" },
  { emoji: "ðŸŽ­", label: "Cultura" },
  { emoji: "ðŸ“±", label: "Redes Sociais" },
  { emoji: "ðŸ”¬", label: "CiÃªncia" },
  { emoji: "ðŸ˜ï¸", label: "Comunidades" },
  { emoji: "âœï¸", label: "Escrita" },
  { emoji: "ðŸ“Š", label: "Business" },
  { emoji: "ðŸ§˜", label: "MeditaÃ§Ã£o" },
  { emoji: "ðŸŽ¬", label: "Cinema" },
];

const BEE_EXPR = ["happy", "excited", "curious", "celebrating"] as const;
const TOTAL_STEPS = 3;

export function OnboardingScreen({ authHeaders, onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);
  const [workProfile, setWorkProfile] = useState("");
  const [activePeriods, setActivePeriods] = useState<string[]>([]);
  const [routine, setRoutine] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleObjective(label: string) {
    setSelectedObjectives((prev) =>
      prev.includes(label) ? prev.filter((o) => o !== label) : prev.length < 3 ? [...prev, label] : prev
    );
  }

  function togglePeriod(label: string) {
    setActivePeriods((prev) =>
      prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label]
    );
  }

  function toggleInterest(label: string) {
    setSelectedInterests((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : prev.length < 8 ? [...prev, label] : prev
    );
  }

  function handleNext() {
    setError("");
    if (step === 0) { setStep(1); return; }
    if (step === 1) {
      if (selectedObjectives.length === 0) { setError("Escolha pelo menos 1 objetivo."); return; }
      setStep(2); return;
    }
    if (step === 2) {
      if (!workProfile) { setError("Selecione seu perfil."); return; }
      if (!routine.trim()) { setError("Descreva um pouco da sua rotina."); return; }
      setStep(3); return;
    }
    if (step === 3) handleFinish();
  }

  async function handleFinish() {
    if (selectedInterests.length === 0) { setError("Escolha pelo menos 1 interesse."); return; }
    setLoading(true);
    setError("");
    try {
      const routineText = [
        workProfile ? `Perfil: ${workProfile}` : "",
        activePeriods.length > 0 ? `Mais ativo(a): ${activePeriods.join(", ")}` : "",
        routine.trim(),
      ].filter(Boolean).join(" | ");

      const updated = await apiFetch<User>("/api/me/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          objectives: selectedObjectives,
          workProfile,
          activePeriod: activePeriods,
          routine: routineText,
          interests: selectedInterests,
        }),
      });
      onComplete(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, "NÃ£o foi possÃ­vel salvar suas informaÃ§Ãµes."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-xl p-6 space-y-5 shadow-lg">

        {/* Progress bar */}
        {step > 0 && (
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-colors ${step >= s ? "bg-amber-400" : "bg-secondary"}`}
              />
            ))}
          </div>
        )}

        {/* Bee mascot */}
        <div className="flex justify-center py-2 bg-gradient-to-b from-amber-50 to-amber-100 rounded-xl">
          <BeeEyes expression={BEE_EXPR[step]} />
        </div>

        {/* Step 0 â€” Welcome */}
        {step === 0 && (
          <div className="space-y-3">
            <h1 className="text-2xl font-black">OlÃ¡! ðŸ</h1>
            <p className="text-base font-bold text-foreground">Vamos ajustar a Bee para vocÃª</p>
            <p className="text-sm text-muted-foreground">Em 3 passos rÃ¡pidos eu aprendo o que importa para vocÃª â€” seus objetivos, sua rotina e seus interesses.</p>
            <div className="space-y-2 pt-1">
              {[
                { emoji: "ðŸŽ¯", text: "MissÃµes personalizadas para seus objetivos" },
                { emoji: "ðŸ’¬", text: "Conversas que fazem sentido para vocÃª" },
                { emoji: "âš¡", text: "Alertas e dicas alinhados Ã  sua rotina" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-sm text-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 â€” Objectives */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passo 1 de 3</p>
            <h2 className="text-xl font-black">Quais seus principais objetivos?</h2>
            <p className="text-sm text-muted-foreground">Escolha atÃ© 3 que mais representam o que vocÃª quer conquistar agora.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {OBJECTIVES.map((item) => {
                const active = selectedObjectives.includes(item.label);
                const disabled = !active && selectedObjectives.length >= 3;
                return (
                  <button
                    key={item.label}
                    onClick={() => toggleObjective(item.label)}
                    disabled={disabled}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all
                      ${active ? "border-amber-500 bg-amber-50 text-amber-800" : "border-border bg-card text-foreground"}
                      ${disabled ? "opacity-40 cursor-not-allowed" : "hover:border-amber-300 cursor-pointer"}`}
                  >
                    <span>{item.emoji}</span>
                    <span>{item.label}</span>
                    {active && <span className="text-amber-600">âœ“</span>}
                  </button>
                );
              })}
            </div>
            {selectedObjectives.length > 0 && (
              <p className="text-xs font-bold text-amber-700">Selecionados: {selectedObjectives.join(", ")}</p>
            )}
          </div>
        )}

        {/* Step 2 â€” Routine */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passo 2 de 3</p>
            <h2 className="text-xl font-black">Como Ã© a sua rotina?</h2>

            <div className="space-y-2">
              <p className="text-sm font-bold text-foreground">Seu perfil</p>
              <div className="flex flex-wrap gap-2">
                {WORK_PROFILES.map((item) => {
                  const active = workProfile === item.label;
                  return (
                    <button
                      key={item.label}
                      onClick={() => setWorkProfile(active ? "" : item.label)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-full border-2 text-sm font-bold transition-all
                        ${active ? "border-amber-500 bg-amber-50 text-amber-800" : "border-border bg-card text-foreground hover:border-amber-300"}`}
                    >
                      <span>{item.emoji}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-foreground">Quando vocÃª Ã© mais ativo(a)?</p>
              <div className="flex flex-wrap gap-2">
                {ACTIVE_PERIODS.map((item) => {
                  const active = activePeriods.includes(item.label);
                  return (
                    <button
                      key={item.label}
                      onClick={() => togglePeriod(item.label)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-full border-2 text-sm font-bold transition-all
                        ${active ? "border-amber-500 bg-amber-50 text-amber-800" : "border-border bg-card text-foreground hover:border-amber-300"}`}
                    >
                      <span>{item.emoji}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-bold text-foreground">Descreva seu dia a dia</p>
              <Textarea
                value={routine}
                onChange={(e) => setRoutine(e.target.value)}
                placeholder="Ex.: trabalho de manhÃ£ em home office, estudo Ã  noite, treino 3x por semana..."
                className="min-h-[90px]"
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground text-right">{routine.length}/300</p>
            </div>
          </div>
        )}

        {/* Step 3 â€” Interests */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passo 3 de 3</p>
            <h2 className="text-xl font-black">O que te interessa?</h2>
            <p className="text-sm text-muted-foreground">Escolha atÃ© 8 temas.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {INTERESTS.map((item) => {
                const active = selectedInterests.includes(item.label);
                const disabled = !active && selectedInterests.length >= 8;
                return (
                  <button
                    key={item.label}
                    onClick={() => toggleInterest(item.label)}
                    disabled={disabled}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full border-2 text-sm font-bold transition-all
                      ${active ? "border-amber-500 bg-amber-50 text-amber-800" : "border-border bg-card text-foreground"}
                      ${disabled ? "opacity-40 cursor-not-allowed" : "hover:border-amber-300 cursor-pointer"}`}
                  >
                    <span>{item.emoji}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-bold text-amber-700">{selectedInterests.length}/8 selecionados</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-1">
          {step > 0 && (
            <Button variant="outline" onClick={() => { setError(""); setStep(step - 1); }} className="px-5">
              â† Voltar
            </Button>
          )}
          <Button
            className="flex-1 bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold"
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? "Salvando..." : step === 0 ? "Vamos comeÃ§ar! ðŸ" : step === TOTAL_STEPS ? "Entrar no BeeEyes ðŸš€" : "PrÃ³ximo â†’"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
