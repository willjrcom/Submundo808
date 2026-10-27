# AGENTS.md — Submundo 808

> Instruções para agentes de IA, assistentes de programação e novas conversas trabalhando neste repositório. Consulte este arquivo **antes de propor ou aplicar alterações**. O código real é a fonte de verdade se houver divergência com esta documentação.

## 1. Produto e contexto

**Submundo 808** é um PWA de eventos/festas, com duas experiências:
- **Participante:** escolher evento, acompanhar programação e lineup, visualizar mapas de ambientes e marcadores (bares, banheiros, palco etc.), cardápio, amigos e localização, perfil, ingressos, notificações e avaliações.
- **Administrador:** visão geral, estabelecimentos e plantas/mapas, eventos, produtos, avaliações, notificações e preferências.

Idiomas/UX: interface em **português brasileiro**; visual escuro, identidade da Submundo (preto/roxo e cor de destaque configurável, padrão `#c4ff40`). Não presumir que uma festa demo seja real.

**Produção:**
- Participantes: `https://submundo.menudevendas.com.br`
- Admin: `https://admin.submundo.menudevendas.com.br`
- Repositório: `willjrcom/Submundo808` — branch `main`.

## 2. Estrutura técnica

- Frontend: React + TypeScript + Vite + Tailwind, em `artifacts/submundo-808/`.
- Entrada do PWA: `src/App.tsx`; componentes em `src/components/`.
- Navegação admin: `src/components/admin-shell.tsx` e `admin-route.ts`.
- Backend: Node.js com HTTP nativo + `node:sqlite`, em `server/index.mjs`; autenticação `server/auth.mjs`; OAuth `server/oauth.mjs`.
- SQLite persistente: `/data/submundo.sqlite`, volume `/data` **não deve ser apagado ou substituído**.
- Assets públicos e service worker: `artifacts/submundo-808/public/`.
- O `Dockerfile` da raiz compila o frontend e cria contêiner com API + assets, porta interna **80**.
- Publicação: `.github/workflows/deploy.yml` → GHCR `ghcr.io/willjrcom/submundo808:latest` → Dokploy; instruções em `docs/deploy-ghcr-dokploy.md`.
- Web Push: VAPID via variáveis de ambiente; documentação em `docs/notifications-push.md`. Não expor chaves privadas, cookies, tokens ou PATs.

## 3. Regras obrigatórias de interface

1. **Páginas de gestão têm foco na listagem.** Exibir tabela/cards, busca, filtros, situação e ações. O formulário completo de criação/edição **não fica expandido permanentemente dentro da página**.
2. **Criar / Novo** abre **modal**. **Editar** abre o **mesmo modal** preenchido com o registro. **Excluir** abre **modal de confirmação** com contexto, consequências e ações Cancelar/Excluir.
3. **Não usar `window.alert()`, `window.confirm()` nem `window.prompt()`** para fluxos de negócio. Substituir por modais e feedback inline/toast. Evitar `confirm` nativo até mesmo nas funcionalidades legadas ao modificá-las.
4. Modais devem ser responsivos (incluindo PWA mobile), com título, X/Fechar, área rolável com `max-height`, botões claros (Salvar/Cancelar) e estados de loading/erro. Não perder alterações sem aviso de descarte (em modal próprio).
5. Confirmar explicitamente ações irreversíveis ou disparos em massa, informando **destinatários / evento / objeto afetado**. Não marcar como enviado antes de o servidor confirmar.
6. Seleções e filtros devem ser vinculados a dados reais do backend, não a placeholders fixos quando houver registros.
7. Reutilizar estilos/componentes existentes e preservar o design system; ações primárias usam a cor de destaque configurada. Garantir contraste, labels, áreas de toque e acessibilidade básica.
8. **Nunca deixar botões inertes.** Toda ação visível precisa funcionar ou indicar claramente por que não está disponível.
9. Não desnecessariamente criar novas abas no menu inferior do participante. Navegação contextual é preferível; o menu admin pode ter seções específicas quando existe uma área de gestão real.
10. Quando tocar em um **marcador do mapa**, abrir **diretamente o modal de detalhes**, com descrição, horários, categorias e produtos quando aplicável; não mostrar card intermediário no topo da página nem exigir um segundo clique.
11. Notificações com destino de marcador abrem o **evento e mapa corretos**, selecionam e destacam o ponto e abrem o mesmo modal de detalhes.
12. **Editar perfil** abre modal com foto, nome, WhatsApp, Instagram, Salvar e Fechar; nunca expande um formulário inline na tela de perfil.
13. A central de notificações do participante é acessada pelo **sino no header**, com contagem de não lidas; não adicionar botão de “Desativar push” ali (permissão é gerenciada pelo navegador/sistema).
14. Metadados de compartilhamento devem refletir eventos, mapas, programação, cardápio e amigos — **não** usar “Passaporte Digital”, “Entre na frequência” ou texto que apresente o projeto como “festival fictício”. Open Graph/WhatsApp deve incluir imagem estática PNG 1200×630 gerada de `public/og-preview.svg`.
15. Manter demos quando pertinentes, mas com rotulagem explícita; não confundir dados de teste com produção.

## 4. Domínio e regras de negócio

### Eventos, locais, mapas
- Mapas e ambientes pertencem a **estabelecimentos**, e eventos associam mapas existentes.
- No admin, locais e mapas devem ser gerenciados dentro de **Estabelecimentos**, não como aba global de “Mapas e ambientes”.
- Eventos são listados com datas/filtros, linkados à programação, cardápio e mapas.
- Produtos têm cadastro central e seleção/preço por evento; pontos do mapa podem apontar a categorias de produtos.

### Participação / amigos / localização
- Evento ativo no participante é guardado em `localStorage` (ver `active-event.ts`), **mas o backend não lê localStorage**.
- Usuários autenticados que selecionam eventos sincronizam seu vínculo na tabela `event_participants`. **Estar vinculado não prova presença física nem ingresso pago.**
- Compartilhamento de localização e permissão de GPS são controles separados e opt-in. Não ativar divulgação da posição automaticamente.
- Calibração usa quatro cantos com medição GPS; qualidade do sinal e geometria precisam ser verificadas; nunca prometer precisão 100% em ambientes pequenos.

### Notificações
- Só **administradores** criam/disparam notificações.
- Admin → **Notificações**: listagem com filtros, busca, estado e contadores; botão Nova notificação abre modal. Rascunhos/agendadas podem ser editados; envio, teste e agendamento possuem fluxos explícitos.
- Destinatários possíveis: usuários vinculados ao evento ou todos os usuários, com cautela para promoções.
- Destinos: evento/programação, cardápio, mapa, **ponto específico do mapa**, pesquisa de satisfação.
- Notificações internas ficam no banco; push via Service Worker + VAPID depende de opt-in/permissão e não substitui a central interna. Não solicitar permissão automaticamente sem gesto do usuário.
- Push deve funcionar com PWA instalado no Android e, em iOS compatível, após instalação na Tela de Início. Tratar casos sem suporte e sem VAPID configurado com mensagens claras.
- “Enviar teste” deve atingir apenas o administrador.

### Avaliações
- Admin → **Avaliações**: indicadores, filtros por evento, notas, tags e comentários privados.
- Participante pode avaliar evento **após o término e até sete dias depois**, nota de 1–5 obrigatória, tags e comentário opcionais; uma avaliação por pessoa/evento, editável dentro do prazo.
- Ao finalizar um evento, o servidor gera convite de avaliação idempotente para participantes. Evitar convites duplicados e não reenviar para quem já avaliou.

### Conta e permissões
- Perfil suporta foto otimizada para WebP 256×256, persistida no SQLite (`users.avatar_data`).
- Após login, oferecer **assistente opcional de permissões** (localização, notificações, câmera), com botões separados e justificativa de cada permissão; uma permissão negada deve ser respeitada. Link permanente “Permissões do aplicativo” no Perfil.
- Login pode ser local, Google e Meaple conforme configuração; não quebrar os provedores ao alterar o perfil.

## 5. Processo de engenharia — obrigatório

1. **Inspecionar código e rotas existentes** antes de editar; localizar schemas, componentes reutilizáveis e usos cruzados.
2. Alterações no SQLite são **migrações incrementais/idempotentes**, preservando os dados de produção. Não dropar tabelas/volume para corrigir migração.
3. Validar autorização **no backend**, não só esconder botões no frontend. Sanitizar campos, delimitar tamanho de payload e filtrar usuários/eventos.
4. Antes de afirmar conclusão, executar ou verificar, quando possível:
   - `pnpm install --frozen-lockfile`
   - `pnpm --filter @workspace/submundo-808 typecheck`
   - `pnpm --filter @workspace/submundo-808 build`
   - `node --check server/index.mjs`
   - `docker build -t submundo-test .` quando o ambiente permitir.
5. Não publicar mudanças quebradas. JSX/TSX: conferir fechamento de tags e expressões, sobretudo em modais e componentes com linhas extensas; um erro anterior de chave condicional quebrou o build de `venue-map.tsx`.
6. Não declarar “build passou”, “deploy concluído” ou “100% pronto” sem executar ou verificar logs/resultado. Distinguir **código commitado**, **build aprovado**, **deploy concluído** e **teste funcional no dispositivo**.
7. Preferir mudanças pequenas, mensagens de commit explicativas, nenhuma credencial em código/documentação/logs.
   **Agrupar alterações por solicitação do usuário e publicar a branch `main` uma única vez por solicitação.** Para vários commits, criar os commits numa branch de trabalho e fazer merge/fast-forward apenas quando estiver tudo pronto. Evitar `update_file` diretamente em `main` a cada etapa, porque cada push aciona um novo build e possível deploy no GHCR/Dokploy. Se houver teste disponível, validar antes do único push. Não executar deploy adicional sem necessidade.
8. Para imagens públicas de compartilhamento, **WhatsApp lê metadados do HTML inicial**, não de React após carregar; incluir `og:title`, `og:description`, `og:image` absoluto e tamanho, além de `twitter:image`. Verificar imagem acessível em HTTPS e atualizar cache das prévias quando necessário.
9. Se uma solicitação pedir execução, **alterar o repositório de fato**, não responder apenas com proposta. Se alguma etapa externa (Dokploy, variáveis secretas) não estiver acessível, informar o que ficou pendente sem presumir sucesso.
10. Responder ao usuário em **pt-BR**, com comunicação objetiva e sem promessas de execução futura.

## 6. Comandos e documentos úteis

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/submundo-808 typecheck
pnpm --filter @workspace/submundo-808 build
node --check server/index.mjs
docker build -t submundo808 .
```

- `docs/deploy-ghcr-dokploy.md` — build e publicação.
- `docs/notifications-push.md` — VAPID e Web Push.
- `artifacts/submundo-808/index.html` — metadados da página e preview social.
- `artifacts/submundo-808/public/og-preview.svg` — arte da imagem social, convertida para PNG pelo Dockerfile.
- `artifacts/submundo-808/src/components/admin-engagement.tsx` — admin notificações e avaliações.
- `artifacts/submundo-808/src/components/account.tsx` — conta/perfil.
- `artifacts/submundo-808/src/components/venue-map.tsx` — mapa e modais de marcadores.

## Padrão de notificações reutilizáveis
Notificações cadastradas são modelos salvos; criação/edição apenas salva. Na listagem, oferecer Editar, Enviar teste, Enviar agora e Agendar/detalhes. Cada disparo/agendamento cria uma ocorrência independente sem destruir o modelo; confirmar ações em modais internos.
