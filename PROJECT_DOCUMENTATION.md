# Documentação Completa do Projeto BeeEyesAI

Este documento fornece um mapeamento detalhado de toda a arquitetura, pastas e arquivos do projeto BeeEyesAI, explicando a responsabilidade de cada componente e como eles se integram para formar o ecossistema completo da aplicação (Web, Mobile, Servidor e Design System).

---

## 🏗 Visão Geral da Arquitetura

O projeto BeeEyesAI é um monorepo que engloba múltiplas plataformas e serviços:
- **Client (Web)**: Frontend construído com React, Vite e TypeScript.
- **Mobile**: Aplicativo móvel construído com React Native e Expo.
- **Server**: Backend em Node.js (provavelmente Express/Hono) com integração de banco de dados via Drizzle ORM.
- **Shared**: Código compartilhado (tipos, schemas de banco de dados, constantes) entre o frontend, mobile e backend.
- **Design System (`beeyes-design`)**: Biblioteca isolada para componentes de UI e identidade visual.

---

## 📂 Estrutura Raiz do Projeto (`d:\Projetos\BeeEyesAI\`)

Arquivos de configuração global que gerenciam a infraestrutura, dependências e orquestração do monorepo.

- **`.dockerignore` / `.gitignore`**: Especificam quais arquivos e pastas devem ser ignorados pelo Docker e pelo Git, respectivamente (como `node_modules`, pastas de build `dist`, chaves locais).
- **`.replit`**: Configuração específica para o ambiente Replit (caso o projeto tenha sido iniciado ou hospedado lá).
- **`atualizacoes-planilha.md`**: Documento de controle de atualizações, provavelmente relacionado a regras de negócios ou tarefas acompanhadas via planilhas.
- **`build-apk.ps1` / `build-apk.sh`**: Scripts de automação (para Windows e Linux/Mac) para gerar o build do aplicativo Android (APK).
- **`deploy.ps1` / `deploy.sh`**: Scripts de automação para orquestrar o deploy da aplicação em servidores remotos.
- **`components.json`**: Arquivo de configuração de componentes (comumente usado por bibliotecas como shadcn/ui).
- **`docker-compose.yml` & `Dockerfile`**: Arquivos para conteinerização. Permitem rodar o banco de dados e o servidor em contêineres Docker, garantindo paridade entre ambientes.
- **`drizzle.config.ts`**: Configuração do Drizzle ORM. Define onde os schemas estão (pasta `shared`) e onde as migrations devem ser geradas (pasta `migrations`).
- **`fly.toml`**: Configuração de deploy para a plataforma Fly.io (Platform as a Service).
- **`package.json` & `package-lock.json`**: Arquivo raiz do Node.js, contendo as dependências globais (workspaces, se for um monorepo nativo npm/yarn/pnpm) e scripts globais do projeto.
- **`playwright.config.ts`**: Configuração da ferramenta de testes End-to-End (E2E) Playwright.
- **`postcss.config.js` & `tailwind.config.ts`**: Configurações da engine de estilização. O TailwindCSS define o tema, cores da marca e plugins.
- **`tsconfig.json` & `vite.config.ts`**: Configurações do TypeScript (regras e caminhos) e do empacotador Vite.

---

## 📂 Design System (`/beeyes-design/`)

Pasta dedicada à construção e isolamento de componentes visuais, garantindo consistência em toda a aplicação. Possui seu próprio ciclo de desenvolvimento (`Vite`, `React`).

- **`index.html` / `package.json` / `vite.config.ts` / `tsconfig.json`**: Configurações específicas para rodar este pacote de forma independente (ex: Storybook ou showcase próprio).
- **`src/`**:
  - **`App.tsx` & `main.tsx`**: Ponto de entrada do showcase do design system.
  - **`index.css`**: CSS global contendo variáveis de design tokens (cores, fontes).
  - **`components/`**: Onde os componentes UI reutilizáveis (Botões, Inputs, Cards) são desenvolvidos.
  - **`hooks/` & `lib/`**: Lógicas de estado visual e utilitários específicos de design.

---

## 📂 Frontend Web (`/client/`)

A interface principal web do usuário. Comunica-se diretamente com o `/server` através da API compartilhada em `/shared`.

- **`index.html`**: O template base do DOM onde o React é injetado.
- **`public/`**: Assets estáticos servidos diretamente. Contém ícones de manifest (`bee-icon-192.png`), logo (`bee-logo.svg`), e o Web Manifest (`manifest.webmanifest`) transformando o site em um PWA (Progressive Web App).
- **`src/`**:
  - **`App.tsx`**: O componente raiz. Define as rotas principais (usando React Router ou similar) e os Providers (Contextos, QueryClient).
  - **`main.tsx`**: Injeta o `App.tsx` no `index.html`.
  - **`index.css`**: Estilos globais exclusivos da web, importando o Tailwind.
  - **`components/`**: Componentes específicos do cliente web (Header, Sidebar, Modais) que compõem páginas inteiras, construídos utilizando o Design System base.
  - **`features/`**: Arquitetura orientada a domínios (Domain-Driven). Cada subpasta aqui contém componentes, hooks e requisições específicas de uma feature (ex: Painel de Controle, Perfil).
  - **`hooks/`**: Custom React Hooks para consumir APIs, manipular dados ou gerenciar estado global (ex: `useAuth`, `useQuery`).
  - **`lib/`**: Utilitários web auxiliares, como formatação de datas, wrappers de requisições HTTP (axios/fetch).
  - **`pages/`**: Os componentes de Página roteáveis. Cada arquivo representa uma URL que o usuário acessa.

---

## 📂 Aplicativo Mobile (`/mobile/`)

Projeto React Native rodando com o framework Expo. Ele reaproveita regras de negócios e os schemas do `/shared`, conectando-se à mesma API.

- **`app.json` / `eas.json`**: Configurações principais do Expo e do Expo Application Services (EAS). Definem nome do app, ícones, splash screen e fluxos de build em nuvem.
- **`App.tsx` / `index.ts`**: Ponto de entrada do React Native.
- **`babel.config.js` / `metro.config.js`**: Configurações do bundler (Metro) e compilador (Babel) necessários para o ambiente Native.
- **`google-services.json`**: Credenciais de configuração do Firebase (usado frequentemente para Push Notifications no Android ou Analytics).
- **`app/`**: (Se estiver utilizando Expo Router). A estrutura de pastas define a navegação em telas.
  - **`_layout.tsx`**: Layout base que envelopa outras telas.
  - **`index.tsx`**: Tela inicial do app.
  - **`(auth)/` & `(tabs)/`**: Grupos de rotas. `(auth)` agrupa telas de login/cadastro, e `(tabs)` estrutura a navegação inferior (Bottom Tabs).
- **`assets/`**: Imagens exclusivas do mobile, como ícones de aplicativo nativos, splash screens e fontes.
- **`components/`**: Componentes nativos visuais. Exemplos listados:
  - **`AchievementToast.tsx`**: Notificação em estilo toast para quando o usuário ganha uma conquista.
  - **`BeeEyes.tsx`**: Componente central, possivelmente um mascote (a abelha) animado ou logo principal na UI.
  - **`ChatMessage.tsx`**: Renderiza um balão de conversa de IA.
  - **`DailyBriefingModal.tsx`**: Modal que apresenta o resumo diário do usuário.
  - **`DrumRollDatePicker.tsx`**: Componente visual customizado para selecionar datas.
- **`features/`**: Similar à web, organização por contexto de negócios, mas com código React Native (usando `<View>`, `<Text>`).
- **`stores/`**: Gerenciamento de estado global nativo (MobX, Zustand ou Redux).
- **`locales/`**: Arquivos de internacionalização (i18n), com traduções (ex: `pt-BR.json`, `en.json`).
- **`visual/`**: Assets ou componentes voltados inteiramente para estética (como animações Lottie).

---

## 📂 Servidor Backend (`/server/`)

O cérebro da operação. É a API REST/GraphQL que recebe dados do Web e do Mobile, valida (usando schemas), processa regras de negócio, fala com a IA e persiste no banco de dados.

- **`index.ts`**: Ponto de entrada da aplicação backend (Express ou framework similar). Inicializa as portas HTTP.
- **`db.ts`**: Configuração da conexão com o banco de dados e integração com o Drizzle ORM.
- **`auth.ts`**: Lógica de Autenticação (Sessões, JWT, OAuth). Valida quem é o usuário fazendo a requisição.
- **`ai.ts` & `ai-actions.ts`**: Integrações com serviços de Inteligência Artificial (ex: OpenAI, Anthropic). Define as funções, o histórico de prompt e as respostas inteligentes que dão vida à "BeeEyesAI".
- **`alarm-reactivation.ts` / `holidays.ts`**: Serviços específicos. Provavelmente gerenciam agendamento de alarmes, notificações de recorrência e cálculos baseados em calendários (feriados).
- **`cache.ts`**: Configuração e implementação de caching (Redis ou in-memory) para tornar requisições frequentes mais rápidas.
- **`http.ts` / `vite.ts`**: Configurações de servidor HTTP base e middlewares para servir o front-end Vite no ambiente de produção.
- **`media.ts` & `storage.ts`**: Lógica para processar, redimensionar (media) e salvar (storage como AWS S3, Cloudflare R2 ou disco local) arquivos (imagens, áudios).
- **`push.ts`**: Serviço responsável por disparar Push Notifications para os dispositivos móveis.
- **`rateLimit.ts` & `security.ts`**: Medidas de segurança contra ataques de força bruta, limitação de requisições por segundo e configurações de cabeçalhos HTTP (CORS, Helmet).
- **`api/` & `routes/`**: Declaração das rotas/endpoints da API (ex: `GET /api/users`, `POST /api/chat`).
- **`middleware/`**: Funções intermediárias (ex: verificar se usuário está logado antes de prosseguir).
- **`observability/`**: Ferramentas de logs e métricas (DataDog, Sentry) para monitorar a saúde da API.

---

## 📂 Código Compartilhado (`/shared/`)

A ponte vital que impede duplicação de código. Tanto o Client quanto o Server e o Mobile importam daqui. Isso garante que, se um campo de "Usuário" mudar, todas as plataformas são atualizadas ao mesmo tempo via TypeScript.

- **`api.ts`**: Interfaces de contratos da API (os formatos esperados nas requisições e respostas).
- **`schema.ts`**: Definições das tabelas do banco de dados (provavelmente no formato do Drizzle ORM) e os schemas de validação (Zod). Exemplos de entidades que devem estar aqui: `users`, `posts`, `notifications`.
- **`unlocks.ts`**: Lógica e constantes sobre os sistemas de "Conquistas" (Achievements) ou bloqueio de features dependendo do nível/plano do usuário.

---

## 📂 Banco de Dados e Migrations (`/migrations/`)

Acompanha a evolução da estrutura de dados com o passar do tempo, gerado pelo Drizzle ORM.
- Arquivos `.sql`: Scripts automáticos que alteram o banco. Exemplos de histórico:
  - `0000...`: Tabela inicial de infraestrutura.
  - `0001_anonymous_profile_visits.sql`: Criação da feature de visitas a perfis anônimos.
  - `0002_notification_reads.sql`: Adição de controle de "lida/não lida" em notificações.
  - `0003_post_images_and_community_members.sql`: Suporte para imagens em publicações.
  - `0005_alarm_reminders.sql`: Suporte de banco para a feature de alarmes no backend.

---

## 📂 Testes (`/tests/`)

Garante a confiabilidade do sistema.
- **Arquivos `.test.ts`**: Testes unitários para as regras de negócio vitais do backend (Segurança, Rate Limit, Feriados, Unlocks).
- **`e2e/`**: Testes End-to-End (com Playwright). Simulam um usuário real abrindo o navegador, clicando em botões e validando as respostas do sistema completo.

---

## 📂 Deploy e Infraestrutura (`/deploy/`)

Scripts e configurações voltados especificamente para colocar a aplicação em ambiente de produção (Live).

- **`digitalocean/`**: Configurações de Servidor Privado Virtual (VPS). Contém um script de setup da máquina (`setup.sh`) e configurações de proxy-reverso (`nginx.conf`) para rotear o tráfego da internet para o servidor Node.js.
- **`hostgator/`**: Estratégia de deploy alternativo ou para sites secundários em hospedagem compartilhada. Utiliza arquivos `.htaccess` (Apache), estrutura de banco de dados base `mysql_schema.sql` e versões zipadas de builds estáticos da web.

---

## 📂 Utilitários Auxiliares

- **`_svg_convert/`**: Um pequeno projeto Node isolado (`convert.js`, `package.json`). Utilizado unicamente como script para ler SVGs brutos e convertê-los em formatos otimizados ou em componentes React nativos, sendo integrados posteriormente aos assets da plataforma.
- **`icons-colmeia/`**: Um repositório estático de referências e inspirações de arte e iconografia tematizada (abelhas/colmeia) que alimenta as pastas `public/` do app e da web.

---

## 🔄 Fluxo de Dados (Como Tudo se Liga)

1. **Interação**: O usuário abre o aplicativo **Mobile** (Expo) ou **Web** (React).
2. **Interface**: As telas utilizam botões e layouts criados no **Design System** (`/beeyes-design`).
3. **Requisição**: Uma ação do usuário (ex: Enviar mensagem para a IA) dispara uma chamada HTTP utilizando formatos validados na pasta **`/shared/api.ts`**.
4. **Backend**: O **`/server/index.ts`** recebe a requisição e a encaminha para as **rotas (`/server/routes/`)**.
5. **Autenticação e Limites**: Antes de executar a lógica, o servidor verifica quem é o usuário através do `auth.ts` e bloqueia spam usando o `rateLimit.ts` e `security.ts`.
6. **Lógica de Negócios**: O servidor conversa com o serviço de IA em `ai-actions.ts`.
7. **Banco de Dados**: Após a IA responder, o servidor utiliza os esquemas definidos no **`/shared/schema.ts`** e o arquivo de infraestrutura **`/server/db.ts`** para salvar no banco de dados.
8. **Resposta ao Usuário**: O servidor pode responder à requisição original ou, paralelamente, utilizar o `push.ts` para enviar uma notificação assíncrona para o aplicativo mobile avisando que uma tarefa finalizou.
9. **Gamificação**: Sistemas de conquistas (Achievements) são calculados usando o `/shared/unlocks.ts` e a notificação visual do Mobile dispara o componente `AchievementToast.tsx`.

> *Este documento fornece um panorama generalizado para ser usado por desenvolvedores atuais e novos na integração (Onboarding). Qualquer alteração na estrutura principal de pastas deve ser refletida neste arquivo.*