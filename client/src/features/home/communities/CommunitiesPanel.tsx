import { Plus, Send, X } from "lucide-react";
import CommunityPostCard from "@/components/CommunityPostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Community, CommunityPost } from "@/features/home/types";

interface CommunitiesPanelProps {
  communities: Community[];
  communitiesLoading: boolean;
  communitySearch: string;
  selectedCommunity: (Community & { isMember: boolean; memberRole?: string }) | null;
  communityPosts: CommunityPost[];
  communityPostsLoading: boolean;
  communityPostInput: string;
  communityPostSending: boolean;
  showCreateCommunity: boolean;
  newCommunity: { name: string; description: string; category: string; emoji: string };
  creatingCommunity: boolean;
  communityJoining: string | null;
  onCommunitySearchChange: (value: string) => void;
  onOpenCommunity: (communityId: string) => void;
  onJoinCommunity: (communityId: string) => void;
  onLeaveCommunity: (communityId: string) => void;
  onCloseCommunity: () => void;
  onCommunityPostInputChange: (value: string) => void;
  onSendCommunityPost: () => void;
  onShowCreateCommunity: (value: boolean) => void;
  onNewCommunityChange: (value: { name: string; description: string; category: string; emoji: string }) => void;
  onCreateCommunity: () => void;
  authHeaders: () => Record<string, string>;
  timeAgo: (value: string | Date) => string;
}

export function CommunitiesPanel(props: CommunitiesPanelProps) {
  const { communities, communitiesLoading, communitySearch, selectedCommunity, communityPosts, communityPostsLoading, communityPostInput, communityPostSending, showCreateCommunity, newCommunity, creatingCommunity, communityJoining, onCommunitySearchChange, onOpenCommunity, onJoinCommunity, onLeaveCommunity, onCloseCommunity, onCommunityPostInputChange, onSendCommunityPost, onShowCreateCommunity, onNewCommunityChange, onCreateCommunity, authHeaders, timeAgo } = props;
  const myCommunities = communities.filter((community) => community.isMember);
  const discoverCommunities = communities.filter((community) => !community.isMember);

  return (
    <div className="flex-1 overflow-y-auto p-0 m-0 relative">
      {(communityPostsLoading || selectedCommunity) && (
        <div className="absolute inset-0 z-20 bg-background overflow-y-auto">
          <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-4 py-3 flex items-center gap-3">
            <button onClick={onCloseCommunity} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            {selectedCommunity && (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-2xl">{selectedCommunity.emoji}</span>
                <div>
                  <h2 className="font-bold text-sm">{selectedCommunity.name}</h2>
                  <p className="text-xs text-muted-foreground">{selectedCommunity.membersCount} membros</p>
                </div>
                <div className="ml-auto">
                  {selectedCommunity.memberRole === "owner" ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">Fundador</span>
                  ) : selectedCommunity.isMember ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={communityJoining === selectedCommunity.id} onClick={() => onLeaveCommunity(selectedCommunity.id)}>Sair</Button>
                  ) : (
                    <Button size="sm" className="h-7 text-xs" disabled={communityJoining === selectedCommunity.id} onClick={() => onJoinCommunity(selectedCommunity.id)}>Entrar</Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {communityPostsLoading && <div className="flex items-center justify-center h-40"><p className="text-sm text-muted-foreground">Carregando...</p></div>}

          {selectedCommunity && !communityPostsLoading && (
            <div className="p-4 space-y-4">
              {selectedCommunity.description && <p className="text-sm text-muted-foreground bg-secondary/30 rounded-xl px-4 py-3">{selectedCommunity.description}</p>}
              {selectedCommunity.isMember && (
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Escreva algo para a comunidade..."
                    className="text-sm resize-none min-h-[60px]"
                    value={communityPostInput}
                    onChange={(event) => onCommunityPostInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        onSendCommunityPost();
                      }
                    }}
                  />
                  <Button size="sm" className="self-end h-9 px-3" disabled={!communityPostInput.trim() || communityPostSending} onClick={onSendCommunityPost}><Send className="w-4 h-4" /></Button>
                </div>
              )}
              <div className="space-y-3">
                {communityPosts.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhuma publicação ainda. Seja o primeiro.</p>}
                {communityPosts.map((post) => (
                  <CommunityPostCard
                    key={post.id}
                    post={{ ...post, likesCount: post.likesCount ?? 0, liked: post.liked ?? false, commentsCount: post.commentsCount ?? 0 }}
                    communityName={selectedCommunity.name}
                    communityEmoji={selectedCommunity.emoji}
                    authHeaders={authHeaders}
                    timeAgo={timeAgo}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateCommunity && (
        <div className="absolute inset-0 z-30 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Nova Comunidade</h3>
              <button onClick={() => onShowCreateCommunity(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Emoji" className="w-16 text-center text-xl" value={newCommunity.emoji} onChange={(event) => onNewCommunityChange({ ...newCommunity, emoji: event.target.value })} maxLength={2} />
                <Input placeholder="Nome da comunidade *" className="flex-1" value={newCommunity.name} onChange={(event) => onNewCommunityChange({ ...newCommunity, name: event.target.value })} />
              </div>
              <Textarea placeholder="Descrição (opcional)" className="resize-none text-sm" rows={3} value={newCommunity.description} onChange={(event) => onNewCommunityChange({ ...newCommunity, description: event.target.value })} />
              <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={newCommunity.category} onChange={(event) => onNewCommunityChange({ ...newCommunity, category: event.target.value })}>
                <option value="geral">Geral</option>
                <option value="tecnologia">Tecnologia</option>
                <option value="música">Música</option>
                <option value="esportes">Esportes</option>
                <option value="jogos">Jogos</option>
                <option value="arte">Arte</option>
                <option value="cinema">Cinema & Séries</option>
                <option value="livros">Livros</option>
                <option value="culinária">Culinária</option>
                <option value="viagens">Viagens</option>
                <option value="saúde">Saúde & Bem-estar</option>
                <option value="humor">Humor</option>
              </select>
            </div>
            <Button className="w-full" disabled={!newCommunity.name.trim() || creatingCommunity} onClick={onCreateCommunity} data-testid="communities-create-submit">
              {creatingCommunity ? "Criando..." : "Criar comunidade"}
            </Button>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-4 py-3 flex items-center gap-2">
        <Input placeholder="Buscar comunidades..." className="flex-1 h-8 text-sm" value={communitySearch} onChange={(event) => onCommunitySearchChange(event.target.value)} data-testid="communities-search-input" />
        <Button size="sm" className="h-8 px-3 text-xs gap-1" onClick={() => onShowCreateCommunity(true)} data-testid="communities-open-create">
          <Plus className="w-3 h-3" />
          Criar
        </Button>
      </div>

      {myCommunities.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">MINHAS COMUNIDADES</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {myCommunities.map((community) => (
              <button key={community.id} onClick={() => onOpenCommunity(community.id)} className="flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-secondary/50 transition-colors w-16">
                <span className="text-2xl">{community.emoji}</span>
                <p className="text-xs text-center leading-tight line-clamp-2">{community.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pt-4 pb-6 space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">DESCOBRIR COMUNIDADES</p>
          <p className="text-[11px] text-muted-foreground mt-1">Espaços temáticos para reforçar retenção e afinidade.</p>
        </div>
        {communitiesLoading && <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>}
        {!communitiesLoading && discoverCommunities.length === 0 && myCommunities.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">Nenhuma comunidade encontrada. Que tal criar a primeira?</p>}
        {discoverCommunities.map((community) => (
          <div key={community.id} className="bg-secondary/30 rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:bg-secondary/50 transition-colors" onClick={() => onOpenCommunity(community.id)}>
            <span className="text-3xl">{community.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{community.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{community.category} · {community.membersCount} {community.membersCount === 1 ? "membro" : "membros"}</p>
                </div>
                <Button size="sm" className="h-7 text-xs flex-shrink-0" disabled={communityJoining === community.id} onClick={(event) => { event.stopPropagation(); onJoinCommunity(community.id); }}>
                  {communityJoining === community.id ? "..." : "Entrar"}
                </Button>
              </div>
              {community.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{community.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
