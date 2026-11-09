# Telemetria de uso por evento — Submundo 808

## O que é medido

- **Usuários/dispositivos únicos**: contagem distinta por conta autenticada, ou por identificador aleatório persistido neste navegador enquanto não houver sessão autenticada. Não é uma contagem exata de pessoas.
- **Ativos nos últimos 15 minutos**: dispositivos/contas que enviaram sinal de navegação ou atividade com a página visível. **Não representa pessoas fisicamente no evento.**
- **Acessos às funcionalidades**: entradas nas telas Programação, Mapa, Cardápio e Amigos. Sinais automáticos de atividade (a cada 60 s) não entram nesse indicador.
- **Uso por hora**: usuários/dispositivos distintos por hora no dia selecionado, em horário de Brasília. Não significa simultaneidade.
- **Contas vinculadas**: pessoas autenticadas que selecionaram o evento em algum momento; independem da telemetria e não comprovam ingresso ou check-in.

O painel mostra Visão Geral > Telemetria e Engajamento, com filtro de evento e data, e também o detalhe do evento. As contagens começam após o deploy desta versão: não existe reconstrução confiável de visitas históricas.

## Segurança, privacidade e limites

- A API pública aceita apenas eventos publicados e funcionalidades de uma lista fechada.
- A API de relatórios é restrita a administradores no servidor.
- As chaves de visitantes são pseudonimizadas com HMAC no backend; o banco não armazena UUID original do dispositivo, IP, GPS, e-mail nem URLs para a telemetria.
- Registros são agregados por hora / funcionalidade / visitante e eliminados após **90 dias**, com limpeza na inicialização e diária.
- O navegador com Do Not Track ativo não envia eventos.
- Uma pessoa não autenticada pode ser contada novamente ao mudar de navegador ou aparelho; ao entrar na conta, a mudança de identificador também pode duplicar sua contagem.
- Um navegador pode falsificar eventos; as contagens são indicadores de adoção, não de faturamento, bilheteria ou controle de acesso.
- Para medir **presença física**, criar integração com check-in de ingresso/QR Code, independente da telemetria e do GPS.

Antes de ativar amplamente em produção, revisar a política de privacidade e o enquadramento LGPD (finalidade, transparência, base legal, prazo e direitos), e validar carga com público esperado, especialmente com PostgreSQL síncrono e limites por IP.
