import ChatMessage from "../ChatMessage";

export default function ChatMessageExample() {
  return (
    <div className="max-w-2xl p-4 space-y-4">
      <ChatMessage
        role="assistant"
        content="Olá! Sou o bee-eyes, seu assistente pessoal! Como posso te ajudar hoje? 🐝"
        timestamp={new Date()}
      />
      <ChatMessage
        role="user"
        content="Quero criar uma rotina matinal saudável"
        timestamp={new Date()}
      />
      <ChatMessage
        role="assistant"
        content="Que ótimo objetivo! Vou criar algumas missões para você começar sua rotina matinal. Que tal começarmos com beber água ao acordar?"
        timestamp={new Date()}
      />
    </div>
  );
}
