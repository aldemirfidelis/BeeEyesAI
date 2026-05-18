import ChatScreen from "../../features/chat/screens/ChatScreen";
import { BeeHouseDrawer } from "../../components/BeeHouseDrawer";

/**
 * Tela inicial = Chat com a Bee envolvido por BeeHouseDrawer.
 *
 * O drawer mostra um botão handle (casinha com Bee) flutuando à direita do chat.
 * Tap ou arrasta pra esquerda → Casa da Bee desliza por cima do chat.
 * Arrasta da borda esquerda da casa pra direita ou toca no chevron-right → fecha.
 */
export default function ChatHome() {
  return (
    <BeeHouseDrawer>
      <ChatScreen />
    </BeeHouseDrawer>
  );
}
