import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  actions?: ReactNode;
  profilePhotoUrl?: string;
}

export default function ChatMessage({ role, content, timestamp, actions, profilePhotoUrl }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"} mb-3`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shadow-sm ${
          isUser ? "bg-primary" : "bg-secondary"
        }`}
      >
        {isUser ? (
          profilePhotoUrl ? (
            <img src={profilePhotoUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-primary-foreground">U</span>
          )
        ) : (
          <span className="text-lg leading-none">🐝</span>
        )}
      </div>

      {/* Bubble + extras */}
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[78%]`}>
        <div
          className={`rounded-3xl px-4 py-2.5 shadow-sm ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : "bg-secondary text-secondary-foreground rounded-tl-md"
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>

        {actions ? <div className="mt-2 w-full">{actions}</div> : null}

        {timestamp && (
          <span className="text-[11px] text-muted-foreground mt-1 px-1 select-none">
            {timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </motion.div>
  );
}
