# Lista de Desejos da Bee

## Objetivo

A ferramenta "Lista de Desejos" permite que o usuário salve anúncios, produtos, serviços, cursos ou recomendações que achou interessantes, organize esses itens por categoria/status e mantenha controle sobre os interesses usados pela Bee para personalização.

## Onde a ferramenta aparece

- Web: Colmeia > Lista de Desejos.
- Mobile: Colmeia > Lista de Desejos.
- Cards patrocinados web e mobile: botão "Adicionar à Lista de Desejos".

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `shared/wishlist.ts` | Categorias, status, eventos, palavras sensíveis e helpers compartilhados. |
| `server/routes/wishlist.ts` | API autenticada da Lista de Desejos, interesses, preferências, exportação e eventos. |
| `migrations/0006_wishlist.sql` | Migração SQL das tabelas `wishlist_items`, `user_interests`, `wishlist_events` e `wishlist_preferences`. |
| `client/src/features/home/colmeia/WishlistSection.tsx` | Tela web da Lista de Desejos dentro da Colmeia. |
| `mobile/features/colmeia/screens/WishlistSection.tsx` | Tela mobile da Lista de Desejos dentro da Colmeia. |
| `client/public/icons-colmeia/lista-desejos.png` | Ícone web da ferramenta. |
| `mobile/assets/icons-colmeia/lista-desejos.png` | Ícone mobile da ferramenta. |
| `icons-colmeia/lista-desejos.png` | Cópia raiz do ícone. |
| `beeyes-design/public/images/lista-desejos.png` | Cópia para o pacote visual/design. |

## Arquivos alterados

| Arquivo | Alteração |
| --- | --- |
| `shared/schema.ts` | Adiciona schemas Drizzle e tipos das tabelas de wishlist, interesses, eventos e preferências. |
| `server/db.ts` | Garante criação compatível das novas tabelas e índices em ambientes sem migração aplicada. |
| `server/routes/index.ts` | Registra as rotas `/api/wishlist`. |
| `client/src/features/home/colmeia/ColmeiaPanel.tsx` | Adiciona a ferramenta à Colmeia web. |
| `mobile/features/colmeia/screens/ColmeiaScreen.tsx` | Adiciona a ferramenta à Colmeia mobile. |
| `client/src/components/SponsoredChatCard.tsx` | Adiciona botão para salvar anúncio na Lista de Desejos. |
| `mobile/components/SponsoredChatCard.tsx` | Adiciona botão para salvar anúncio na Lista de Desejos. |

## Banco de dados

### `wishlist_items`

Armazena os itens salvos pelo usuário.

Campos principais: `user_id`, `source_ad_id`, `product_id`, `title`, `description`, `image_url`, `original_url`, `category`, `price_cents`, `currency`, `brand`, `store_name`, `status`, `personal_note`, `interest_score`, `priority`, `source_type`, `metadata`, `created_at`, `updated_at`, `purchased_at`, `removed_at`.

### `user_interests`

Armazena interesses identificados a partir de ações explícitas do usuário.

Campos principais: `user_id`, `interest_name`, `category`, `score`, `source`, `active`, `created_at`, `updated_at`.

### `wishlist_events`

Registra eventos úteis para auditoria e personalização responsável.

Eventos: `added_to_wishlist`, `removed_from_wishlist`, `marked_as_interested`, `marked_as_purchased`, `note_added`, `category_changed`, `opened`, `shared`, `recommendation_clicked`, `personalization_disabled`, `interests_cleared`, `wishlist_cleared`.

### `wishlist_preferences`

Preferências de controle do usuário.

Campos: `allow_personalized_recommendations`, `allow_price_alerts`, `allow_bee_notifications`, `show_recommendation_reasons`.

## API

Todas as rotas exigem autenticação.

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/api/wishlist` | Retorna itens, interesses, preferências, recomendações, categorias e status. |
| `GET` | `/api/wishlist/items` | Lista itens com busca, categoria, status, preço e ordenação. |
| `POST` | `/api/wishlist/items` | Salva um novo item e evita duplicidade por anúncio, produto ou URL. |
| `GET` | `/api/wishlist/items/:id` | Retorna um item e registra abertura. |
| `PATCH` | `/api/wishlist/items/:id` | Atualiza categoria, status, observação, prioridade e campos editáveis. |
| `DELETE` | `/api/wishlist/items/:id` | Remove um item via soft delete. |
| `DELETE` | `/api/wishlist/items` | Apaga toda a lista do usuário via soft delete. |
| `GET` | `/api/wishlist/interests` | Lista interesses ativos. |
| `PATCH` | `/api/wishlist/interests/:id` | Edita interesse, categoria ou ativação. |
| `DELETE` | `/api/wishlist/interests/:id` | Desativa um interesse. |
| `POST` | `/api/wishlist/interests/clear` | Desativa todos os interesses. |
| `GET` | `/api/wishlist/settings` | Retorna preferências. |
| `PATCH` | `/api/wishlist/settings` | Atualiza controles de personalização, alertas e notificações. |
| `GET` | `/api/wishlist/export` | Exporta itens, interesses, eventos e preferências em JSON. |

## Fluxo principal

1. O usuário vê um anúncio ou recomendação.
2. O usuário clica em "Adicionar à Lista de Desejos".
3. O app envia os dados para `POST /api/wishlist/items`.
4. A API valida e normaliza categoria/status.
5. Se o item já existir, a API retorna a mensagem de duplicidade.
6. Se for novo, a API salva o item, registra evento e atualiza interesses não sensíveis.
7. A interface exibe feedback amigável da Bee.
8. O usuário acessa a ferramenta na Colmeia para buscar, filtrar, editar status, adicionar observação, compartilhar, comparar ou remover.

## Privacidade e controle

- A personalização é baseada apenas em itens salvos voluntariamente, categorias e interações explícitas.
- Interesses sensíveis são filtrados por palavras-chave e não são usados para perfil.
- O usuário pode desativar recomendações personalizadas.
- O usuário pode limpar interesses identificados.
- O usuário pode apagar toda a lista.
- O usuário pode exportar os dados.
- As recomendações exibem motivo explicável.

## Funcionalidades implementadas

- Botão "Adicionar à Lista de Desejos" em anúncio patrocinado web/mobile.
- Tela web e mobile dentro da Colmeia.
- Categorias padrão.
- Status dos itens.
- Busca.
- Filtro por categoria, status, preço e ordenação na web.
- Detalhes do item.
- Observação pessoal.
- Remover item.
- Compartilhar item.
- Marcar como "Tenho interesse", "Já comprei" ou "Não tenho mais interesse".
- Área "Meus interesses".
- Controles de personalização, alertas e notificações.
- Limpar interesses.
- Apagar lista.
- Exportar dados na web.
- Recomendações relacionadas explicáveis.
- Estrutura visual para comparador e alertas inteligentes.
- Estrutura de eventos para personalização futura.

## Melhorias futuras

- Conectar alertas reais de preço/estoque a provedores externos.
- Implementar comparação avançada com avaliação, benefícios e melhor custo-benefício.
- Adicionar listas compartilháveis públicas/privadas.
- Integrar a área "Pergunte para a Bee" com o serviço de IA usando apenas dados da lista.
- Permitir edição manual completa de categoria/status no mobile.
- Adicionar testes automatizados para rotas e componentes principais.

## Como testar

1. Rodar `npm run check`.
2. Entrar no app com usuário autenticado.
3. Abrir um anúncio patrocinado e clicar em "Adicionar à Lista de Desejos".
4. Abrir Colmeia > Lista de Desejos.
5. Verificar item salvo, filtros, detalhes, observação, status, remoção e exportação.
6. No mobile, abrir Colmeia > Lista de Desejos e repetir o fluxo básico.

