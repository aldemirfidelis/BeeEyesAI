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
      className={`mb-3 flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden shadow-sm ring-1 ${
          isUser
            ? "rounded-full bg-primary ring-primary/40"
            : "rounded-lg bg-secondary ring-primary/20 beeyes-glow"
        }`}
      >
        {isUser ? (
          profilePhotoUrl ? (
            <img src={profilePhotoUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-primary-foreground">U</span>
          )
        ) : (
          <img src="/beeyes-design/images/bee-icon.png" alt="Bee" className="h-full w-full object-cover" />
        )}
      </div>

      <div className={`flex max-w-[82%] flex-col ${isUser ? "items-end" : "items-start"} md:max-w-[70%]`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ring-1 ${
            isUser
              ? "beeyes-gradient-bg rounded-tr-md text-[#1A1A1A] shadow-lg ring-primary/20"
              : "rounded-tl-md bg-card/92 text-card-foreground shadow-lg ring-border/70 backdrop-blur"
          }`}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        </div>

        {actions ? <div className="mt-2 w-full">{actions}</div> : null}

        {timestamp && (
          <span className="mt-1 select-none px-1 text-[11px] text-muted-foreground">
            {timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </motion.div>
  );
}
