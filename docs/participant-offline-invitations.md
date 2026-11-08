# PWA offline para participantes e convites de grupo

## Preparação offline
Ao acessar o aplicativo do participante com internet, ele baixa uma cópia local dos arquivos do build (HTML, JS, CSS, imagens e fontes) e dos dados públicos: eventos publicados, programação, mapas, ambientes, pontos e cardápios. O service worker mantém os arquivos no Cache Storage e permite navegar entre Início, Mapa e Cardápio com os últimos dados baixados.

Os conteúdos públicos são atualizados quando houver internet. A geração da lista versionada de assets acontece após o build Vite. **É necessário abrir o PWA conectado pelo menos uma vez para preparar o cache**. O aplicativo exibe uma indicação quando o dispositivo está offline.

O cache **não inclui** autenticação, sessões, dados privados, convites, grupos, notificações pessoais nem posições dos amigos. Envio de avisos, entrada em grupos, autenticação e atualização da posição de terceiros ainda exigem conexão. Satélite do Google e imagens de domínios externos também não são garantidos offline; a planta interna é renderizada com os dados públicos e coordenadas salvas.

## GPS do próprio participante sem internet
Na aba Mapa, o botão **Mostrar minha posição** ativa o GPS diretamente pelo navegador, sem login e sem compartilhar localização. A latitude e longitude recebidas são convertidas localmente para a planta georreferenciada. A localização continua mudando se o aparelho fornecer GPS durante a falta de internet. Leituras antigas são ocultadas e a precisão pode variar muito em ambientes fechados. O usuário pode parar o GPS local pelo mesmo botão.

Teste manual no Android: abrir o PWA conectado, carregar o evento, o mapa e o cardápio; colocar o celular em modo avião, mantendo o serviço de localização ativo; reabrir o PWA, visitar as páginas e tocar em **Mostrar minha posição**. A primeira leitura GPS pode demorar em galpões fechados; o teste real deve ser feito no local.

## Convites após login/cadastro
O link /groups?group_invite=TOKEN fica guardado por até 48 horas no armazenamento local do navegador. Pessoas sem sessão veem a tela **Entrar no grupo convidado**, com login e cadastro; após autenticar (inclusive com Google ou Meaple), o aplicativo recupera o convite e mostra a prévia do grupo. A entrada depende de confirmação explícita. O token é descartado após a entrada ou cancelamento.

## Testes
Os testes de regressão abrangem o convite persistente e o login, as restrições de cache para APIs públicas, o GPS local e a geração da lista de assets pelo build. A publicação passa por GitHub Actions antes de chegar ao Dokploy.
