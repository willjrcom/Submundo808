# Inteligência de público (prévia em branch isolada)

Branch: `feature/event-crowd-intelligence-preview`

> **Somente protótipo para aprovação.** Não há merge em `main`, publicação no GHCR de produção nem deploy automático no Dokploy. O workflow `crowd-preview-ci.yml` valida a branch sem publicar imagens.

## Como experimentar o painel

1. Execute **esta branch** em um ambiente de preview, **com PostgreSQL e domínio distintos dos de produção** (ou em desenvolvimento local). Não reutilize o banco de produção.
2. Abra o painel do administrador e selecione **Visão geral**. O bloco **Inteligência do evento** mostra concentrações e indicadores atualizados a cada 30 segundos.
3. Abra a nova seção **Inteligência** (`/intelligence`) para os modos **Ao vivo** e **Histórico** (24 horas, 7 dias, 30 dias).
4. Clique em **Ver exemplo fictício** para visualizar o mapa de calor e gráficos mesmo sem GPS/participantes. O aviso amarelo diferencia claramente os dados fictícios das leituras reais; a prévia não insere dados de exemplo no banco.
5. Para obter leituras reais, é necessário publicar um evento, configurar `location_sharing_enabled=true`, vincular um mapa com quatro cantos **calibrados manualmente** e ter participantes autorizando localização **e** estatísticas no mapa.

## Simulação com GPS (nova)

1. Em **Visão geral** ou **Inteligência**, selecione o evento e o mapa desejados.
2. Escolha **50**, **140** ou **250 pessoas fictícias** e pressione **Simular ±20 m do meu GPS**.
3. O navegador solicita sua posição atual **somente após o clique**. O app cria um mapa virtual de **40 × 40 metros**, com seu GPS como centro e localizações fictícias até **20 metros em cada direção**. A planta do estabelecimento é usada apenas como **representação esquemática**, não como medida física do local.
4. Os pontos rosas se movem automaticamente a cada **3 segundos**; cada etapa representa **5 minutos simulados**. Os cards, as zonas do mapa e a aba **Histórico** apresentam os números simulados em tempo real.
5. Clique em **Parar simulação** para voltar imediatamente aos dados reais.

**Privacidade e isolamento:** a simulação é executada **inteiramente no navegador**, não usa o endpoint de envio de localização de participantes, não grava trajetos mockados nem no PostgreSQL nem em armazenamento local, e é sempre identificada com aviso de **SIMULAÇÃO GPS ATIVA**. Os números falsos não entram nos relatórios reais. Em caso de GPS negado ou indisponível, ainda há o botão **Ver exemplo fictício** que não usa localização.

## Como funciona

- A aplicação reutiliza **exclusivamente** as posições temporárias já enviadas para localização de amigos. Não liga GPS adicional, não coleta em background e não captura posições com o PWA fechado.
- A pessoa escolhe explicitamente a opção independente **“Contribuir com estatísticas anônimas da festa (opcional)”**, desmarcada por padrão, ao ativar a localização. Usuários com compartilhamento já ativo podem autorizar ou revogar diretamente no mapa.
- Ao interromper o compartilhamento, a autorização fica inativa. A autorização é vinculada a um **único evento**. Uma conta que compartilha GPS com amigos não entra automaticamente no relatório.
- A leitura do painel consulta posições ativas **dos últimos 90 segundos**, válidas para o evento e com consentimento independente vigente. O admin recebe somente as contagens, não os nomes, IDs, latitudes, longitudes nem trajetos.
- Só são atribuídas pessoas a ambientes de mapas com GPS de quatro cantos **manual**, com erro de até 25 m e distância da borda da área maior do que a própria incerteza do GPS. Localizações incertas ficam sem ambiente. Mapas demonstrativos (GPS `demo-auto`) não geram concentração real.
- Contagens de **1 a 4** pessoas são ocultadas da API do painel; 0 e contagens a partir de 5 podem ser exibidas. Não é permitido inferir lotação física do evento a partir dos participantes detectados.
- A cada cinco minutos, um processo no backend persiste no PostgreSQL **contagens agregadas por evento/mapa/ambiente**, sem identidade ou coordenadas individuais. A retenção é de **30 dias**.
- Os relatórios históricos mostram uma série de participantes detectados e uma classificação por média e pico de cada ambiente. A série é apresentada com passos de cinco minutos nas últimas 24 horas e médias horárias em períodos maiores.
- Ações de exclusão de evento/mapa e o reset explícito do catálogo limpam o histórico relacionado.

## Limitações da prévia

- **Não mede presença total na festa.** A amostra depende dos usuários que abriram o app, ativaram compartilhamento e deram consentimento; a amostra não é representativa por definição.
- GPS indoor pode oscilar bastante. Quanto menor o ambiente e mais próximo das paredes/divisórias, maior a chance de **não classificação**.
- **Concentração relativa não é taxa de ocupação**: esta fase não registra capacidades máximas de ambientes.
- Histórico começa a ser coletado **após o preview estar em execução** com usuários participantes. Não há reconstrução retroativa de eventos antigos.
- O workflow da branch executa testes com SQLite e PostgreSQL isolados, auditoria de frontend e build sem publicações. Para visualizar num celular é necessário criar um **Preview Deployment** separado; não existe preview externo automaticamente.

## Endpoints internos

- `POST /api/location/preferences`: adiciona `analyticsEnabled` (boolean, OFF por omissão).
- `POST /api/location/analytics-consent`: `{ "eventId": "...", "enabled": true|false }`, apenas sessão autenticada e com compartilhamento ativo no mesmo evento ao ativar.
- `GET /api/admin/crowd-live?event_id=...`: só admin, apenas agregados vigentes.
- `GET /api/admin/crowd-history?event_id=...&period=24h|7d|30d`: só admin, apenas agregados persistidos.

Tabelas: `location_preferences.analytics_enabled`, `location_preferences.analytics_event_id` e `event_crowd_snapshots`. Os snapshots **não** possuem `user_id` ou campos GPS.

## Checklist antes de uma futura aprovação

- [ ] Testar em preview separado de produção
- [ ] Validar consentimento e revogação em iPhone e Android
- [ ] Verificar precisão do mapa calibrado em evento real
- [ ] Revisar texto de privacidade e retenção com responsável pela LGPD
- [ ] Aprovar uso apenas de métricas agregadas no dashboard
- [ ] Somente depois decidir por PR/merge em `main`
