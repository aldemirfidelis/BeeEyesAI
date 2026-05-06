import { Check, ChevronRight, Flame, UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/UserAvatar";
import type { Friend, SearchUser, User } from "@/features/home/types";

interface FriendsPanelProps {
  user: User | null;
  friends: Friend[];
  friendsLoading: boolean;
  friendSearch: string;
  searchResults: SearchUser[];
  searchLoading: boolean;
  searchConnecting: Set<string>;
  onFriendSearchChange: (value: string) => void;
  onOpenFriendProfile: (friendId: string) => void;
  onSearchConnect: (targetUserId: string) => void;
  onCancelRequest: (targetUserId: string) => void;
  onRemoveFriend: (friendId: string) => void;
  removingFriendIds: Set<string>;
  incomingRequests: { connectionId: string; user: { id: string; username: string; displayName: string | null; level: number; avatarUrl?: string | null } }[];
  sentRequests: { connectionId: string; user: { id: string; username: string; displayName: string | null; level: number; avatarUrl?: string | null } }[];
  onAcceptRequest: (connectionId: string) => void;
  onRejectRequest: (connectionId: string) => void;
  processingRequestIds: Set<string>;
  onOpenDMWithUser: (target: { id: string; username: string; displayName: string | null; level: number; avatarUrl?: string | null }) => void;
  timeAgo: (value: string | Date) => string;
}

export function FriendsPanel(props: FriendsPanelProps) {
  const {
    friends,
    friendsLoading,
    friendSearch,
    searchResults,
    searchLoading,
    searchConnecting,
    onFriendSearchChange,
    onOpenFriendProfile,
    onSearchConnect,
    onCancelRequest,
    onRemoveFriend,
    removingFriendIds,
    incomingRequests,
    sentRequests,
    onAcceptRequest,
    onRejectRequest,
    processingRequestIds,
    onOpenDMWithUser,
    timeAgo,
  } = props;

  return (
    <div className="space-y-3 p-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Amigos</h2>
        <p className="text-xs text-muted-foreground mt-1">Descoberta, conexão e acesso rápido a conversas e perfis.</p>
      </div>

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx={11} cy={11} r={8} />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Buscar pessoas no BeeEyes..."
          value={friendSearch}
          onChange={(event) => onFriendSearchChange(event.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          data-testid="friends-search-input"
        />
        {searchLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
      </div>

      {friendSearch.trim() && (
        <div className="space-y-2">
          {searchResults.length === 0 && !searchLoading && <p className="text-xs text-muted-foreground text-center py-3">Nenhum usuário encontrado.</p>}
          {searchResults.map((result) => {
            const name = result.displayName || result.username;
            return (
              <Card key={result.id} className="p-3">
                <div className="flex items-center gap-3">
                  <button className="flex-1 flex items-center gap-3 text-left" onClick={() => onOpenFriendProfile(result.id)}>
                    <UserAvatar name={name} avatarUrl={result.avatarUrl} className="w-9 h-9" fallbackClassName="bg-primary text-primary-foreground" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">{name}</span>
                        <span className="text-xs text-muted-foreground bg-secondary rounded px-1 shrink-0">Nv {result.level}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">@{result.username}</span>
                    </div>
                  </button>
                  {result.connectionStatus === "accepted" ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-green-600 font-semibold">Amigos</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        onClick={() => onOpenDMWithUser({ id: result.id, username: result.username, displayName: result.displayName, level: result.level, avatarUrl: result.avatarUrl })}
                      >
                        Enviar mensagem
                      </Button>
                    </div>
                  ) : result.connectionStatus === "pending" ? (
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2 shrink-0 border-red-300 text-red-600 hover:bg-red-50" onClick={() => onCancelRequest(result.id)} disabled={searchConnecting.has(result.id)}>
                      <X className="w-3 h-3 mr-1" />
                      Cancelar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2 shrink-0" onClick={() => onSearchConnect(result.id)} disabled={searchConnecting.has(result.id)}>
                      <UserPlus className="w-3 h-3 mr-1" />
                      Conectar
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!friendSearch.trim() && (
        <>
          {/* Solicitações recebidas */}
          {incomingRequests.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary">🔔 SOLICITAÇÕES RECEBIDAS ({incomingRequests.length})</p>
              {incomingRequests.map(({ connectionId, user }) => {
                const name = user.displayName || user.username;
                const busy = processingRequestIds.has(connectionId);
                return (
                  <div key={connectionId} className="flex items-center gap-3">
                    <UserAvatar name={name} avatarUrl={user.avatarUrl} className="w-9 h-9" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                    <Button size="sm" className="h-8 px-2 bg-green-500 hover:bg-green-600 text-white shrink-0" disabled={busy} onClick={() => onAcceptRequest(connectionId)}>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Aceitar
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 px-2 shrink-0 border-red-300 text-red-600 hover:bg-red-50" disabled={busy} onClick={() => onRejectRequest(connectionId)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Solicitações enviadas */}
          {sentRequests.length > 0 && (
            <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">⏳ SOLICITAÇÕES ENVIADAS ({sentRequests.length})</p>
              {sentRequests.map(({ connectionId: _, user }) => {
                const name = user.displayName || user.username;
                return (
                  <div key={user.id} className="flex items-center gap-3">
                    <UserAvatar name={name} avatarUrl={user.avatarUrl} className="w-9 h-9" fallbackClassName="bg-secondary text-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 px-2 shrink-0 border-red-300 text-red-600 hover:bg-red-50 text-xs" disabled={searchConnecting.has(user.id)} onClick={() => onCancelRequest(user.id)}>
                      Cancelar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {friendsLoading && <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>}
          {!friendsLoading && friends.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <p className="text-3xl">👥</p>
              <p className="text-sm font-semibold">Nenhum amigo ainda</p>
              <p className="text-xs text-muted-foreground">Use a busca para encontrar pessoas com afinidade real.</p>
            </div>
          )}
          {friends.map((friend) => {
            const name = friend.displayName || friend.username;
            const interests: string[] = (() => {
              try {
                return JSON.parse(friend.personality?.interests || "[]");
              } catch {
                return [];
              }
            })();
            const lastActive = friend.lastActiveAt ? timeAgo(friend.lastActiveAt) : null;

            return (
              <Card key={friend.id} className="p-3 hover:border-primary/50 transition-colors group">
                <div className="w-full text-left cursor-pointer" onClick={() => onOpenFriendProfile(friend.id)}>
                  <div className="flex items-center gap-3">
                    <UserAvatar name={name} avatarUrl={friend.avatarUrl} className="w-10 h-10" fallbackClassName="bg-primary text-primary-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{name}</span>
                        <span className="text-xs text-muted-foreground bg-secondary rounded px-1">Nv {friend.level}</span>
                        {friend.currentStreak > 0 && (
                          <span className="text-xs text-orange-500 flex items-center gap-0.5">
                            <Flame className="w-3 h-3" />
                            {friend.currentStreak}d
                          </span>
                        )}
                      </div>
                      {interests.length > 0 && <p className="text-xs text-muted-foreground truncate">{interests.slice(0, 3).join(" · ")}</p>}
                      {lastActive && <p className="text-xs text-muted-foreground">Ativo {lastActive}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </div>
                <div className="mt-3 flex justify-between items-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={removingFriendIds.has(friend.id)}
                    onClick={() => onRemoveFriend(friend.id)}
                  >
                    <UserMinus className="w-3.5 h-3.5 mr-1" />
                    {removingFriendIds.has(friend.id) ? "Removendo..." : "Remover amigo"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 px-3"
                    onClick={() => onOpenDMWithUser({ id: friend.id, username: friend.username, displayName: friend.displayName, level: friend.level, avatarUrl: friend.avatarUrl })}
                  >
                    Enviar mensagem
                  </Button>
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
