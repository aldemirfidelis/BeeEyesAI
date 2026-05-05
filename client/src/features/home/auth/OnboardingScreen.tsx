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
  { emoji: "💰", label: "Dinheiro" },
  { emoji: "🏋️", label: "Treino" },
  { emoji: "📚", label: "Estudos" },
  { emoji: "💼", label: "Carreira" },
  { emoji: "❤️", label: "Relacionamentos" },
  { emoji: "🧘", label: "Bem-estar" },
  { emoji: "🚀", label: "Negócios" },
  { emoji: "🍎", label: "Saúde" },
  { emoji: "🎨", label: "Criatividade" },
  { emoji: "🏠", label: "Família" },
  { emoji: "✈️", label: "Viagens" },
  { emoji: "🎯", label: "Produtividade" },
];

const WORK_PROFILES = [
  { emoji: "👔", label: "Empregado" },
  { emoji: "🧑‍💻", label: "Autônomo" },
  { emoji: "🎓", label: "Estudante" },
  { emoji: "🏠", label: "Do lar" },
  { emoji: "🔍", label: "Em transição" },
];

const ACTIVE_PERIODS = [
  { emoji: "🌅", label: "Manhã" },
  { emoji: "☀️", label: "Tarde" },
  { emoji: "🌙", label: "Noite" },
];

const INTERESTS = [
  { emoji: "🤖", label: "IA" },
  { emoji: "💹", label: "Finanças" },
  { emoji: "🏃", label: "Fitness" },
  { emoji: "📰", label: "Notícias" },
  { emoji: "⚡", label: "Produtividade" },
  { emoji: "🧠", label: "Autoconhecimento" },
  { emoji: "💻", label: "Tecnologia" },
  { emoji: "📖", label: "Leitura" },
  { emoji: "🎵", label: "Música" },
  { emoji: "🎮", label: "Games" },
  { emoji: "🍕", label: "Gastronomia" },
  { emoji: "🌿", label: "Sustentabilidade" },
  { emoji: "🎭", label: "Cultura" },
  { emoji: "📱", label: "Redes Sociais" },
  { emoji: "🔬", label: "Ciência" },
  { emoji: "🏘️", label: "Comunidades" },
  { emoji: "✍️", label: "Escrita" },
  { emoji: "📊", label: "Business" },
  { emoji: "🧘", label: "Meditação" },
  { emoji: "🎬", label: "Cinema" },
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
      setError(getApiErrorMessage(err, "Não foi possível salvar suas informações."));
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

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div className="space-y-3">
            <h1 className="text-2xl font-black">Olá! 🐝</h1>
            <p className="text-base font-bold text-foreground">Vamos ajustar a Bee para você</p>
            <p className="text-sm text-muted-foreground">Em 3 passos rápidos eu aprendo o que importa para você — seus objetivos, sua rotina e seus interesses.</p>
            <div className="space-y-2 pt-1">
              {[
                { emoji: "🎯", text: "Missões personalizadas para seus objetivos" },
                { emoji: "💬", text: "Conversas que fazem sentido para você" },
                { emoji: "⚡", text: "Alertas e dicas alinhados à sua rotina" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-sm text-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 — Objectives */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passo 1 de 3</p>
            <h2 className="text-xl font-black">Quais seus principais objetivos?</h2>
            <p className="text-sm text-muted-foreground">Escolha até 3 que mais representam o que você quer conquistar agora.</p>
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
                    {active && <span className="text-amber-600">✓</span>}
                  </button>
                );
              })}
            </div>
            {selectedObjectives.length > 0 && (
              <p className="text-xs font-bold text-amber-700">Selecionados: {selectedObjectives.join(", ")}</p>
            )}
          </div>
        )}

        {/* Step 2 — Routine */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passo 2 de 3</p>
            <h2 className="text-xl font-black">Como é a sua rotina?</h2>

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
              <p className="text-sm font-bold text-foreground">Quando você é mais ativo(a)?</p>
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
                placeholder="Ex.: trabalho de manhã em home office, estudo à noite, treino 3x por semana..."
                className="min-h-[90px]"
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground text-right">{routine.length}/300</p>
            </div>
          </div>
        )}

        {/* Step 3 — Interests */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passo 3 de 3</p>
            <h2 className="text-xl font-black">O que te interessa?</h2>
            <p className="text-sm text-muted-foreground">Escolha até 8 temas.</p>
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
              ← Voltar
            </Button>
          )}
          <Button
            className="flex-1 bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold"
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? "Salvando..." : step === 0 ? "Vamos começar! 🐝" : step === TOTAL_STEPS ? "Entrar no BeeEyes 🚀" : "Próximo →"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
