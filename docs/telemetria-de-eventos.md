# Telemetria e engajamento — Submundo 808

## Objetivo e limites da medição
O dashboard **Visão Geral** apresenta utilização do PWA por evento e no agregado. Não mede o número de pessoas dentro do local, ingressos, comparecimento físico, bilheteria ou check-ins. Esses dados exigem integração própria de entrada (QR Code/ingresso).

O período é interpretado em **America/Sao_Paulo**, atualmente UTC-03. Os filtros disponíveis são Hoje, últimos 7 dias, últimos 30 dias e intervalo personalizado até 90 dias. Gráficos diários usam dia local; o gráfico de Hoje usa horas locais. Não são fabricados dados históricos anteriores à implantação.

## Indicadores
| Indicador | Definição |
|---|---|
| Usuários únicos estimados | Distintos pela conta autenticada ou pelo identificador persistente gerado no navegador; uma mesma pessoa pode ser contada novamente em dispositivos diferentes ou ao fazer login |
| Aberturas/sessões | Sessões distintas que utilizaram pelo menos um evento no intervalo. Uma sessão é renovada após 30 minutos de inatividade no navegador; alternar entre eventos não duplica sessões no total global |
| Ativos agora | Contas/identificadores com sinal de uso nos últimos 15 minutos, independentemente do filtro de datas, mantendo o filtro de evento |
| Uso por funcionalidade | Entradas em Programação, Mapa, Cardápio e Amigos. Heartbeat e pausa não são contabilizados como acessos |
| Tempo médio de uso | Média por sessão, em segundos, da soma de intervalos observados entre sinais enquanto o aplicativo estava visível. Intervalos superiores a 90 s e períodos em segundo plano não são incluídos. É estimativa e pode subcontar o final da sessão |
| Retorno de usuários | Proporção da base de usuários do intervalo imediatamente anterior que também utilizou o app no intervalo selecionado. É uma taxa de retorno de coorte, não a retenção clássica D1/D7. Mostra — quando não há base anterior suficiente |
| Usuários por faixa horária ou dia | Usuários distintos em cada faixa; a soma das faixas não equivale necessariamente aos usuários distintos de todo o período |
| Contas vinculadas | Usuários autenticados que selecionaram um evento (tabela event_participants), sem comprovação de ingresso ou comparecimento |
| Localização compartilhada | Indicador legado de compartilhamento voluntário de GPS, não utilizado para determinar sessões e usuários únicos |

As métricas são armazenadas em event_usage_buckets (agregadas por hora/funcionalidade/ator) e event_usage_sessions (sessões pseudonimizadas). A API pública de gravação valida dados e evento publicado. Consulta de relatórios somente para administradores.

## Privacidade e desempenho
- Visitor ID e session ID são gerados no navegador, mas persistidos no servidor **apenas após HMAC**, usando o segredo do backend; não gravar IP, URL, e-mail, identificador bruto ou GPS para telemetria.
- O sistema respeita Do Not Track no navegador.
- Heartbeat é enviado a cada 60 segundos, apenas com tela visível e conexão disponível. Mudanças de visibilidade sinalizam pausa e retorno; falhas silenciosas de rede não impedem navegar no PWA.
- Retenção de **90 dias** com limpeza na inicialização e diária; relatórios antigos poderão retornar vazios. O filtro personalizado aceita no máximo 90 dias.
- Eventos sintéticos/demos não devem ser confundidos com eventos comerciais; registros de teste requerem exclusão por processo administrativo autorizado, sem apagar o banco em produção.
- Cada request grava agregados por evento, hora e usuário e uma sessão; índices permitem consultar histórico por data e evento. Verificar consumo de CPU e número de requisições em teste de carga antes de grandes festas.
- Uso de identificadores pseudônimos e comportamento de navegação ainda podem configurar tratamento de dados pessoais segundo a LGPD. Revisar transparência, base legal, política de privacidade e processo de exclusão com o controlador antes de disponibilização ampla.

## Código e validação
- PWA: artifacts/submundo-808/src/components/usage-telemetry.ts e src/App.tsx
- Dashboard: artifacts/submundo-808/src/components/admin-usage.tsx
- Backend: server/event-usage.mjs, server/index.mjs
- Testes: tests/event-usage.test.mjs e tests/telemetry-dashboard.test.mjs
- CI: .github/workflows/admin-ui-check.yml
- CSV exportado contém somente resultados agregados do comparativo por evento.

## Restrições conhecidas
Uma mudança de dispositivo, login durante a visita, armazenamento bloqueado ou bloqueio de requests pode criar duplicações ou subcontagens. A duração nunca é inferida a partir de navegação em segundo plano, e o navegador pode encerrar antes de enviar o último sinal. Os indicadores orientam decisões operacionais de produto, não uma contagem auditável de pessoas presentes.
