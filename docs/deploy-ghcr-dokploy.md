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
