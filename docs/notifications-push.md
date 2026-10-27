# Avaliações e notificações — implantação

O Submundo808 mantém notificações internas no SQLite, independentemente do Push.

## Variáveis obrigatórias para Web Push

No Dokploy, configure no serviço API (mesmo domínio do PWA):

- `VAPID_PUBLIC_KEY` — chave pública VAPID em base64url;
- `VAPID_PRIVATE_KEY` — chave privada VAPID;
- `VAPID_SUBJECT` — contato URI, por exemplo `mailto:suporte@seudominio.com`.

Gere um par de chaves uma única vez com:

```sh
npx web-push generate-vapid-keys
```

Guarde a chave privada somente nas variáveis de ambiente do Dokploy. Não gere chaves diferentes a cada deploy ou as assinaturas existentes deixam de funcionar.

O frontend consulta `GET /api/push/config` e pede permissão **somente** após o participante tocar em «Ativar notificações neste celular». A assinatura fica associada à conta autenticada em `push_subscriptions`.

No iPhone, Web Push exige iOS 16.4+ e PWA instalado na Tela de Início; a permissão depende de um gesto explícito do usuário.

## Destinatários

A seleção de evento no PWA é sincronizada com `event_participants` quando o usuário está autenticado. Isso não é uma comprovação de ingresso ou presença física. Um evento selecionado anteriormente continua no histórico do usuário.

## Agendamentos e pesquisas

O servidor roda um verificador a cada 60 segundos enquanto o processo está ativo. Avisos agendados e convites automáticos de avaliação são inseridos em `notification_receipts`, com deduplicação de eventos.

As avaliações são liberadas após o fim do evento e ficam abertas por sete dias; uma avaliação por usuário/evento pode ser atualizada dentro desse prazo. A estimativa de término usa o horário local brasileiro quando a data não traz fuso explícito.

As notificações internas funcionam mesmo sem chaves VAPID. O Web Push é best-effort e depende das permissões e da entrega pelos provedores de push.

## Verificação sugerida

1. Publicar o aplicativo com HTTPS e garantir que `/sw.js` esteja ativo.
2. Entrar em duas contas, selecionar o mesmo evento e conferir a API de participação.
3. No admin: Notificações → criar → enviar teste para si mesmo.
4. Ativar notificações em um Android ou iPhone instalado.
5. Enviar promoção apontando para um marcador do mapa e conferir a abertura do ponto.
6. Agendar uma mensagem de teste para alguns minutos à frente.
7. Encerrar um evento de demonstração e conferir a criação do convite de pesquisa, dentro dos sete dias.

**Limitações:** sem verificação de ingresso real, não há garantia de presença física; push pode atrasar/ser bloqueado. Para volume alto, usar fila externa e política de retentativas. A implantação deve validar regras de antispam/consentimento antes de promoções em produção.
