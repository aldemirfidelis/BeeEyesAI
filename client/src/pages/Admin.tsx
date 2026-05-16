import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users, MessageSquare, FileText, Calendar, DollarSign, TrendingUp,
  Activity, Award, Heart, Globe, Zap, Shield, RefreshCw,
  ChevronRight, Clock, BarChart2, UserCheck, Flame,
} from "lucide-react";

// ── Auth ──────────────────────────────────────────────────────────────────────
// Migrado para cookie httpOnly (setado pelo backend após /api/auth/login).
// Limpa qualquer token legacy do localStorage no carregamento.
try { localStorage.removeItem("bee_token"); } catch { /* SSR */ }

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function adminLogin(username: string, password: string): Promise<boolean> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  return res.ok;
}

async function adminLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Dashboard {
  users: { total: number; newToday: number; newThisWeek: number; newThisMonth: number; active24h: number; active7d: number; active30d: number; onboarded: number; onboardingRate: number; retentionRate: number };
  messages: { total: number; today: number; thisWeek: number; avgPerUser: number };
  content: { posts: number; communities: number; connections: number; achievements: number; moods: number };
  colmeia: { notes: number; events: number; transactions: number };
}
interface GrowthRow { day: string; count: number }
interface StreakRow { label: string; value: number }
interface HeatRow { hour: number; count: number }
interface TopUser { id: string; username: string; displayName: string | null; totalMessages: number; currentStreak: number; longestStreak: number; lastActiveAt: string; createdAt: string }
interface RecentUser { id: string; username: string; displayName: string | null; createdAt: string; lastActiveAt: string; onboardingCompleted: boolean; totalMessagesCount: number }
interface AdminUser { id: string; username: string; displayName: string | null; createdAt: string; lastActiveAt: string; totalMessagesCount: number; currentStreak: number; onboardingCompleted: boolean; isAdmin: boolean }

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString("pt-BR"); }

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = "text-primary" }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl bg-muted/60 shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{typeof value === "number" ? fmt(value) : value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MiniBar({ value, max, color = "bg-primary" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Bar chart from array of {day, count}
function BarChart({ data, color = "#F5C842" }: { data: GrowthRow[]; color?: string }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-20 w-full">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${d.day}: ${d.count}`}>
          <div className="w-full rounded-t-sm min-h-[2px]" style={{ height: `${Math.max((d.count / max) * 100, 3)}%`, backgroundColor: color }} />
        </div>
      ))}
    </div>
  );
}

// Heatmap bar (24h)
function HeatmapBar({ data }: { data: HeatRow[] }) {
  const map = Object.fromEntries(data.map(d => [d.hour, d.count]));
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex gap-0.5 items-end h-12">
      {Array.from({ length: 24 }, (_, h) => {
        const v = map[h] ?? 0;
        const pct = Math.max((v / max) * 100, 4);
        return (
          <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={`${h}h: ${v} msgs`}>
            <div className="w-full rounded-t-sm" style={{ height: `${pct}%`, backgroundColor: `rgba(245,200,66,${0.2 + (v / max) * 0.8})` }} />
          </div>
        );
      })}
    </div>
  );
}

// ── Login gate ────────────────────────────────────────────────────────────────

function LoginGate({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const ok = await adminLogin(username.trim(), password);
      if (ok) {
        onLogin();
      } else {
        setError("Usuário ou senha incorretos.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm space-y-4 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🍯</span>
          <div>
            <h1 className="font-bold text-lg">BeeEyes Admin</h1>
            <p className="text-xs text-muted-foreground">Acesso restrito</p>
          </div>
        </div>
        <input
          type="text"
          placeholder="Usuário ou e-mail"
          autoComplete="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="password"
          placeholder="Senha"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button
          onClick={submit}
          disabled={submitting || !username.trim() || !password}
          className="w-full py-3 rounded-xl bg-primary font-bold text-sm text-foreground disabled:opacity-40"
        >
          {submitting ? "Entrando..." : "Entrar no painel"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<"overview" | "users" | "content">("overview");
  const [userPage, setUserPage] = useState(0);
  const [searchUser, setSearchUser] = useState("");

  // Detecta sessão existente via cookie no mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setAuthed(true);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  const refetchOpts = { refetchInterval: 60_000 };

  const { data: dash, isLoading: dashLoading, refetch: refetchDash, error: dashError } =
    useQuery<Dashboard>({ queryKey: ["admin-dashboard"], queryFn: () => apiFetch("/api/admin/dashboard"), enabled: authed, ...refetchOpts });

  const { data: growth = [] } = useQuery<GrowthRow[]>({ queryKey: ["admin-growth"], queryFn: () => apiFetch("/api/admin/growth"), enabled: authed && tab === "overview" });
  const { data: dau = [] }    = useQuery<GrowthRow[]>({ queryKey: ["admin-dau"],    queryFn: () => apiFetch("/api/admin/dau"),    enabled: authed && tab === "overview" });
  const { data: streaks = [] } = useQuery<StreakRow[]>({ queryKey: ["admin-streaks"], queryFn: () => apiFetch("/api/admin/streaks"), enabled: authed && tab === "overview" });
  const { data: heatmap = [] } = useQuery<HeatRow[]>({ queryKey: ["admin-heatmap"], queryFn: () => apiFetch("/api/admin/heatmap"), enabled: authed && tab === "overview" });
  const { data: topUsers = [] } = useQuery<TopUser[]>({ queryKey: ["admin-top-users"], queryFn: () => apiFetch("/api/admin/top-users"), enabled: authed && tab === "overview" });
  const { data: recentUsers = [] } = useQuery<RecentUser[]>({ queryKey: ["admin-recent-users"], queryFn: () => apiFetch("/api/admin/recent-users"), enabled: authed && tab === "overview" });
  const { data: usersPage, refetch: refetchUsers } = useQuery<{ users: AdminUser[]; total: number }>({
    queryKey: ["admin-users", userPage],
    queryFn: () => apiFetch(`/api/admin/users?page=${userPage}`),
    enabled: authed && tab === "users",
  });

  const toggleAdmin = useCallback(async (id: string) => {
    await fetch(`/api/admin/users/${id}/toggle-admin`, { method: "PATCH", credentials: "include" });
    refetchUsers();
  }, [refetchUsers]);

  const logout = useCallback(async () => {
    await adminLogout();
    setAuthed(false);
  }, []);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />;

  if (dashError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-destructive mx-auto" />
          <p className="font-bold text-lg">Acesso negado</p>
          <p className="text-sm text-muted-foreground">Sua conta não tem permissão de administrador.</p>
          <button onClick={logout} className="text-xs text-muted-foreground underline">Sair</button>
        </div>
      </div>
    );
  }

  const filteredUsers = (usersPage?.users ?? []).filter(u =>
    !searchUser || u.username.toLowerCase().includes(searchUser.toLowerCase()) || (u.displayName ?? "").toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍯</span>
          <div>
            <h1 className="font-bold text-base leading-tight">BeeEyes Admin</h1>
            <p className="text-[10px] text-muted-foreground">Painel de controle</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetchDash()} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={logout} className="text-xs text-muted-foreground hover:text-destructive">Sair</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 pb-0">
        {(["overview", "users", "content"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-t-xl text-sm font-semibold border-b-2 transition-colors ${tab === t ? "border-primary text-primary bg-card" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "overview" ? "Visão Geral" : t === "users" ? "Usuários" : "Conteúdo"}
          </button>
        ))}
      </div>
      <div className="h-px bg-border mb-6" />

      <main className="px-6 pb-12 space-y-8 max-w-7xl mx-auto">

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {tab === "overview" && (
          <>
            {dashLoading ? (
              <div className="text-center py-20 text-muted-foreground">Carregando métricas...</div>
            ) : dash && (
              <>
                {/* KPIs row 1 — Users */}
                <section>
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Usuários</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard icon={Users}     label="Total"          value={dash.users.total}       color="text-blue-500" />
                    <StatCard icon={TrendingUp} label="Hoje"           value={dash.users.newToday}    sub={`+${dash.users.newThisWeek} esta semana`} color="text-green-500" />
                    <StatCard icon={Activity}   label="Ativos 24h"     value={dash.users.active24h}   sub={`${dash.users.total > 0 ? Math.round(dash.users.active24h/dash.users.total*100) : 0}% do total`} color="text-yellow-500" />
                    <StatCard icon={Activity}   label="Ativos 7 dias"  value={dash.users.active7d}    color="text-orange-500" />
                    <StatCard icon={UserCheck}  label="Onboarding"     value={`${dash.users.onboardingRate}%`} sub={`${dash.users.onboarded} concluídos`} color="text-purple-500" />
                  </div>
                </section>

                {/* KPIs row 2 — Engagement */}
                <section>
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Engajamento</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <StatCard icon={MessageSquare} label="Msgs total"    value={dash.messages.total}      color="text-blue-400" />
                    <StatCard icon={MessageSquare} label="Msgs hoje"     value={dash.messages.today}      sub={`${dash.messages.thisWeek} esta semana`} color="text-teal-500" />
                    <StatCard icon={BarChart2}     label="Média msgs/user" value={dash.messages.avgPerUser} color="text-indigo-500" />
                    <StatCard icon={Zap}           label="Retenção 7d"   value={`${dash.users.retentionRate}%`} sub="usuários com atividade recente" color="text-amber-500" />
                  </div>
                </section>

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* User growth */}
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <p className="text-sm font-semibold mb-1">Novos usuários — últimos 30 dias</p>
                    <p className="text-xs text-muted-foreground mb-4">+{dash.users.newThisMonth} no período</p>
                    {growth.length > 0 ? <BarChart data={growth} color="#3B82F6" /> : <p className="text-xs text-muted-foreground py-6 text-center">Sem dados suficientes</p>}
                  </div>

                  {/* DAU */}
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <p className="text-sm font-semibold mb-1">Mensagens diárias (DAU proxy)</p>
                    <p className="text-xs text-muted-foreground mb-4">Usuários que enviaram ao menos 1 msg</p>
                    {dau.length > 0 ? <BarChart data={dau} color="#F5C842" /> : <p className="text-xs text-muted-foreground py-6 text-center">Sem dados suficientes</p>}
                  </div>
                </div>

                {/* Heatmap + Streaks */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Heatmap */}
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <p className="text-sm font-semibold mb-1">Horários de pico — últimos 7 dias</p>
                    <p className="text-xs text-muted-foreground mb-4">Distribuição de mensagens por hora do dia</p>
                    {heatmap.length > 0 ? (
                      <>
                        <HeatmapBar data={heatmap} />
                        <div className="flex justify-between mt-1">
                          {[0,4,8,12,16,20,23].map(h => <span key={h} className="text-[9px] text-muted-foreground">{h}h</span>)}
                        </div>
                      </>
                    ) : <p className="text-xs text-muted-foreground py-6 text-center">Sem dados suficientes</p>}
                  </div>

                  {/* Streak distribution */}
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <p className="text-sm font-semibold mb-4">Distribuição de streaks</p>
                    <div className="space-y-3">
                      {streaks.map(s => (
                        <div key={s.label} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-20 shrink-0">{s.label}</span>
                          <MiniBar value={s.value} max={Math.max(...streaks.map(x => x.value), 1)} color="bg-amber-400" />
                          <span className="text-xs font-bold w-8 text-right">{fmt(s.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Colmeia metrics */}
                <section>
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Colmeia</h2>
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard icon={FileText}  label="Notas"       value={dash.colmeia.notes}        color="text-yellow-500" />
                    <StatCard icon={Calendar}  label="Eventos"     value={dash.colmeia.events}       color="text-blue-500" />
                    <StatCard icon={DollarSign} label="Transações" value={dash.colmeia.transactions} color="text-green-500" />
                  </div>
                </section>

                {/* Social content */}
                <section>
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Conteúdo social</h2>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    <StatCard icon={Globe}         label="Posts"        value={dash.content.posts}        color="text-sky-500" />
                    <StatCard icon={Users}          label="Comunidades"  value={dash.content.communities}  color="text-violet-500" />
                    <StatCard icon={ChevronRight}   label="Conexões"     value={dash.content.connections}  color="text-pink-500" />
                    <StatCard icon={Award}          label="Conquistas"   value={dash.content.achievements} color="text-amber-500" />
                    <StatCard icon={Heart}          label="Humores"      value={dash.content.moods}        color="text-red-500" />
                  </div>
                </section>

                {/* Top users + Recent */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <p className="text-sm font-semibold mb-4 flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> Top usuários por mensagens</p>
                    <div className="space-y-2">
                      {topUsers.slice(0, 10).map((u, i) => (
                        <div key={u.id} className="flex items-center gap-3 py-1.5">
                          <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{u.displayName || u.username}</p>
                            <p className="text-[10px] text-muted-foreground">@{u.username} · streak {u.currentStreak}d · ativo {timeAgo(u.lastActiveAt)}</p>
                          </div>
                          <span className="text-xs font-bold text-primary shrink-0">{fmt(u.totalMessages)} msgs</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5">
                    <p className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" /> Cadastros recentes</p>
                    <div className="space-y-2">
                      {recentUsers.map(u => (
                        <div key={u.id} className="flex items-center gap-3 py-1.5">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${u.onboardingCompleted ? "bg-green-400" : "bg-yellow-400"}`} title={u.onboardingCompleted ? "Onboarding completo" : "Sem onboarding"} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{u.displayName || u.username}</p>
                            <p className="text-[10px] text-muted-foreground">@{u.username} · {u.totalMessagesCount} msgs</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(u.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── USERS TAB ────────────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                placeholder="Buscar por username ou nome..."
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {usersPage && <span className="text-xs text-muted-foreground shrink-0">{fmt(usersPage.total)} usuários</span>}
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Usuário</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Msgs</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase hidden sm:table-cell">Streak</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase hidden md:table-cell">Último acesso</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase hidden md:table-cell">Cadastro</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${u.onboardingCompleted ? "bg-green-400" : "bg-muted"}`} />
                          <div>
                            <p className="font-semibold">{u.displayName || u.username}</p>
                            <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{fmt(u.totalMessagesCount)}</td>
                      <td className="px-4 py-3 text-right text-xs hidden sm:table-cell">{u.currentStreak}d</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{timeAgo(u.lastActiveAt)}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleAdmin(u.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${u.isAdmin ? "bg-primary text-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        >
                          {u.isAdmin ? "✓ Admin" : "—"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {usersPage && usersPage.total > 50 && (
              <div className="flex items-center justify-between">
                <button onClick={() => setUserPage(p => Math.max(0, p - 1))} disabled={userPage === 0} className="px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-40 hover:bg-muted">Anterior</button>
                <span className="text-xs text-muted-foreground">Página {userPage + 1} de {Math.ceil(usersPage.total / 50)}</span>
                <button onClick={() => setUserPage(p => p + 1)} disabled={(userPage + 1) * 50 >= usersPage.total} className="px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-40 hover:bg-muted">Próxima</button>
              </div>
            )}
          </div>
        )}

        {/* ── CONTENT TAB ──────────────────────────────────────────────── */}
        {tab === "content" && dash && (
          <div className="space-y-6">
            <section>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Resumo de conteúdo</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard icon={MessageSquare} label="Total de mensagens" value={dash.messages.total} sub={`${dash.messages.avgPerUser} por usuário em média`} color="text-blue-500" />
                <StatCard icon={Globe}    label="Posts no feed"    value={dash.content.posts}        color="text-sky-500" />
                <StatCard icon={Users}    label="Comunidades"      value={dash.content.communities}  color="text-violet-500" />
                <StatCard icon={ChevronRight} label="Amizades"     value={dash.content.connections}  color="text-pink-500" />
                <StatCard icon={Award}    label="Conquistas"       value={dash.content.achievements} color="text-amber-500" />
                <StatCard icon={Heart}    label="Entradas de humor" value={dash.content.moods}       color="text-red-500" />
                <StatCard icon={FileText} label="Notas (Colmeia)"  value={dash.colmeia.notes}        color="text-yellow-500" />
                <StatCard icon={Calendar} label="Eventos (Colmeia)" value={dash.colmeia.events}      color="text-blue-400" />
                <StatCard icon={DollarSign} label="Transações financeiras" value={dash.colmeia.transactions} color="text-green-500" />
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm font-semibold mb-4">Saúde da plataforma</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-xl bg-muted/30">
                  <p className="text-3xl font-bold text-green-500">{dash.users.retentionRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Retenção 7 dias</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-muted/30">
                  <p className="text-3xl font-bold text-blue-500">{dash.users.onboardingRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Taxa de onboarding</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-muted/30">
                  <p className="text-3xl font-bold text-amber-500">{dash.messages.avgPerUser}</p>
                  <p className="text-xs text-muted-foreground mt-1">Msgs médias por usuário</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
