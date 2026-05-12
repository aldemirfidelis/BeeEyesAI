import { useState } from "react";
import { useLocation } from "wouter";
import BeeEyes from "@/components/BeeEyes";
import { Input } from "@/components/ui/input";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "Nao foi possivel redefinir a senha.");
        return;
      }
      setMessage("Senha redefinida com sucesso. Voce ja pode entrar.");
      setTimeout(() => navigate("/"), 900);
    } catch {
      setMessage("Erro de conexao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bee-app-shell flex min-h-[100dvh] items-center justify-center bg-background px-5">
      <div className="bee-surface w-full max-w-[420px] rounded-2xl p-6 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <BeeEyes expression="curious" />
        </div>
        <h1 className="font-display text-2xl font-black text-foreground">Redefinir senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">Crie uma nova senha para acessar sua Bee.</p>
        <div className="mt-5 text-left">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nova senha</label>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="minimo 8 caracteres, letra e numero"
            className="h-12 rounded-lg"
          />
        </div>
        {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !token || !password}
          className="mt-5 w-full rounded-lg py-4 font-black text-gray-900 shadow-lg shadow-yellow-200/50 disabled:opacity-60"
          style={{ background: "linear-gradient(90deg, #FFD700, #F5C842, #E8B800)" }}
        >
          {loading ? "Aguarde..." : "Redefinir senha"}
        </button>
      </div>
    </div>
  );
}
