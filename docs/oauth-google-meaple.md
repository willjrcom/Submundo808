# Google e Meaple — configuração OAuth

Configure estas variáveis **no servidor do Dokploy** (não use o prefixo `VITE_`; nenhum segredo deve chegar ao navegador):

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://submundo.menudevendas.com.br/api/auth/google/callback

MEAPLE_CLIENT_ID=
MEAPLE_REDIRECT_URI=https://submundo.menudevendas.com.br/api/auth/meaple/callback
MEAPLE_API_URL=https://api.meaple.com.br
# Opcional: preencher somente após confirmação oficial de outro domínio OAuth
# MEAPLE_OAUTH_BASE_URL=https://dominio-confirmado-pela-meaple
```

O serviço já precisa manter o segredo JWT persistente (arquivo gerenciado sob `DATA_DIR` ou `JWT_SECRET` conforme a configuração atual). Ele também protege, com AES-GCM, os tokens obtidos da Meaple. **Não altere o segredo sem planejar a rotação dos tokens.**

## Configurar provedores

**Google**: crie credenciais OAuth 2.0 de aplicativo Web no Google Cloud Console e cadastre a URI de redirecionamento Google exatamente como acima. Ative os escopos `openid email profile`. Configure o Client ID e o Client Secret no Dokploy.

**Meaple**: obtenha o Client ID do canal/aplicativo; solicite ao suporte da Meaple o cadastro da URI de retorno e do domínio. A Meaple exige OAuth 2.0 com PKCE; não usa Client Secret na troca de token documentada. As URLs usadas pelo servidor são as da documentação oficial, https://docs.meaple.com.br/authentication.

## Associar ingressos

Em **Admin → Eventos → Editar → Ingressos**, informe o `meaple_event_id` exato da Meaple. O ID não é o slug, link de compra ou número de ingresso.

Na aba Perfil, o participante conecta a conta Meaple. O servidor consulta eventos do usuário autenticado com `users.getEvents()` e depois `events.getUserEventTickets(eventId)` do SDK oficial, somente para eventos com IDs previamente associados. Os ingressos e os QR codes são consultados pelo backend, não por acesso anônimo.

**Número de ingresso digitado manualmente:** não é aceito como prova de propriedade; não existe uma API pública confirmada para validar e atribuir ingressos arbitrários apenas pelo número. Somente ingressos autenticados na conta Meaple serão apresentados.

O login convencional por e-mail/senha permanece disponível. Para vincular Google ou Meaple a uma conta Submundo já existente, o participante deve entrar primeiro na conta Submundo e clicar em Vincular no Perfil; uma coincidência de e-mail não faz vinculação automática.

## Observações operacionais

- A API OAuth mantém o estado PKCE em memória durante 5 minutos: callbacks iniciados antes de um restart ou enviados a outra réplica não funcionarão. Use armazenamento central de estados para execução com múltiplas réplicas.
- Google e Meaple serão mostrados no login somente quando as variáveis necessárias estiverem configuradas.
- Faça os testes reais de login e ingressos com credenciais válidas depois do deploy; estes testes não podem ser concluídos apenas com dados demonstrativos.

## Problema de DNS no login Meaple

A documentação oficial apresenta `https://whitelabel.meaple.app/api/oauth/authorize`, mas esse hostname pode não resolver DNS na rede. O erro `ERR_NAME_NOT_RESOLVED` ocorre antes de qualquer validação OAuth e **não** é causado pelo redirect URI nem pelo PKCE. O backend oferece `MEAPLE_OAUTH_BASE_URL` para alterar a origem da autorização e do token, mas **não invente um domínio alternativo**: confirme com o suporte da Meaple qual é o endereço de produção, cadastre o redirect e use o hostname fornecido. A variável deve conter somente a origem HTTPS, sem `/api/oauth/authorize`.

O `MEAPLE_CLIENT_ID` precisa ser o identificador real atribuído ao canal/aplicativo; não use o valor `123` ilustrativo. O header correto para buscar o perfil na API é `X-Client-Id`.
