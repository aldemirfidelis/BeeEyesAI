# Casa da Bee

## Objetivo

A Casa da Bee nasce como um modulo de jogo mobile separado do app principal. O app BeeEyes continua cuidando de chat, feed, Colmeia, perfil, calendario, saude, anuncios e demais telas. O Unity fica responsavel apenas pelo mundo interativo da Bee: personagem, casa, moveis, roupas, estado visual das tarefas da IA, minigames e visitas futuras.

Esta entrega cria a base tecnica para a primeira versao jogavel:

- projeto Unity independente em `unity/CasaDaBee`;
- cena prototype em `Assets/CasaDaBee/Scenes/CasaDaBeePrototype.unity`;
- Bee 2D andando por toque/click, com asas animadas;
- balao de fala acima da Bee;
- sala isometrica inicial com estacoes de trabalho;
- ponte `BeeHouseBridge` para receber eventos do app/backend;
- tabelas Drizzle/Postgres para perfil, casa, inventario, catalogo, roupas, moedas, missoes, tarefas da IA e visitas;
- API `/api/bee-house/*`;
- shell mobile `mobile/app/casa-da-bee.tsx` para abrir o modulo Unity quando o bridge nativo existir;
- bridge nativo Android `BeeHouseUnity` com fallback seguro quando o Unity ainda nao foi exportado;
- integracao inicial com o chat via `mobile/hooks/useChat.ts`.

## Decisao arquitetural

O caminho recomendado e **Unity as a Library** dentro do app mobile existente. A documentacao oficial da Unity descreve esse modo como a forma de integrar conteudo 2D/3D em apps nativos Android/iOS, com controle de carregar, ativar e descarregar o runtime. A propria Unity tambem informa duas limitacoes importantes: renderizacao full-screen e apenas uma instancia do runtime por processo.

Como o mobile atual usa Expo SDK 55, React Native 0.83 e ja possui `mobile/android`, a Casa da Bee deve seguir um fluxo de development build/prebuild, nao Expo Go. A documentacao oficial da Expo recomenda development builds e Expo Modules API para codigo nativo proprio; alteracoes diretas nos diretorios nativos devem virar config plugin/local module quando forem estabilizadas.

Fontes oficiais usadas:

- Unity as a Library: https://docs.unity.cn/2021.1/Documentation/Manual/UnityasaLibrary.html
- Unity Android integration: https://docs.unity.cn/2021.1/Documentation/Manual/UnityasaLibrary-Android.html
- Unity iOS integration: https://docs.unity.cn/2021.1/Documentation/Manual/UnityasaLibrary-iOS.html
- Expo custom native code: https://docs.expo.dev/workflow/customizing/
- Expo native module tutorial: https://docs.expo.dev/modules/native-module-tutorial/

## Estrutura criada

```text
docs/casa-da-bee/
  README.md

unity/CasaDaBee/
  Packages/manifest.json
  ProjectSettings/ProjectVersion.txt
  Assets/CasaDaBee/
    Scenes/CasaDaBeePrototype.unity
    Scripts/
      BeeAgentController.cs
      BeeHouseBridge.cs
      BeeHouseModels.cs
      BeeHousePrototypeBootstrap.cs
      IsoGridController.cs
      SpeechBubbleController.cs
      SpriteFactory.cs
    Editor/
      CasaDaBeeSceneCreator.cs

shared/
  bee-house.ts
  schema.ts

server/routes/
  bee-house.ts

mobile/
  app/casa-da-bee.tsx
  services/beeHouseService.ts
```

## Como rodar o prototipo Unity

1. Abra o Unity Hub.
2. Adicione o projeto `unity/CasaDaBee`.
3. Abra a cena `Assets/CasaDaBee/Scenes/CasaDaBeePrototype.unity`.
4. Pressione Play.
5. Toque/click em qualquer ponto da sala para mover a Bee.
6. Use os botoes `Pesquisa`, `Treino`, `Agenda`, `Concluir` e `Erro` para simular estados da IA.

Se a cena perder referencia do script em alguma versao do Unity, use o menu:

```text
Casa da Bee > Recreate Prototype Scene
```

Para exportar o modulo Android pelo Unity Editor, use:

```text
Casa da Bee > Export Android unityLibrary
```

Ou em batchmode, ajustando o caminho do executavel Unity:

```powershell
Unity.exe -batchmode -quit -projectPath unity/CasaDaBee -executeMethod CasaDaBee.EditorTools.CasaDaBeeAndroidExporter.ExportAndroidLibrary
```

O export vai para `mobile/android/unity-export`.

## Contrato app/backend/Unity

O app mobile cria uma tarefa visual quando o usuario manda uma mensagem no chat:

```ts
POST /api/bee-house/tasks
{
  "taskType": "research",
  "promptSnippet": "pesquise sobre...",
  "payload": { "origin": "chat" }
}
```

Durante o stream da IA, o app atualiza o status:

```ts
PATCH /api/bee-house/tasks/:id
{
  "status": "searching",
  "progress": 35
}
```

Estados suportados:

```text
idle, processing, searching, generating, completed, failed
```

Estados visuais da Bee:

```text
idle, walking, speaking, thinking, working, researching,
happy, tired, sleeping, confused, celebrating
```

O Unity recebe o mesmo payload como JSON no objeto:

```text
GameObject: BeeHouseBridge
Metodo: ApplyTaskStatus(string json)
```

Exemplo:

```json
{
  "id": "task-id",
  "taskType": "research",
  "status": "searching",
  "beeState": "researching",
  "targetStation": "computer",
  "speechText": "Estou pesquisando isso para voce!",
  "progress": 35
}
```

Mapeamento inicial:

| Tipo de tarefa | Estacao |
| --- | --- |
| `research` | `computer` |
| `fitness` | `fitness` |
| `calendar` | `calendar` |
| `study` | `library` |
| `shopping` | `desk` |
| `general` | `desk` |

## Banco de dados

Migration criada: `migrations/0013_bee_house.sql`.

Tabelas:

- `bee_profiles`: estado, XP, nivel, Polen, Mel Premium e roupa equipada.
- `bee_rooms`: comodos, tamanho da grade, piso e papel de parede.
- `bee_items`: catalogo global de moveis, decoracoes, pisos, papeis e efeitos.
- `bee_user_inventory`: itens do usuario.
- `bee_room_layouts`: posicao X/Y, rotacao e camada dos moveis.
- `bee_outfits`: catalogo de roupas.
- `bee_user_outfits`: roupas possuidas/equipadas.
- `bee_currency_transactions`: trilha de economia.
- `bee_missions` e `bee_user_missions`: base para missoes.
- `bee_ai_tasks`: tarefas da IA refletidas visualmente no Unity.
- `bee_house_visits`: visita assincrona futura.

## API criada

- `GET /api/bee-house/bootstrap`: cria defaults e retorna snapshot completo.
- `GET /api/bee-house/tasks/active`: retorna tarefa visual em andamento.
- `POST /api/bee-house/tasks`: cria tarefa da IA.
- `PATCH /api/bee-house/tasks/:id`: atualiza status visual da tarefa.
- `POST /api/bee-house/layouts`: posiciona item do inventario na grade.
- `DELETE /api/bee-house/layouts/:id`: remove item posicionado.
- `POST /api/bee-house/outfits/:outfitId/equip`: equipa roupa.
- `POST /api/bee-house/shop/purchase`: compra item ou roupa.
- `GET /api/bee-house/visits/:ownerUserId`: visita assincrona inicial.

## Integracao mobile

`mobile/app/casa-da-bee.tsx` carrega o bootstrap da casa e chama o modulo nativo Android `BeeHouseUnity`.

Contrato esperado do bridge nativo:

```ts
type BeeHouseUnity = {
  isAvailable(): Promise<boolean> | boolean;
  openHouse(payload: string): Promise<boolean> | boolean;
  sendTask(payload: string): Promise<boolean> | boolean;
};
```

Arquivos Android adicionados:

```text
mobile/android/app/src/main/java/com/beeeyes/ai/bee/house/
  BeeHouseUnityModule.kt
  BeeHouseUnityPackage.kt
```

O modulo usa reflexao para procurar `com.unity3d.player.UnityPlayer` e `com.unity3d.player.UnityPlayerActivity`. Isso permite compilar o app antes do Unity ser exportado. Sem `unityLibrary`, `openHouse` retorna `false` e a tela mostra o fallback. Com `unityLibrary`, `openHouse` abre a Activity Unity e agenda o envio do snapshot para:

```text
UnityPlayer.UnitySendMessage("BeeHouseBridge", "ApplyHouseSnapshot", payload)
```

Atualizacoes de tarefa chamam:

```text
UnityPlayer.UnitySendMessage("BeeHouseBridge", "ApplyTaskStatus", payload)
```

## Proxima etapa nativa

Android:

1. Exportar o projeto Unity como Android Gradle project pelo menu `Casa da Bee > Export Android unityLibrary`.
2. Confirmar que o modulo gerado existe em `mobile/android/unity-export/unityLibrary`.
3. Conferir se o export contem `com.unity3d.player.UnityPlayerActivity`.
4. Rodar `cd mobile && npm run android` ou `cd mobile/android && ./gradlew assembleDebug`.
5. Abrir a Casa da Bee pela Colmeia.

O Gradle ja esta preparado de forma condicional:

- `mobile/android/settings.gradle` inclui `:unityLibrary` somente se `mobile/android/unity-export/unityLibrary` existir.
- `mobile/android/app/build.gradle` adiciona `implementation project(":unityLibrary")` somente se o modulo existir.

iOS:

1. Exportar o projeto Unity como Xcode project.
2. Integrar `UnityFramework.framework` no workspace nativo.
3. Criar modulo Swift Expo `BeeHouseUnityModule`.
4. Usar `UnityFramework` para `runEmbeddedWithArgc`, `showUnityWindow`, `pause` e envio de mensagens.

## Performance mobile

Regras para manter a Casa da Bee leve:

- usar sprites atlasados e comprimidos;
- carregar comodos/minigames sob demanda;
- manter a primeira sala com poucos draw calls;
- evitar multiplas cameras e pos-processamento pesado;
- limitar animacoes simultaneas;
- descarregar assets de loja/minigames quando sair da cena;
- medir FPS em Android intermediario antes de liberar;
- usar Unity full-screen e pausar quando o app principal voltar ao foco.

## Limitacoes atuais

- O Unity Editor nao esta instalado neste ambiente, entao a cena nao foi executada localmente.
- O modulo nativo `BeeHouseUnity` ainda nao foi criado; a tela mobile ja espera esse contrato.
- O prototipo usa sprites gerados em runtime, nao arte final.
- O catalogo e seedado pela API no primeiro bootstrap.
- Multiplayer em tempo real nao foi implementado; a tabela de visitas suporta o primeiro passo assincrono.

## Proximos passos

1. Validar a cena no Unity Editor e ajustar escala da camera em celulares reais.
2. Criar o bridge nativo Android via local Expo Module.
3. Exportar Unity como `unityLibrary` e testar `openHouse`.
4. Persistir mudancas de layout feitas dentro do Unity.
5. Trocar sprites runtime por asset pipeline 2D isometrico.
6. Adicionar guarda-roupa visual com troca real de partes da Bee.
7. Implementar loja visual e primeiro minigame.
8. Criar snapshot publico para visita assincrona de casas.
