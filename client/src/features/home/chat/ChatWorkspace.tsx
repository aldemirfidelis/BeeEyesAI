import type { ReactNode, RefObject } from "react";
import { useState, useEffect, useRef } from "react";
import BeeEyes, { type BeeEyesEvent, type BeeEyesExpression } from "@/components/BeeEyes";
import ChatMessage from "@/components/ChatMessage";
import StreakDisplay from "@/components/StreakDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AnimatePresence } from "framer-motion";
import { Bell, ImagePlus, MessageCircle, Search, Send, Settings, User, Users, X } from "lucide-react";
import type { Message, User as UserType } from "@/features/home/types";

interface ChatWorkspaceProps {
  mobileTab: string;
  profilePhotoUrl: string;
  user: UserType | null;
  authHeaders: () => Record<string, string>;
  onGoToFriends: () => void;
  eyeExpression: BeeEyesExpression;
  eyeEvent: BeeEyesEvent | null;
  eyeInputFocused: boolean;
  eyeIsTyping: boolean;
  eyeScrollProgress: number;
  eyeEngagementLevel: number;
  showMsgSearch: boolean;
  msgSearchQuery: string;
  messages: Message[];
  streamingText: string;
  processingConnectionRequestId: string | null;
  chatScrollRef: RefObject<HTMLDivElement>;
  chatEndRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
  inputValue: string;
  isLoading: boolean;
  postText: string;
  postImageUrl: string;
  pickingPostImage: boolean;
  showInlinePost: boolean;
  isPosting: boolean;
  messageActionsRenderer: (message: Message) => ReactNode;
  onToggleSettings: () => void;
  onToggleSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onScrollStateChange: () => void;
  onInlinePostClose: () => void;
  onPostTextChange: (value: string) => void;
  onPickPostImage: () => void;
  onRemovePostImage: () => void;
  onCreatePost: () => void;
  onInputChange: (value: string) => void;
  onInputFocusChange: (focused: boolean) => void;
  onSendMessage: () => void;
  onQuickAction: (action: "feed" | "missions" | "news" | "inbox" | "communities") => void;
}

function NotificationsDropdown({ authHeaders, onClose }: { authHeaders: () => Record<string, string>; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications/center", { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-12 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="font-bold text-sm">Alertas</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum alerta por enquanto.</div>
        ) : items.map((item) => (
          <div key={item.id} className={`px-4 py-3 border-b border-border/50 last:border-0 ${!item.read ? "bg-primary/5" : ""}`}>
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications/center", { headers: props.authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUnreadCount(data.filter((n: any) => !n.read).length);
      })
      .catch(() => {});
  }, []);

  const {
    mobileTab,
    profilePhotoUrl,
    user,
    eyeExpression,
    eyeEvent,
    eyeInputFocused,
    eyeIsTyping,
    eyeScrollProgress,
    eyeEngagementLevel,
    showMsgSearch,
    msgSearchQuery,
    messages,
    streamingText,
    chatScrollRef,
    chatEndRef,
    inputRef,
    inputValue,
    isLoading,
    postText,
    postImageUrl,
    pickingPostImage,
    showInlinePost,
    isPosting,
    messageActionsRenderer,
    authHeaders,
    onGoToFriends,
    onToggleSettings,
    onToggleSearch,
    onSearchQueryChange,
    onScrollStateChange,
    onInlinePostClose,
    onPostTextChange,
    onPickPostImage,
    onRemovePostImage,
    onCreatePost,
    onInputChange,
    onInputFocusChange,
    onSendMessage,
    onQuickAction,
  } = props;

  const visibleMessages = msgSearchQuery
    ? messages.filter((message) => message.content.toLowerCase().includes(msgSearchQuery.toLowerCase()))
    : messages;

  return (
    <div className={`flex-1 flex flex-col min-h-0 ${mobileTab !== "chat" ? "hidden md:flex" : ""}`}>
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/bee-logo.svg" alt="bee-eyes" className="w-8 h-8 shrink-0" />
            <h1 className="font-display text-xl font-bold text-primary">bee-eyes</h1>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Alertas */}
            <button
              type="button"
              onClick={() => setShowNotifications((v) => !v)}
              className="flex flex-col items-center gap-0.5 text-muted-foreground relative"
            >
              <div className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {Math.min(unreadCount, 9)}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold leading-none">Alertas</span>
            </button>
            {showNotifications && (
              <NotificationsDropdown authHeaders={authHeaders} onClose={() => setShowNotifications(false)} />
            )}

            {/* Amigos */}
            <button
              type="button"
              onClick={onGoToFriends}
              className="flex flex-col items-center gap-0.5 text-muted-foreground"
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-semibold leading-none">Amigos</span>
            </button>

            {/* Perfil */}
            <button
              type="button"
              onClick={onToggleSettings}
              className="flex flex-col items-center gap-0.5 text-muted-foreground"
            >
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt="Foto" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
              <span className="text-[10px] font-semibold leading-none">Perfil</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-center py-1 border-b bg-gradient-to-b from-primary/5 to-transparent shrink-0 relative">
          <BeeEyes
            expression={eyeExpression}
            event={eyeEvent}
            inputFocused={eyeInputFocused}
            isTyping={eyeIsTyping}
            scrollProgress={eyeScrollProgress}
            engagementLevel={eyeEngagementLevel}
          />
          <button type="button" onClick={onToggleSearch} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-muted transition-colors" aria-label="Buscar mensagens">
            <Search size={18} className="text-muted-foreground" />
          </button>
        </div>

        {showMsgSearch && (
          <div className="shrink-0 px-4 py-2 border-b bg-card/50 flex items-center gap-2">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <input autoFocus type="text" value={msgSearchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Buscar nas mensagens..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            {msgSearchQuery && <button type="button" onClick={() => onSearchQueryChange("")} className="text-muted-foreground hover:text-foreground">Limpar</button>}
            <span className="text-xs text-muted-foreground shrink-0">{msgSearchQuery ? `${visibleMessages.length} resultado(s)` : ""}</span>
          </div>
        )}

        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3" onScroll={onScrollStateChange}>
          <AnimatePresence mode="popLayout">
            {visibleMessages.map((message) => (
              <ChatMessage key={message.id} role={message.role} content={message.content} timestamp={message.timestamp} actions={messageActionsRenderer(message)} />
            ))}
            {streamingText && <ChatMessage key="streaming" role="assistant" content={`${streamingText}▌`} timestamp={new Date()} />}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>

        <div className="border-t p-3 md:p-4 bg-card/50 backdrop-blur-sm shrink-0 pb-safe">
          {showInlinePost && (
            <div className="max-w-4xl mx-auto mb-3 rounded-2xl border border-border bg-background/80 p-3 space-y-3">
              <Textarea value={postText} onChange={(event) => onPostTextChange(event.target.value)} placeholder="Compartilhe uma atualização rápida com seus amigos..." className="min-h-[88px] resize-none text-sm" maxLength={500} />
              <div className="flex justify-between gap-2">
                <Button variant="ghost" className="text-xs" onClick={onInlinePostClose}>Fechar</Button>
                <Button className="text-xs" disabled={!postText.trim() || isPosting} onClick={onCreatePost}>{isPosting ? "Publicando..." : "Publicar"}</Button>
              </div>
            </div>
          )}

          {/* Quick action chips */}
          <div className="flex gap-2 max-w-4xl mx-auto mb-2 overflow-x-auto pb-1 scrollbar-none">
            {(
              [
                { label: "🚀 Quero evoluir",   action: "missions"     },
                { label: "📰 Ver feed",         action: "feed"         },
                { label: "📬 Mensagens",        action: "inbox"        },
                { label: "🌐 Comunidades",      action: "communities"  },
                { label: "📡 Notícias",         action: "news"         },
              ] as const
            ).map(({ label, action }) => (
              <button
                key={action}
                type="button"
                onClick={() => onQuickAction(action)}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-primary/10 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 max-w-4xl mx-auto">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              onFocus={() => onInputFocusChange(true)}
              onBlur={() => onInputFocusChange(false)}
              onKeyDown={(event) => event.key === "Enter" && onSendMessage()}
              placeholder="Digite sua mensagem..."
              className="flex-1"
              disabled={isLoading}
              autoFocus
              data-testid="input-chat-message"
            />
            <Button onClick={onSendMessage} size="icon" disabled={isLoading} data-testid="button-send-message">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
