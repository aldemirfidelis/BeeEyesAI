import type { ReactNode, RefObject } from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import BeeEyes, { type BeeEyesEvent, type BeeEyesExpression } from "@/components/BeeEyes";
import ChatMessage from "@/components/ChatMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";
import { Bell, Loader2, Mic, MicOff, Search, Send, User, Users, X } from "lucide-react";
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
  eyeEngagementLevel?: number;
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
  messageActionsRenderer: (message: Message) => ReactNode;
  onToggleSettings: () => void;
  onToggleSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onScrollStateChange: () => void;
  onInputChange: (value: string) => void;
  onInputFocusChange: (focused: boolean) => void;
  onSendMessage: () => void;
  onSendVoiceMessage: (text: string) => void;
}

function NotificationsDropdown({ authHeaders, onClose, onNotificationClick }: { authHeaders: () => Record<string, string>; onClose: () => void; onNotificationClick: (item: any) => void }) {
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
    <div ref={ref} className="bg-card border border-border shadow-xl absolute right-0 top-12 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl z-50 overflow-hidden">
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
          <div 
            key={item.id} 
            className={`px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${!item.read ? "bg-primary/5" : ""}`}
            onClick={() => {
              if (!item.read) {
                fetch("/api/notifications/read", {
                  method: "POST",
                  headers: { ...authHeaders(), "Content-Type": "application/json" },
                  body: JSON.stringify({ ids: [item.id] })
                }).catch(() => {});
              }
              onNotificationClick(item);
            }}
          >
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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);

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
    messageActionsRenderer,
    authHeaders,
    onGoToFriends,
    onToggleSettings,
    onToggleSearch,
    onSearchQueryChange,
    onScrollStateChange,
    onInputChange,
    onInputFocusChange,
    onSendMessage,
    onSendVoiceMessage,
  } = props;

  const handleMicToggle = useCallback(async () => {
    if (isTranscribing) return;

    if (isRecording) {
      // Enforce minimum 1 second to avoid empty/silent audio hallucinations
      const elapsed = Date.now() - recordingStartRef.current;
      if (elapsed < 1000) return;
      mediaRecorderRef.current?.stop();
      return;
    }

    setTranscriptionError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        // Reject suspiciously small blobs — real 1s audio is at least ~3 KB
        if (blob.size < 2000) {
          setTranscriptionError(true);
          setTimeout(() => setTranscriptionError(false), 3000);
          return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          if (!base64) return;
          setIsTranscribing(true);
          try {
            const res = await fetch("/api/transcribe", {
              method: "POST",
              headers: { ...authHeaders(), "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64, mimeType }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text) {
                onSendVoiceMessage(data.text);
              } else {
                setTranscriptionError(true);
                setTimeout(() => setTranscriptionError(false), 3000);
              }
            }
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(250);
      recordingStartRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      // mic permission denied or unavailable
    }
  }, [isRecording, isTranscribing, authHeaders, onSendVoiceMessage]);

  const visibleMessages = msgSearchQuery
    ? messages.filter((message) => message.content.toLowerCase().includes(msgSearchQuery.toLowerCase()))
    : messages;

  return (
    <div className={`flex-1 flex flex-col min-h-0 ${mobileTab !== "chat" ? "hidden md:flex" : ""}`}>
      <header className="sticky top-0 z-30 shrink-0 border-b border-primary/10 beeyes-glass-light dark:beeyes-glass">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-6 md:py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-primary/55 bg-primary/10 beeyes-glow md:h-11 md:w-11">
              <img src="/beeyes-design/images/bee-icon.png" alt="bee-eyes" className="h-full w-full object-cover" />
            </span>
            <div>
              <h1 className="font-display text-xl font-black leading-none beeyes-gradient-text md:text-xl">bee-eyes</h1>
              <p className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold uppercase text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Assistente pessoal inteligente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Alertas */}
            <button
              type="button"
              onClick={() => setShowNotifications((v) => !v)}
              className="relative flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground md:px-2"
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
              <NotificationsDropdown 
                authHeaders={authHeaders} 
                onClose={() => setShowNotifications(false)} 
                onNotificationClick={(item) => {
                  onSearchQueryChange(item.body);
                  setShowNotifications(false);
                  if (!item.read) {
                    setUnreadCount((prev) => Math.max(0, prev - 1));
                  }
                }}
              />
            )}

            {/* Amigos */}
            <button
              type="button"
              onClick={onGoToFriends}
              className="flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground md:px-2"
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-semibold leading-none">Amigos</span>
            </button>

            {/* Perfil */}
            <button
              type="button"
              onClick={onToggleSettings}
              className="flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground md:px-2"
            >
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt="Foto" className="w-6 h-6 rounded-full object-cover ring-2 ring-primary/25" />
              ) : (
                <User className="w-5 h-5" />
              )}
              <span className="text-[10px] font-semibold leading-none">Perfil</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="bee-honeycomb relative flex h-[82px] shrink-0 items-center justify-center overflow-hidden border-b border-primary/10 bg-gradient-to-b from-primary/10 to-transparent md:h-[70px]">
          <div style={{ transform: "scale(0.6)", transformOrigin: "center center", marginTop: -8 }}>
            <BeeEyes
              expression={eyeExpression}
              event={eyeEvent}
              inputFocused={eyeInputFocused}
              isTyping={eyeIsTyping}
              scrollProgress={eyeScrollProgress}
              engagementLevel={eyeEngagementLevel}
            />
          </div>
          <button type="button" onClick={onToggleSearch} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-card/70 shadow-xs hover:bg-primary/10 transition-colors" aria-label="Buscar mensagens">
            <Search size={18} className="text-muted-foreground" />
          </button>
        </div>

        {showMsgSearch && (
          <div className="shrink-0 px-4 py-2 border-b border-border/60 bg-card/70 backdrop-blur flex items-center gap-2">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <input autoFocus type="text" value={msgSearchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Buscar nas mensagens..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            {msgSearchQuery && <button type="button" onClick={() => onSearchQueryChange("")} className="text-muted-foreground hover:text-foreground">Limpar</button>}
            <span className="text-xs text-muted-foreground shrink-0">{msgSearchQuery ? `${visibleMessages.length} resultado(s)` : ""}</span>
          </div>
        )}

        <div ref={chatScrollRef} className="bee-honeycomb flex-1 overflow-y-auto px-6 pb-52 pt-4 md:bg-none md:p-6 space-y-3 beeyes-scrollbar" onScroll={onScrollStateChange}>
          <div className="flex justify-center md:hidden">
            <span className="rounded-full bg-card/80 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm ring-1 ring-border/60 backdrop-blur">
              Hoje, 10:24
            </span>
          </div>
          <AnimatePresence mode="popLayout">
            {visibleMessages.map((message) => (
              <ChatMessage key={message.id} role={message.role} content={message.content} timestamp={message.timestamp} actions={messageActionsRenderer(message)} profilePhotoUrl={profilePhotoUrl} />
            ))}
            {streamingText && <ChatMessage key="streaming" role="assistant" content={`${streamingText}▌`} timestamp={new Date()} />}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>

        <div className="fixed bottom-[120px] left-3 right-3 z-20 border-primary/10 bg-transparent p-0 md:static md:border-t md:p-4 md:beeyes-glass-light md:dark:beeyes-glass shrink-0 pb-safe">
          {transcriptionError && (
            <p className="max-w-4xl mx-auto mb-2 text-xs text-destructive">
              Não consegui entender o áudio. Fale mais alto ou por mais tempo e tente novamente.
            </p>
          )}
          <div className="mx-auto flex max-w-4xl gap-2 rounded-full border border-primary/20 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              onFocus={() => onInputFocusChange(true)}
              onBlur={() => onInputFocusChange(false)}
              onKeyDown={(event) => event.key === "Enter" && onSendMessage()}
              placeholder="Digite sua mensagem..."
              className="flex-1 border-transparent bg-transparent shadow-none focus-visible:bg-card/80 rounded-full"
              disabled={isLoading}
              autoFocus
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleMicToggle}
              size="icon"
              variant={isRecording ? "destructive" : "outline"}
              disabled={isLoading || isTranscribing}
              title={isRecording ? "Parar gravação" : "Enviar áudio"}
            >
              {isTranscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
            <Button onClick={onSendMessage} size="icon" disabled={isLoading} data-testid="button-send-message">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
