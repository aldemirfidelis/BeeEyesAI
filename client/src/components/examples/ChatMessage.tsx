import ChatMessage from "../ChatMessage";

export default function ChatMessageExample() {
  return (
    <div className="max-w-2xl p-4 space-y-4">
      <ChatMessage
        role="assistant"
        content="OlÃ¡! Sou o bee-eyes, seu assistente pessoal! Como posso te ajudar hoje? ðŸ"
        timestamp={new Date()}
      />
      <ChatMessage
        role="user"
        content="Quero criar uma rotina matinal saudÃ¡vel"
        timestamp={new Date()}
      />
      <ChatMessage
        role="assistant"
        content="Que Ã³timo objetivo! Vou criar algumas missÃµes para vocÃª comeÃ§ar sua rotina matinal. Que tal comeÃ§armos com beber Ã¡gua ao acordar?"
        timestamp={new Date()}
      />
    </div>
  );
}
