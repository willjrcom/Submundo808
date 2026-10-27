# Deploy do Submundo 808 via GHCR + Dokploy

O GitHub Actions em `.github/workflows/deploy.yml` faz build da imagem com o `Dockerfile` da raiz, autentica no GitHub Container Registry com `GITHUB_TOKEN` (sem PAT no repositório), publica as tags:

- `ghcr.io/willjrcom/submundo808:latest` — commit mais recente publicado da main;
- `ghcr.io/willjrcom/submundo808:<sha-do-commit>` — tag imutável para rollback.

Execução: todo push em `main` ou início manual em **Actions > Build and publish Docker image > Run workflow**.

## Dokploy

1. Crie/edite uma aplicação do tipo **Docker image**, e não **Git**.
2. **Docker Image**: `ghcr.io/willjrcom/submundo808:latest`.
3. **Registry URL**: `ghcr.io`.
4. Se o pacote GHCR estiver público, não é necessário Username/Password. Se for privado, use seu usuário GitHub e um token novo com `read:packages` no Dokploy; mantenha essa credencial apenas no Dokploy.
5. A aplicação escuta a **porta 80 dentro do contêiner**; ajuste a porta da aplicação/domínio no Dokploy de acordo com isso.
6. Monte armazenamento persistente em **`/data`**. O SQLite fica em `/data/submundo.sqlite`; não elimine o volume ao substituir a aplicação.
7. Preserve as variáveis de ambiente do servidor existentes (OAuth, email, etc.). Para push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`.
8. Para atualização automática, adicione um segredo de repositório chamado **`DOKPLOY_WEBHOOK_PROD`** com o webhook de deploy gerado pelo Dokploy. É opcional; sem ele o Actions publica a imagem, mas o deploy do Dokploy deve ser acionado manualmente.

## Diagnóstico

- GitHub > Actions: verifique o workflow e a etapa **Build and push image**.
- Packages: confirme a existência do pacote `submundo808` e sua visibilidade. Pacotes GHCR novos podem exigir que você torne o pacote público manualmente.
- Dokploy: confira se está puxando a tag mais recente e se `/data` está persistido.
- A imagem contém frontend e API no mesmo contêiner, portanto não mude a imagem para a do gfood-frontend.

**Segurança:** não cole PAT ou tokens em screenshots. Revogue qualquer token exposto. O segredo padrão `GITHUB_TOKEN` do Actions tem apenas permissões do workflow e publica no GHCR sem token pessoal.

## Liberação comercial (segurança)

- Configure `APP_ENV=production` no Dokploy para impedir que o servidor recrie exemplos automaticamente.
- `AUTO_SEED_DEMO=true` permite reativar **explicitamente** o seed durante um piloto; não use em produção pública. A troca não apaga dados demonstrativos já existentes: remova-os separadamente após backup.
- Mantenha `ENABLE_DEMO_USERS` e `ENABLE_DEMO_ADMIN` desativados/não definidos na produção.
- Configure `PUBLIC_APP_ORIGIN=https://submundo.menudevendas.com.br` (URL canônica para recuperação de senha). A aplicação valida essa origem na inicialização.
- Por padrão `TRUST_PROXY=false`; o rate limiter usa o IP da conexão e **não** aceita `X-Forwarded-For` fornecido arbitrariamente pelo usuário. Somente habilite `TRUST_PROXY=true` quando o proxy de borda garantir a limpeza e substituição confiável de `X-Forwarded-For`.
- Adicione monitoramento e backups do volume `/data` com teste de restauração; este commit não altera ou apaga dados persistentes.
- O pipeline executa como bloqueantes testes críticos (segurança, sessão, localização e seed) e checagem de sintaxe. Typecheck e suíte completa rodam inicialmente como diagnóstico (`continue-on-error`) até a adequação dos testes legados; **não** interpretar sucesso do build como aprovação integral da auditoria.

**Observação sobre alta concorrência:** o limitador geral permite até 1200 POST/min por IP da conexão, para evitar bloquear várias pessoas sob o mesmo proxy na fase de testes. Recomenda-se aplicar limites específicos por rota e identidade na etapa seguinte, após teste de carga.

## Verificações para a versão 1.0

- O monitor de disponibilidade pode consultar `GET /api/health` (200 `{"status":"ok"}` quando o SQLite responde, 503 caso contrário). O endpoint não revela configuração interna; configure a consulta HTTP no Dokploy/monitor externo.
- Em produção, `APP_ENV=production` e `AUTO_SEED_DEMO` desativado também bloqueiam o botão administrativo de geração de exemplos. Não afeta registros já existentes.
- Login OAuth: inícios passam por limitador por IP com teto compatível com convidados sob um mesmo proxy; estados expirados são descartados e há limite de estados pendentes. Não substitui teste de login real no Google/Meaple.
- Interface: a cor escolhida permanece como fundo do destaque; o texto do botão e os realces sobre fundo escuro são ajustados automaticamente para razão de contraste de pelo menos 4,5:1.
- Navegação de notificações para um ponto não depende mais de timeout fixo; o mapa aguarda carregar o evento/pontos e pode trocar para outro mapa vinculado ao mesmo evento.
- Posição GPS com mais de 90 s sem leitura deixa de ser exibida como atual e volta a aparecer com uma nova leitura. Não substitui teste presencial.
- Os novos testes de saúde, contraste e navegação por notificação são bloqueantes no GitHub Actions; mantenha a validação real nos aparelhos.

## Ajustes sem alteração de banco (segurança e privacidade)
- `CSP_ENFORCE` fica desativado por padrão: navegador recebe `Content-Security-Policy-Report-Only`. A API recebe relatórios em `POST /api/csp-report`, mas **não registra** endereços, scripts, cookies ou parâmetros — apenas a categoria da diretiva. Verifique navegação, fonts, OAuth Google/Meaple, mapas, PWA e push nos navegadores reais antes de optar por `CSP_ENFORCE=true`.
- `X-Request-ID` é gerado em cada requisição pelo servidor. Para 5xx e 429, os logs incluem ID, grupo da rota, método, status e duração (sem IP, query string ou dados pessoais).
- Limites extras em memória aplicam-se a cadastro, login, recuperação/reset de senha, alterações de perfil, convites, inscrição push, telemetria e rotas administrativas. Cada instância mantém seus contadores; no futuro, infraestrutura multi-réplica exige limitador compartilhado ou regras no proxy.
- Os avisos de privacidade no Perfil distinguem concessão da permissão de GPS do compartilhamento com amigos, que depende de ativação voluntária no Mapa e prazo escolhido. Uma falha no encerramento remoto deixa alerta visível para o participante.
- **Nenhuma migração de banco, rotina de backup ou integração PostgreSQL faz parte deste lote.** A estratégia de armazenamento, retenção e políticas de privacidade devem ser aprovadas separadamente.
