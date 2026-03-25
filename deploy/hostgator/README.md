# Deploy em HostGator (sem Node) — BeeEyesAI

Este pacote permite hospedar o frontend (Vite/React) como um site estático no HostGator e, opcionalmente, usar um backend PHP com MySQL (compartilhado) para APIs básicas.

Resumo do projeto atual:
- `client/`: Vite + React (SPA). Não encontrei chamadas de API ativas no código do cliente.
- `server/`: Express + Vite para dev/serve; não roda em HostGator compartilhado.
- `shared/schema.ts`: schema Drizzle apontando para PostgreSQL (pg-core). HostGator oferece MySQL.

Opções de hospedagem:
- Opção A (recomendada agora): Hospedar apenas o frontend estático aqui no HostGator e manter backend ausente (já que o cliente não chama API). Se futuramente precisar de backend, criar endpoints PHP neste host ou usar um serviço externo.
- Opção B: Usar o backend PHP incluído neste pacote (`deploy/hostgator/api/`) e o esquema MySQL (`deploy/hostgator/mysql_schema.sql`).

Passo a passo (SPA estática):
1) Build local: `npm ci && npm run build`
   - O build gera arquivos estáticos em `dist/public` (conforme `vite.config.ts`).
2) No HostGator (cPanel):
   - Se publicar no root: envie o conteúdo de `dist/public` para `public_html/` e use `deploy/hostgator/.htaccess` no root.
   - Se publicar em subpasta (ex.: `public_html/bee-eyes/`): envie o conteúdo de `dist/public` para essa pasta e use `deploy/hostgator/subdir.htaccess` como `public_html/bee-eyes/.htaccess`.
3) A SPA funcionará como site estático (roteamento client-side via `.htaccess`).

Backend PHP opcional (se precisar de API + MySQL):
1) Crie um banco de dados MySQL no cPanel e um usuário com permissões.
2) Importe `deploy/hostgator/mysql_schema.sql` no phpMyAdmin para criar as tabelas.
3) Se `public_html/api/` já existir e não puder ser alterada, use outro path, por exemplo `public_html/beeeyes_api/` e faça upload dos arquivos de `deploy/hostgator/api/` para lá.
4) Edite `public_html/beeeyes_api/config.php` (ou o caminho que usou) e preencha credenciais MySQL.
5) Garanta que `public_html/.htaccess` contenha as regras de reescrita (já incluso neste pacote); ele já ignora `/api/` e `/beeeyes_api/` para não reescrever em `index.html`.

URLs de teste (PHP API):
- `GET /api/health.php` → verificação simples.
- `POST /api/users.php` com JSON `{"username":"foo","password":"bar"}` → cria usuário.
- `GET /api/users.php?username=foo` → retorna usuário por username.
- `POST /api/messages.php` `{ userId, role, content }` → cria mensagem.
- `GET /api/messages.php?userId=...` ou `?id=...` → lista/busca mensagens.
- `POST /api/missions.php` `{ userId, title, description?, xpReward? }` → cria missão.
- `GET /api/missions.php?userId=...&completed=true|false` ou `?id=...` → lista/busca missões.
- `PUT /api/missions.php?id=...` body `{ completed: true|false }` → marca concluída.
- `POST /api/mood_entries.php` `{ userId, mood, note? }` → cria entrada de humor.
- `GET /api/mood_entries.php?userId=...` ou `?id=...` → lista/busca entradas.
- `POST /api/achievements.php` `{ userId, type, title, description }` → cria conquista.
- `GET /api/achievements.php?userId=...` ou `?id=...` → lista/busca conquistas.

Caso tenha usado `beeeyes_api/` (ou outro nome):
- Substitua `/api/` por `/<sua_pasta_api>/` nas URLs acima, ex.: `GET /beeeyes_api/health.php`.


Observações importantes:
- O schema Drizzle atual é para PostgreSQL; para HostGator/MySQL, use o SQL em `mysql_schema.sql` (tipos e defaults ajustados) e os endpoints PHP.
- Se futuramente quiser manter Node/Express, será necessário um VPS/Cloud ou outro provedor que suporte Node. Neste caso, a SPA ainda pode ficar no HostGator e apontar as chamadas de API para outro domínio/subdomínio.
- O `vite.config.ts` usa `base: './'` para que os assets carreguem corretamente quando a SPA estiver em uma subpasta (ex.: `/bee-eyes/`).
