import { create } from "zustand";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ChatState {
  messages: Message[];
  isTyping: boolean;
  streamingContent: string;
  setMessages: (messages: Message[]) => void;
  addMessage: (msg: Message) => void;
  setIsTyping: (v: boolean) => void;
  appendStream: (chunk: string) => void;
  finalizeStream: (finalContent: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isTyping: false,
  streamingContent: "",

  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setIsTyping: (v) => set({ isTyping: v }),
  appendStream: (chunk) => set((s) => ({ streamingContent: s.streamingContent + chunk })),
  finalizeStream: (finalContent) =>
    set((s) => ({
      streamingContent: "",
      isTyping: false,
      messages: [
        ...s.messages,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: finalContent,
          createdAt: new Date().toISOString(),
        },
      ],
    })),
}));
