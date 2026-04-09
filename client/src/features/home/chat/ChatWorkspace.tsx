import type { ReactNode, RefObject } from "react";
import BeeEyesSVG from "@/components/BeeEyesSVG";
import type { BeeEyesEvent, BeeEyesExpression } from "@/components/BeeEyes";
import ChatMessage from "@/components/ChatMessage";
import StreakDisplay from "@/components/StreakDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AnimatePresence } from "framer-motion";
import { MessageCircle, Search, Send, Settings } from "lucide-react";
import type { Message, User } from "@/features/home/types";

interface ChatWorkspaceProps {
  mobileTab: string;
  profilePhotoUrl: string;
  user: User | null;
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
  showInlinePost: boolean;
  isPosting: boolean;
  messageActionsRenderer: (message: Message) => ReactNode;
  onToggleSettings: () => void;
  onToggleSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onScrollStateChange: () => void;
  onInlinePostClose: () => void;
  onPostTextChange: (value: string) => void;
  onCreatePost: () => void;
  onInputChange: (value: string) => void;
  onInputFocusChange: (focused: boolean) => void;
  onSendMessage: () => void;
  onQuickAction: (action: "feed" | "missions" | "news" | "inbox" | "communities") => void;
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
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
    showInlinePost,
    isPosting,
    messageActionsRenderer,
    onToggleSettings,
    onToggleSearch,
    onSearchQueryChange,
    onScrollStateChange,
    onInlinePostClose,
    onPostTextChange,
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
            <h1 className="font-display text-xl font-bold text-primary">bee-eyes</h1>
            <button type="button" onClick={onToggleSettings} className="w-9 h-9 rounded-full border border-border overflow-hidden bg-primary/20 flex items-center justify-center shrink-0" aria-label="Abrir configuracoes de perfil">
              {profilePhotoUrl ? <img src={profilePhotoUrl} alt="Foto de perfil" className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{(user?.username || "?")[0].toUpperCase()}</span>}
            </button>
            {user && <StreakDisplay streak={user.currentStreak} />}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleSettings}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Configurações"
              title="Configurações"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-center py-4 border-b bg-gradient-to-b from-primary/5 to-transparent shrink-0 relative">
          <div className="w-full max-w-sm px-4">
            <BeeEyesSVG />
          </div>
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
