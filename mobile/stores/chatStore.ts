import { create } from "zustand";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  metadata?: string | null;
  repliedToMessageId?: string | null;
  repliedToMessageContent?: string | null;
  repliedToMessageRole?: "user" | "assistant" | null;
  repliedToMessageCreatedAt?: string | null;
}

interface ChatState {
  messages: Message[];
  isTyping: boolean;
  streamingContent: string;
  setMessages: (messages: Message[]) => void;
  addMessage: (msg: Message) => void;
  setIsTyping: (v: boolean) => void;
  appendStream: (chunk: string) => void;
  finalizeStream: (finalContent: string, metadata?: string | null, id?: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isTyping: false,
  streamingContent: "",

  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => (
    s.messages.some((message) => message.id === msg.id)
      ? s
      : { messages: [...s.messages, msg] }
  )),
  setIsTyping: (v) => set({ isTyping: v }),
  appendStream: (chunk) => set((s) => ({ streamingContent: s.streamingContent + chunk })),
  finalizeStream: (finalContent, metadata = null, id) =>
    set((s) => ({
      streamingContent: "",
      isTyping: false,
      messages: [
        ...s.messages,
        {
          id: id ?? Date.now().toString(),
          role: "assistant",
          content: finalContent,
          createdAt: new Date().toISOString(),
          metadata,
        },
      ],
    })),
}));
