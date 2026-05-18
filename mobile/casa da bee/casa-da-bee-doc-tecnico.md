# Casa da Bee — Documento Técnico (Primeira Entrega)

## 1. Decisão de arquitetura: por que NÃO Unity

O spec assume Unity, mas para uma casa social **2D isométrica** (estilo Habbo) com móveis,
roupas e estados de personagem, Unity é o maior gerador de complexidade e quase não
agrega valor:

| Critério | Unity (UaaL) | WebView + Phaser 3 |
|---|---|---|
| Tamanho do app | +60–100 MB | +0 (WebView nativa) |
| Cold start | Lento (carrega engine) | Instantâneo |
| Integração Expo | Exige **bare workflow** + módulo nativo frágil | `react-native-webview` (dev build, **sem eject**) |
| Atualizar conteúdo | Novo release na Play Store | Trocar arquivo no servidor |
| Skills necessárias | C# + RN + 2 pipelines | Só web (que você já domina) |
| Adequação 2D iso | Engine 3D subutilizada | Feita exatamente pra isso |

**Recomendação:** Casa da Bee = jogo **Phaser 3** rodando numa `<WebView>` dentro do app
Expo atual. Unity ficaria justificável só com 3D real ou física pesada — não é o caso.

## 2. Arquitetura geral

```
App Expo (React Native)
 ├─ Chat / Feed / Colmeia / Perfil / Calendário / Saúde   (inalterado)
 └─ Tela "Casa da Bee"
      └─ <WebView source={{uri: 'https://seu-server/casa-da-bee'}} />
            └─ Jogo Phaser 3 (sala iso, Bee, balão, loja, estados)

Ponte (postMessage, JSON):
  RN  →  WebView : webViewRef.injectJavaScript('window.beeBridge.setState(...)')
  WebView →  RN  : window.ReactNativeWebView.postMessage(JSON)

Backend existente (Postgres / Neon)
  - tarefas da IA, inventário, layout da casa, moedas, XP
```

O jogo é **hospedado no servidor** (atualização remota de móveis/roupas sem release).
Opcional: empacotar uma cópia local como fallback offline.

## 3. Integração com Expo (sem bare workflow)

1. `npx expo install react-native-webview`
2. Criar **dev build** com EAS (`eas build --profile development`) — não precisa ejetar.
3. Tela da Casa:

```jsx
const webRef = useRef(null);

// RN → jogo (quando o chat dispara uma tarefa)
function pushTask(target) {
  webRef.current.injectJavaScript(
    `window.beeBridge.setState(${JSON.stringify({type:'ai_task', target, status:'start'})}); true;`
  );
}

// jogo → RN (ack, conclusão, recompensa)
<WebView ref={webRef}
  source={{ uri: 'https://seu-server/casa-da-bee' }}
  onMessage={e => {
    const msg = JSON.parse(e.nativeEvent.data);
    // {type:'task_done', target:'search', reward:12} → creditar pólen no backend
  }}
/>
```

**Contrato da ponte** (já implementado no protótipo):

| Direção | Payload |
|---|---|
| RN → jogo | `{type:'ai_task', target:'search\|train\|calendar\|study\|sleep', status:'start'}` |
| jogo → RN | `{type:'task_ack', target, status:'processing'}` |
| jogo → RN | `{type:'task_done', target, status:'completed', reward:N}` |

Na Fase 1 o RN só repassa o status (ele já é dono do chat). WebSocket/SSE só quando
houver multiplayer.

## 4. Estados da Bee (máquina de estados)

`idle · walking · talking · thinking · working · searching · happy · tired · sleeping ·
confused · celebrating`

Cada estado controla: animação, balão de fala e destino na casa. No protótipo já estão
ativos: idle, walking, working, happy, sleeping — e o roteamento "tarefa → estação"
(pesquisa→computador, treino→fitness, calendário→quadro, estudo→biblioteca).

## 5. Modelo de dados (Postgres)

Use o schema do spec quase como está. Simplificação útil: layout da casa como JSON.

```sql
bee_profiles(user_id PK, level, xp, polen, mel_premium, outfit_atual, created_at)
bee_rooms(id PK, user_id, tipo, papel_parede, piso, tamanho)
bee_room_layouts(room_id PK, layout_json)          -- [{item_id,x,y,rot}]
bee_items(id PK, nome, tipo, raridade, preco, asset, grid_w, grid_h, comodo, interativo)
bee_user_inventory(user_id, item_id, qtd, PRIMARY KEY(user_id,item_id))
bee_outfits(id PK, nome, categoria, asset)
bee_user_outfits(user_id, outfit_id, equipado)
bee_currency_transactions(id PK, user_id, tipo, valor, origem, criado_em)
bee_missions(id PK, titulo, tipo, recompensa_polen, recompensa_xp)
bee_user_missions(user_id, mission_id, progresso, concluida)
bee_ai_tasks(id PK, user_id, tipo, status, criado_em, concluido_em, recompensa)
bee_house_visits(id PK, visitante_id, dono_id, criado_em)  -- visita assíncrona (fase 2)
```

## 6. Economia

- **Pólen** (grátis): login diário, uso do chat, tarefas concluídas, calendário, saúde,
  feed, missões, minigames, pólen passivo (a Bee "produz" enquanto vive).
- **Mel Premium** (fase futura): moeda especial.
- **XP / Nível**: cada tarefa dá XP; nível sobe a cada `nível × 100`. Nível desbloqueia
  cômodos e itens.

## 7. Roadmap por fases

**Fase 1 (protótipo entregue — viável em semanas):**
sala isométrica, Bee andando livre + reagindo ao toque, balão de fala, máquina de
estados, ponte IA funcional, loja, móveis na grade, guarda-roupa, pólen/XP/nível,
persistência.

**Fase 2:** múltiplos cômodos (quarto, escritório, biblioteca, fitness, loja própria),
posicionamento livre de móveis com drag na grade, troca de piso/parede, missões diárias,
visita **assíncrona** a casas salvas, primeiros minigames (memória, quiz, organize a
colmeia).

**Fase 3:** multiplayer em tempo real (salas públicas, chat com balões), ranking de
casas, presentes, eventos sociais, Mel Premium / loja monetizada.

## 8. Performance mobile

Phaser ajuda naturalmente: spritesheets/atlas únicos, lazy-load por cômodo, sem física
no piso (só projeção isométrica matemática), `transparent:true` pra compor com o app,
limitar partículas, testar FPS em Android intermediário, cap de 400px de altura de
canvas reduz custo de fill. O protótipo usa formas vetoriais e emojis (zero asset
externo) — em produção, troque por um atlas otimizado da Bee.

## 9. Limitações do protótipo atual

- Pathfinding é tween em linha reta com snap de tile (não desvia de móveis). Fase 2:
  A\* simples na grade.
- Móveis aparecem em posições fixas (sem drag livre ainda).
- Personagem desenhada por formas/emoji — placeholder até a arte oficial da Bee.
- Sem cômodos múltiplos nem persistência server-side (usa storage local do cliente).
- Ponte simulada pelos botões; em produção o gatilho vem do chat real.

## 10. Próximos passos

1. Definir a arte oficial da Bee (spritesheet: idle, walk 4 direções, work, sleep, happy).
2. Subir o jogo num endpoint do seu servidor e abrir numa WebView no dev build Expo.
3. Ligar a ponte real: chat cria `bee_ai_tasks` → RN faz `injectJavaScript` → `onMessage`
   credita pólen no backend.
4. Criar as tabelas e mover a persistência do storage local para o Postgres.
5. Fase 2: cômodos + drag de móveis + missões.
