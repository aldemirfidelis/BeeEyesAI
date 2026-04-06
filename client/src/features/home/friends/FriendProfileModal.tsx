import { motion, AnimatePresence } from "framer-motion";
import { Flame, TrendingUp, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FriendProfile, User } from "@/features/home/types";

interface FriendProfileModalProps {
  open: boolean;
  loading: boolean;
  selectedFriend: FriendProfile | null;
  currentUser: User | null;
  isFriendUser: (userId: string) => boolean;
  onClose: () => void;
  onOpenDMWithUser: (target: { id: string; username: string; displayName: string | null; level: number }) => void;
  timeAgo: (value: string | Date) => string;
}

export function FriendProfileModal(props: FriendProfileModalProps) {
  const { open, loading, selectedFriend, currentUser, isFriendUser, onClose, onOpenDMWithUser, timeAgo } = props;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-background border shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {loading && <div className="flex items-center justify-center h-40"><p className="text-sm text-muted-foreground">Carregando perfil...</p></div>}
            {selectedFriend && !loading && (() => {
              const { user, recentPosts, interests, activeMissionsCount } = selectedFriend;
              const name = user.displayName || user.username;
              const canSendMessage = isFriendUser(user.id);
              return (
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-2xl font-black">{name[0].toUpperCase()}</div>
                      <div>
                        <h2 className="font-display text-xl font-bold">{name}</h2>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
                  </div>

                  {canSendMessage && (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!currentUser || currentUser.level < 2}
                      title={currentUser && currentUser.level < 2 ? "Desbloqueado no Nível 2" : undefined}
                      onClick={() => onOpenDMWithUser({ id: user.id, username: user.username, displayName: user.displayName, level: user.level })}
                    >
                      {currentUser && currentUser.level < 2 ? "Mensagem bloqueada até o nível 2" : "Enviar mensagem"}
                    </Button>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-secondary/50 rounded-xl p-3 text-center">
                      <Trophy className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <p className="text-sm font-bold">Nv {user.level}</p>
                      <p className="text-xs text-muted-foreground">Nível</p>
                    </div>
                    <div className="bg-secondary/50 rounded-xl p-3 text-center">
                      <Flame className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                      <p className="text-sm font-bold">{user.currentStreak}d</p>
                      <p className="text-xs text-muted-foreground">Streak</p>
                    </div>
                    <div className="bg-secondary/50 rounded-xl p-3 text-center">
                      <TrendingUp className="w-4 h-4 mx-auto mb-1 text-green-500" />
                      <p className="text-sm font-bold">{activeMissionsCount}</p>
                      <p className="text-xs text-muted-foreground">Missões</p>
                    </div>
                  </div>

                  {interests.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">INTERESSES</p>
                      <div className="flex flex-wrap gap-1.5">
                        {interests.slice(0, 8).map((interest) => (
                          <span key={interest} className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">{interest}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {recentPosts.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">PUBLICAÇÕES RECENTES</p>
                      <div className="space-y-2">
                        {recentPosts.map((post) => (
                          <div key={post.id} className="bg-secondary/30 rounded-xl p-3 space-y-1.5">
                            <p className="text-sm leading-relaxed">{post.content}</p>
                            {post.aiComment && <div className="border-l-2 border-primary pl-2"><p className="text-xs text-muted-foreground">🐝 {post.aiComment}</p></div>}
                            <div className="flex items-center gap-2">
                              {post.sentimentLabel && <span className="text-xs text-muted-foreground">{post.sentimentLabel}</span>}
                              <span className="text-xs text-muted-foreground ml-auto">{timeAgo(post.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">{name} ainda não publicou nada.</p>
                  )}

                  {user.lastActiveAt && <p className="text-xs text-muted-foreground text-center">Último acesso: {timeAgo(user.lastActiveAt)}</p>}
                </div>
              );
            })()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
