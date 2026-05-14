# Configuracao de anuncios no BeeEyes

## Situacao atual do projeto

O BeeEyes ja tem um sistema proprio de anuncios patrocinados no chat:

- Web: `client/src/components/SponsoredChatCard.tsx`
- Mobile: `mobile/components/SponsoredChatCard.tsx`
- Engine web: `client/src/lib/adService.ts`, `client/src/lib/ads.ts`, `client/src/lib/mockAds.ts`
- Engine mobile: `mobile/lib/adService.ts`, `mobile/lib/ads.ts`, `mobile/lib/mockAds.ts`
- Preferencias mobile: `mobile/features/settings/screens/AdSettingsScreen.tsx`

Hoje esses anuncios usam campanhas mockadas/locais. Isso serve para patrocinio direto, afiliados ou campanhas proprias, mas ainda nao e uma integracao real com AdMob/AdSense.

## Qual produto usar

### Para ganhar dinheiro exibindo anuncios no app mobile

Use Google AdMob.

AdMob e o produto correto para monetizar apps Android/iOS. O Google Ads nao e para exibir anuncios no seu app; Google Ads serve para voce comprar trafego e promover o BeeEyes.

### Para ganhar dinheiro no web

Use Google AdSense ou Google Ad Manager.

Para comecar simples, use AdSense. Para vender inventario direto, controlar campanhas e mediar demanda, use Ad Manager. O sistema patrocinado proprio do BeeEyes pode continuar existindo junto com isso.

### Para divulgar o BeeEyes

Use Google Ads com App Campaigns, depois que o app estiver publicado na Play Store/App Store.

## Dados que preciso receber para configurar no codigo

### AdMob

No painel do AdMob, crie o app BeeEyes para Android e iOS e me envie:

```txt
ADMOB_PUBLISHER_ID=pub-XXXXXXXXXXXXXXXX
ADMOB_ANDROID_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
ADMOB_IOS_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
ADMOB_ANDROID_BANNER_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
ADMOB_ANDROID_NATIVE_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
ADMOB_IOS_BANNER_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
ADMOB_IOS_NATIVE_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
ADMOB_IOS_INTERSTITIAL_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
```

Formatos recomendados para o BeeEyes:

- Banner: tela de Feed, Noticias ou Colmeia, sem atrapalhar o chat.
- Native ad: melhor encaixe visual em feed/listas.
- Interstitial: usar com muita cautela, por exemplo apos varias sessoes, nunca no meio de uma conversa.
- Rewarded: so se houver uma recompensa real e opcional.

## Passos no AdMob

1. Acesse `https://admob.google.com`.
2. Crie/ative sua conta AdMob.
3. Adicione o app Android:
   - Package name: `com.beeeyes.ai`
4. Adicione o app iOS quando tiver o Bundle ID publicado:
   - Bundle ID: `com.beeeyes.ai`
5. Crie os blocos de anuncio:
   - Banner
   - Native
   - Interstitial, opcional
6. Copie os App IDs e Ad Unit IDs.
7. Configure pagamentos e dados fiscais no Google.
8. Durante desenvolvimento, usar sempre IDs de teste.
9. So trocar para IDs reais em build de producao.

## app-ads.txt

O AdMob exige que o dominio do desenvolvedor esteja no cadastro da Play Store/App Store e que o arquivo esteja na raiz do site:

```txt
https://SEU-DOMINIO.com/app-ads.txt
```

Conteudo minimo:

```txt
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

Substitua `pub-XXXXXXXXXXXXXXXX` pelo Publisher ID do AdMob.

Se usar outras redes, cada rede precisa fornecer sua propria linha para esse arquivo.

## Configuracao no mobile Expo

Depois que os IDs estiverem definidos:

1. Instalar SDK de ads compatível com React Native/Expo.
2. Adicionar plugin no `mobile/app.json` ou migrar para `mobile/app.config.ts`.
3. Configurar:
   - Android AdMob App ID
   - iOS AdMob App ID
4. Criar componentes:
   - `mobile/components/AdMobBanner.tsx`
   - `mobile/components/AdMobNativeCard.tsx`
5. Inserir anuncios em telas seguras:
   - Feed
   - Noticias
   - Colmeia
   - Nunca como resposta fingindo ser a Bee.
6. Respeitar preferencias do usuario:
   - Sem anuncios para premium.
   - Sem anuncios em contexto sensivel.
   - Sem personalizados sem consentimento.
   - Sem personalizados para menores de 18 ou idade desconhecida.

## Configuracao no web

Para AdSense:

1. Criar conta em `https://adsense.google.com`.
2. Cadastrar dominio do BeeEyes.
3. Adicionar `ads.txt` na raiz:

```txt
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

4. Aguardar revisao do site.
5. Criar componentes de slots web apenas em areas apropriadas.

Importante: o chat deve continuar transparente. Anuncio nao deve parecer resposta organica da IA sem selo claro de patrocinado.

## Campanhas para divulgar o app com Google Ads

Depois que o app estiver publicado:

1. Acesse Google Ads.
2. Crie uma App Campaign.
3. Conecte Play Store/App Store.
4. Defina objetivo:
   - Instalacoes
   - Engajamento
   - Pre-registro, se aplicavel
5. Configure conversoes/eventos.
6. Suba assets:
   - textos curtos
   - imagens
   - videos
   - icone do app
7. Comece com orcamento pequeno e acompanhe retencao, nao so instalacoes.

## Politica e seguranca

Regras que o BeeEyes deve manter:

- Identificar tudo como `Patrocinado`.
- Ter opcao de ocultar/reportar anuncio.
- Explicar "Por que estou vendo isso?".
- Nao usar temas sensiveis para segmentacao.
- Nao mostrar anuncios em conversa de crise, saude grave, luto, emergencia ou situacao sensivel.
- Guardar consentimento para personalizacao.
- Permitir anuncios nao personalizados.
- Evitar interstitial em momentos de tarefa critica.

## Proximo passo para eu finalizar

Me envie:

1. Publisher ID do AdMob.
2. Android App ID do AdMob.
3. iOS App ID do AdMob, se ja existir.
4. IDs dos blocos de anuncio.
5. Dominio oficial do desenvolvedor para `app-ads.txt`.
6. Se quer exibir banners, native ads, interstitial ou apenas anuncios patrocinados proprios.

Com isso eu consigo configurar o SDK, criar os componentes e posicionar os anuncios no app.
