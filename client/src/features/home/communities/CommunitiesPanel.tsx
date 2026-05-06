import { useRef, useState } from "react";
import { Check, ImagePlus, Lock, Pencil, Plus, Send, Trash2, X, UserPlus } from "lucide-react";
import CommunityPostCard from "@/components/CommunityPostCard";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Community, CommunityMember, CommunityPost, Friend } from "@/features/home/types";

type EditingCommunity = { id: string; name: string; description: string; imageUrl: string } | null;

interface CommunitiesPanelProps {
  communities: Community[];
  communitiesLoading: boolean;
  communitySearch: string;
  selectedCommunity: (Community & { isMember: boolean; memberRole?: string; memberStatus?: string }) | null;
  pendingRequests: { id: string; username: string; displayName: string | null; avatarUrl?: string | null; requestedAt: string }[];
  friends: Friend[];
  friendsLoading?: boolean;
  onApproveRequest: (communityId: string, userId: string) => void;
  onRejectRequest: (communityId: string, userId: string) => void;
  onInviteToCommunity: (communityId: string, userIds: string[]) => Promise<void>;
  communityPosts: CommunityPost[];
  communityPostsLoading: boolean;
  communityPostInput: string;
  communityPostImageUrl: string;
  pickingCommunityPostImage: boolean;
  communityPostSending: boolean;
  showCreateCommunity: boolean;
  newCommunity: { name: string; description: string; category: string; emoji: string; imageUrl: string; isPrivate: boolean };
  creatingCommunity: boolean;
  communityJoining: string | null;
  editingCommunity: EditingCommunity;
  savingCommunity: boolean;
  onCommunitySearchChange: (value: string) => void;
  onOpenCommunity: (communityId: string) => void;
  onJoinCommunity: (communityId: string) => void;
  onLeaveCommunity: (communityId: string) => void;
  onCloseCommunity: () => void;
  onCommunityPostInputChange: (value: string) => void;
  onPickCommunityPostImage: () => void;
  onRemoveCommunityPostImage: () => void;
  onSendCommunityPost: () => void;
  onShowCreateCommunity: (value: boolean) => void;
  onNewCommunityChange: (value: { name: string; description: string; category: string; emoji: string; imageUrl: string; isPrivate: boolean }) => void;
  onCreateCommunity: () => void;
  onOpenEditCommunity: () => void;
  onEditCommunityChange: (value: EditingCommunity) => void;
  onSaveEditCommunity: () => void;
  onCancelEditCommunity: () => void;
  onDeleteCommunity: (communityId: string, name: string) => void;
  authHeaders: () => Record<string, string>;
  timeAgo: (value: string | Date) => string;
}

/** Renders community avatar: image > emoji > initial */
function CommunityAvatar({
  community,
  size = "md",
}: {
  community: Pick<Community, "name" | "emoji" | "imageUrl">;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm" ? "w-10 h-10 text-xl" :
    size === "lg" ? "w-14 h-14 text-3xl" :
    "w-12 h-12 text-2xl";
  const imgDim =
    size === "sm" ? "w-10 h-10" :
    size === "lg" ? "w-14 h-14" :
    "w-12 h-12";

  if (community.imageUrl) {
    return (
      <img
        src={community.imageUrl}
        alt={community.name}
        className={`${imgDim} rounded-full object-cover shrink-0 border border-border`}
      />
    );
  }
  if (community.emoji) {
    return (
      <span className={`${dim} flex items-center justify-center shrink-0`}>
        {community.emoji}
      </span>
    );
  }
  return (
    <div className={`${dim} rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0`}>
      {community.name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

/** Image picker button shared by create + edit modals */
function ImagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="relative group w-20 h-20 rounded-full border-2 border-dashed border-border hover:border-primary transition-colors flex items-center justify-center overflow-hidden bg-secondary/30"
      >
        {value ? (
          <>
            <img src={value} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ImagePlus className="w-5 h-5 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors">
            <ImagePlus className="w-6 h-6" />
            <span className="text-[10px] font-medium">Foto</span>
          </div>
        )}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Remover imagem
        </button>
      )}
    </div>
  );
}

export function CommunitiesPanel(props: CommunitiesPanelProps) {
  const {
    communities, communitiesLoading, communitySearch, selectedCommunity,
    communityPosts, communityPostsLoading, communityPostInput, communityPostImageUrl, pickingCommunityPostImage, communityPostSending,
    showCreateCommunity, newCommunity, creatingCommunity, communityJoining,
    editingCommunity, savingCommunity,
    onCommunitySearchChange, onOpenCommunity, onJoinCommunity, onLeaveCommunity,
    onCloseCommunity, onCommunityPostInputChange, onPickCommunityPostImage, onRemoveCommunityPostImage, onSendCommunityPost,
    onShowCreateCommunity, onNewCommunityChange, onCreateCommunity,
    onOpenEditCommunity, onEditCommunityChange, onSaveEditCommunity, onCancelEditCommunity,
    onDeleteCommunity, authHeaders, timeAgo,
    pendingRequests, onApproveRequest, onRejectRequest,
  } = props;

  const visibleCommunities = communities.filter((community) => {
    const name = community.name.trim().toLowerCase();
    return !name.startsWith("crew") && !name.startsWith("com");
  });
  const myCommunities = visibleCommunities.filter((c) => c.isMember);
  const discoverCommunities = visibleCommunities.filter((c) => !c.isMember);
  const isOwner = selectedCommunity?.memberRole === "owner";
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedInviteIds, setSelectedInviteIds] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);

  async function openMembersSheet() {
    if (!selectedCommunity) return;
    setMembersOpen(true);
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/communities/${selectedCommunity.id}/members`, { headers: authHeaders() });
      if (res.ok) setMembers(await res.json());
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleSendInvites() {
    if (!selectedCommunity || selectedInviteIds.size === 0) return;
    setInviting(true);
    try {
      await props.onInviteToCommunity(selectedCommunity.id, Array.from(selectedInviteIds));
      setInviteModalOpen(false);
      setSelectedInviteIds(new Set());
    } finally {
      setInviting(false);
    }
  }

  return (
    // Outer div: positioning context only — NO overflow here so absolute overlays stay visible
    <div className="flex-1 flex flex-col min-h-0 relative">

      {/* ── Community detail view ─────────────────────────────── */}
      {(communityPostsLoading || selectedCommunity) && (
        <div className="absolute inset-0 z-20 bg-background overflow-y-auto">
          <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-4 py-3 flex items-center gap-3">
            <button onClick={onCloseCommunity} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            {selectedCommunity && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <CommunityAvatar community={selectedCommunity} size="sm" />
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-sm truncate">{selectedCommunity.name}</h2>
                  <button type="button" onClick={openMembersSheet} className="text-xs text-primary hover:underline">
                    {selectedCommunity.membersCount} membros - ver todos
                  </button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Owner-only actions */}
                  {isOwner && (
                    <>
                      <button
                        onClick={onOpenEditCommunity}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Editar comunidade"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteCommunity(selectedCommunity.id, selectedCommunity.name)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Apagar comunidade"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {selectedCommunity.memberRole === "owner" ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">Fundador</span>
                  ) : selectedCommunity.memberStatus === "pending" ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground font-medium">⏳ Pendente</span>
                  ) : selectedCommunity.isMember ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={communityJoining === selectedCommunity.id} onClick={() => onLeaveCommunity(selectedCommunity.id)}>Sair</Button>
                  ) : (
                    <Button size="sm" className="h-7 text-xs" disabled={communityJoining === selectedCommunity.id} onClick={() => onJoinCommunity(selectedCommunity.id)}>
                      {selectedCommunity.isPrivate ? <><Lock className="w-3 h-3 mr-1" />Solicitar</> : "Entrar"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {communityPostsLoading && (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </div>
          )}

          {selectedCommunity && !communityPostsLoading && (
            <div className="p-4 space-y-4">
              {selectedCommunity.description && (
                <p className="text-sm text-muted-foreground bg-secondary/30 rounded-xl px-4 py-3">{selectedCommunity.description}</p>
              )}

              {selectedCommunity.isMember && (
                <div className="flex gap-2">
                  <Button variant="secondary" className="w-full text-xs h-8" onClick={() => setInviteModalOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Convidar amigos
                  </Button>
                </div>
              )}

              {selectedCommunity.memberRole === "owner" && selectedCommunity.isPrivate && pendingRequests.length > 0 && (
                <div className="rounded-xl border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">🔔 Solicitações de entrada ({pendingRequests.length})</p>
                  {pendingRequests.map((req) => {
                    const name = req.displayName || req.username;
                    return (
                      <div key={req.id} className="flex items-center gap-2">
                        <UserAvatar name={name} avatarUrl={req.avatarUrl} className="w-7 h-7" />
                        <span className="text-sm font-medium flex-1 truncate">{name}</span>
                        <button onClick={() => onApproveRequest(selectedCommunity.id, req.id)} className="w-7 h-7 rounded-full bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors" title="Aprovar">
                          <Check className="w-3.5 h-3.5 text-green-700" />
                        </button>
                        <button onClick={() => onRejectRequest(selectedCommunity.id, req.id)} className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors" title="Recusar">
                          <X className="w-3.5 h-3.5 text-red-700" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedCommunity.isMember && (
                <div className="space-y-2 rounded-xl border border-border bg-card/60 p-3">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Escreva algo para a comunidade..."
                      className="text-sm resize-none min-h-[60px]"
                      value={communityPostInput}
                      onChange={(e) => onCommunityPostInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSendCommunityPost(); }
                      }}
                    />
                    <Button size="sm" className="self-end h-9 px-3" disabled={(!communityPostInput.trim() && !communityPostImageUrl) || communityPostSending} onClick={onSendCommunityPost} aria-label="Publicar">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  {communityPostImageUrl && (
                    <div className="relative overflow-hidden rounded-xl border border-border bg-black/5">
                      <img src={communityPostImageUrl} alt="Prévia da imagem" className="w-full max-h-72 object-contain" />
                      <button type="button" onClick={onRemoveCommunityPostImage} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors" aria-label="Remover imagem">
                        <X className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 rounded-lg px-2 py-1">
                        <span className="text-white text-[10px] font-semibold">📸 Foto anexada</span>
                      </div>
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onPickCommunityPostImage} disabled={pickingCommunityPostImage}>
                    <ImagePlus className="w-4 h-4 mr-1" />
                    {communityPostImageUrl ? "Trocar imagem" : "Adicionar imagem"}
                  </Button>
                </div>
              )}
              <div className="space-y-3">
                {communityPosts.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhuma publicação ainda. Seja o primeiro.</p>
                )}
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

      {/* ── Edit community modal ──────────────────────────────── */}
      {membersOpen && selectedCommunity && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card p-4 shadow-xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold truncate">{selectedCommunity.name}</h3>
                <p className="text-xs text-muted-foreground">{members.length || selectedCommunity.membersCount} membros</p>
              </div>
              <button type="button" onClick={() => setMembersOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar membros">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 max-h-[55vh] overflow-y-auto space-y-2">
              {membersLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando membros...</p>}
              {!membersLoading && members.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum membro encontrado.</p>}
              {members.map((member) => {
                const name = member.displayName || member.username;
                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2">
                    <UserAvatar name={name} avatarUrl={member.avatarUrl} className="w-9 h-9" fallbackClassName={member.role === "owner" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">{member.role === "owner" ? "Fundador" : "Membro"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {editingCommunity && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Editar Comunidade</h3>
              <button onClick={onCancelEditCommunity}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-3">
              <ImagePicker
                value={editingCommunity.imageUrl}
                onChange={(dataUrl) => onEditCommunityChange({ ...editingCommunity, imageUrl: dataUrl })}
              />

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
                <Input
                  placeholder="Nome da comunidade"
                  value={editingCommunity.name}
                  onChange={(e) => onEditCommunityChange({ ...editingCommunity, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
                <Textarea
                  placeholder="Descrição (opcional)"
                  className="resize-none text-sm"
                  rows={3}
                  value={editingCommunity.description}
                  onChange={(e) => onEditCommunityChange({ ...editingCommunity, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onCancelEditCommunity}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!editingCommunity.name.trim() || savingCommunity}
                onClick={onSaveEditCommunity}
              >
                {savingCommunity ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create community modal ────────────────────────────── */}
      {showCreateCommunity && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Nova Comunidade</h3>
              <button onClick={() => onShowCreateCommunity(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-3">
              <ImagePicker
                value={newCommunity.imageUrl}
                onChange={(dataUrl) => onNewCommunityChange({ ...newCommunity, imageUrl: dataUrl })}
              />

              <div className="flex gap-2">
                <Input
                  placeholder="🐝"
                  className="w-14 text-center text-xl"
                  value={newCommunity.emoji}
                  onChange={(e) => onNewCommunityChange({ ...newCommunity, emoji: e.target.value })}
                  maxLength={2}
                />
                <Input
                  placeholder="Nome da comunidade *"
                  className="flex-1"
                  value={newCommunity.name}
                  onChange={(e) => onNewCommunityChange({ ...newCommunity, name: e.target.value })}
                />
              </div>

              <Textarea
                placeholder="Descrição (opcional)"
                className="resize-none text-sm"
                rows={3}
                value={newCommunity.description}
                onChange={(e) => onNewCommunityChange({ ...newCommunity, description: e.target.value })}
              />

              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={newCommunity.category}
                onChange={(e) => onNewCommunityChange({ ...newCommunity, category: e.target.value })}
              >
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

            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Comunidade privada</p>
                <p className="text-xs text-muted-foreground mt-0.5">Novos membros precisam de aprovação</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={newCommunity.isPrivate}
                onClick={() => onNewCommunityChange({ ...newCommunity, isPrivate: !newCommunity.isPrivate })}
                className={`relative w-10 h-6 rounded-full transition-colors focus:outline-none ${newCommunity.isPrivate ? "bg-amber-400" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${newCommunity.isPrivate ? "translate-x-4" : ""}`} />
              </button>
            </div>

            <Button
              className="w-full"
              disabled={!newCommunity.name.trim() || creatingCommunity}
              onClick={onCreateCommunity}
              data-testid="communities-create-submit"
            >
              {creatingCommunity ? "Criando..." : "Criar comunidade"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Scrollable content (separate from positioning context) ── */}
      <div className="flex-1 overflow-y-auto">

      {/* ── Search + Create button ────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-4 py-3 flex items-center gap-2">
        <Input
          placeholder="Buscar comunidades..."
          className="flex-1 h-8 text-sm"
          value={communitySearch}
          onChange={(e) => onCommunitySearchChange(e.target.value)}
          data-testid="communities-search-input"
        />
        <Button size="sm" className="h-8 px-3 text-xs gap-1" onClick={() => onShowCreateCommunity(true)} data-testid="communities-open-create">
          <Plus className="w-3 h-3" />
          Criar
        </Button>
      </div>

      {/* ── My communities ────────────────────────────────────── */}
      {myCommunities.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">MINHAS COMUNIDADES</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {myCommunities.map((community) => (
              <button
                key={community.id}
                onClick={() => onOpenCommunity(community.id)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-secondary/50 transition-colors w-16"
              >
                <CommunityAvatar community={community} size="sm" />
                <p className="text-xs text-center leading-tight line-clamp-2">{community.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Discover ─────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-6 space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">DESCOBRIR COMUNIDADES</p>
          <p className="text-[11px] text-muted-foreground mt-1">Espaços temáticos para reforçar retenção e afinidade.</p>
        </div>
        {communitiesLoading && (
          <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
        )}
        {!communitiesLoading && discoverCommunities.length === 0 && myCommunities.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">Nenhuma comunidade encontrada. Que tal criar a primeira?</p>
        )}
        {discoverCommunities.map((community) => (
          <div
            key={community.id}
            className="bg-secondary/30 rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:bg-secondary/50 transition-colors"
            onClick={() => onOpenCommunity(community.id)}
          >
            <CommunityAvatar community={community} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm flex items-center gap-1">
                    {community.name}
                    {community.isPrivate && <Lock className="w-3 h-3 text-muted-foreground inline" />}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {community.category} · {community.membersCount} {community.membersCount === 1 ? "membro" : "membros"}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs flex-shrink-0"
                  disabled={communityJoining === community.id}
                  onClick={(e) => { e.stopPropagation(); onJoinCommunity(community.id); }}
                >
                  {communityJoining === community.id ? "..." : community.isPrivate ? <><Lock className="w-3 h-3 mr-1" />Solicitar</> : "Entrar"}
                </Button>
              </div>
              {community.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{community.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      </div>{/* end scrollable wrapper */}

      {/* ── Invite modal ──────────────────────────────────────── */}
      {inviteModalOpen && selectedCommunity && (
        <div className="absolute inset-0 z-50 bg-background flex flex-col">
          <div className="border-b border-border/40 px-4 py-3 flex items-center gap-3 shrink-0">
            <button onClick={() => { setInviteModalOpen(false); setSelectedInviteIds(new Set()); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-bold text-base flex-1">Convidar para {selectedCommunity.name}</h2>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            {props.friendsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-10">Carregando amigos...</p>
            ) : props.friends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Você ainda não tem amigos para convidar.</p>
            ) : (
              props.friends.map((friend) => {
                const isSelected = selectedInviteIds.has(friend.id);
                return (
                  <div key={friend.id} className="flex items-center gap-3 p-2 rounded-xl border border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => {
                    const next = new Set(selectedInviteIds);
                    if (isSelected) next.delete(friend.id);
                    else next.add(friend.id);
                    setSelectedInviteIds(next);
                  }}>
                    <UserAvatar name={friend.displayName || friend.username} avatarUrl={friend.avatarUrl} className="w-10 h-10" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{friend.displayName || friend.username}</p>
                      <p className="text-xs text-muted-foreground truncate">Nível {friend.level}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="p-4 border-t border-border/40 shrink-0">
            <Button className="w-full" disabled={selectedInviteIds.size === 0 || inviting} onClick={handleSendInvites}>
              {inviting ? "Enviando..." : `Convidar ${selectedInviteIds.size > 0 ? selectedInviteIds.size : ""} amigos`}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
