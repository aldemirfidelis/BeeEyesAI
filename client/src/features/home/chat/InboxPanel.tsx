import type { RefObject } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionSuggestion, DMConversation, DMMessage, User } from "@/features/home/types";

interface InboxPanelProps {
  user: User | null;
  selectedDMUser: { id: string; username: string; displayName: string | null; level: number } | null;
  dmMessages: DMMessage[];
  dmInput: string;
  dmSending: boolean;
  dmLoading: boolean;
  dmConversations: DMConversation[];
  suggestions: ConnectionSuggestion[];
  dmEndRef: RefObject<HTMLDivElement>;
  onBack: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onOpenThread: (target: { id: string; username: string; displayName: string | null; level: number }) => void;
  timeAgo: (value: string | Date) => string;
}

export function InboxPanel(props: InboxPanelProps) {
  const { user, selectedDMUser, dmMessages, dmInput, dmSending, dmLoading, dmConversations, suggestions, dmEndRef, onBack, onInputChange, onSend, onOpenThread, timeAgo } = props;

  if (selectedDMUser) {
    return (
      <div className="absolute inset-0 flex flex-col min-h-0 bg-background z-10">
        <div className="p-3 border-b flex items-center gap-2 bg-card/40 shrink-0">
          <button onClick={onBack} className="p-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            Voltar
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
            {(selectedDMUser.displayName || selectedDMUser.username)[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{selectedDMUser.displayName || selectedDMUser.username}</p>
            <p className="text-xs text-muted-foreground">Nível {selectedDMUser.level}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {dmMessages.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Envie a primeira mensagem desta conversa.</p>}
          {dmMessages.map((message) => {
            const fromMe = message.senderId === user?.id;
            return (
              <div key={message.id} className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${fromMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary/70 rounded-bl-sm"}`}>
                  {message.content}
                </div>
              </div>
            );
          })}
          <div ref={dmEndRef} />
        </div>

        <div className="p-3 border-t flex items-end gap-2 bg-card/40 shrink-0">
          <Textarea
            value={dmInput}
            onChange={(event) => onInputChange(event.target.value)}
            rows={1}
            placeholder="Mensagem..."
            className="flex-1 resize-none text-sm min-h-[40px] max-h-28"
            maxLength={1500}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            data-testid="dm-input"
          />
          <Button size="icon" onClick={onSend} disabled={!dmInput.trim() || dmSending} className="shrink-0 h-9 w-9" data-testid="dm-send-button">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <div className="p-3 border-b shrink-0">
        <h2 className="font-display text-lg font-semibold">Mensagens</h2>
        <p className="text-xs text-muted-foreground mt-1">Conversas privadas com contexto e continuidade.</p>
      </div>

      {suggestions.length > 0 && (
        <div className="p-3 border-b shrink-0 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Sugestões</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {suggestions.slice(0, 5).map((suggestion) => (
              <button
                key={`sug-${suggestion.id}`}
                onClick={() => onOpenThread({ id: suggestion.id, username: suggestion.username, displayName: suggestion.displayName, level: suggestion.level })}
                className="flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-secondary/50 transition-colors w-14"
              >
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                  {(suggestion.displayName || suggestion.username)[0].toUpperCase()}
                </div>
                <p className="text-[10px] text-center leading-tight truncate w-full">{suggestion.displayName || suggestion.username}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {dmLoading && <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>}
        {!dmLoading && dmConversations.length === 0 && (
          <div className="text-center py-10 px-4 space-y-2">
            <p className="text-2xl">💬</p>
            <p className="text-sm font-semibold">Nenhuma conversa ainda</p>
            <p className="text-xs text-muted-foreground">Conecte-se com pessoas e inicie uma conversa.</p>
          </div>
        )}
        {dmConversations.map((conversation) => {
          const name = conversation.user.displayName || conversation.user.username;
          return (
            <button
              key={conversation.user.id}
              onClick={() => onOpenThread(conversation.user)}
              className="w-full text-left px-3 py-3 hover:bg-secondary/50 transition-colors border-b border-border/40 flex items-center gap-3"
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-black text-primary-foreground">
                  {name[0].toUpperCase()}
                </div>
                {conversation.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className={`text-sm truncate ${conversation.unreadCount > 0 ? "font-bold" : "font-semibold"}`}>{name}</p>
                  <p className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conversation.lastMessageAt)}</p>
                </div>
                <p className={`text-xs truncate ${conversation.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {conversation.lastMessageFromMe ? "Você: " : ""}{conversation.lastMessage}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
