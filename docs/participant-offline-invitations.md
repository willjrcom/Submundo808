# PWA offline para participantes e convites de grupo

## Preparação offline
Ao acessar o aplicativo do participante com internet, ele baixa uma cópia local dos arquivos do build (HTML, JS, CSS, imagens e fontes) e dos dados públicos: eventos publicados, programação, mapas, ambientes, pontos e cardápios. O service worker mantém os arquivos no Cache Storage e permite navegar entre Início, Mapa e Cardápio com os últimos dados baixados.

Os conteúdos públicos são atualizados quando houver internet. A geração da lista versionada de assets acontece após o build Vite. **É necessário abrir o PWA conectado pelo menos uma vez para preparar o cache**. O aplicativo exibe uma indicação quando o dispositivo está offline.

O **cache compartilhado do Service Worker** não inclui autenticação, sessões, grupos privados, notificações pessoais nem posições dos amigos. Como exceção, os links de QR Code gerados explicitamente pela própria conta são mantidos separadamente no armazenamento local do aparelho, não no cache de APIs. Envio de avisos, entrada em grupos, autenticação e atualização da posição de terceiros ainda exigem conexão. Satélite do Google e imagens de domínios externos também não são garantidos offline; a planta interna é renderizada com os dados públicos e coordenadas salvas.

## Navegação completa das cinco abas offline
A interface de **Balada, Mapa, Cardápio, Amigos e Perfil** permanece disponível após o PWA ter sido aberto com internet. Além dos dados públicos já preparados pelo Service Worker, a experiência do participante sincroniza localmente os dados da conta atualmente autenticada: perfil, amizades, grupos, integrantes e detalhes dos grupos, histórico de avisos que tenha sido aberto, contas conectadas e ingressos Meaple, quando houver conexão com o provedor.

Quando faltar internet, cada tela tenta abrir os **últimos dados sincronizados** em vez de substituir a aba Amigos pela tela exclusiva de QR Codes. O QR de amizade e os QR Codes de grupo são renderizados no aparelho e ficam disponíveis offline depois de gerados uma vez com internet. O cache privado é guardado separadamente do Service Worker, associado à última conta usada neste dispositivo e é apagado ao sair da conta. O prazo de validade local é de 30 dias; não se armazenam senhas, cookies de sessão, dados do GPS nem posições dos amigos.

**Limites reais do modo offline:** a navegação, leitura e GPS local funcionam com dados baixados. Entrar em grupos, enviar/receber avisos em tempo real, gerenciar integrantes, solicitar/remover amigos, atualizar o perfil e validar ingressos exigem conexão. Ingressos mostrados offline podem ter sido usados ou revogados; a portaria continua precisando validar a situação atual. Após voltar a conexão, o aplicativo sincroniza novamente as informações. Dispositivos compartilhados devem usar **Sair da conta** para eliminar os dados salvos; antes do primeiro acesso autenticado não existe uma cópia privada para mostrar.

## GPS do próprio participante sem internet
Na aba Mapa, o botão **Mostrar minha posição** ativa o GPS diretamente pelo navegador, sem login e sem compartilhar localização. A latitude e longitude recebidas são convertidas localmente para a planta georreferenciada. A localização continua mudando se o aparelho fornecer GPS durante a falta de internet. Leituras antigas são ocultadas e a precisão pode variar muito em ambientes fechados. O usuário pode parar o GPS local pelo mesmo botão.

Teste manual no Android: abrir o PWA conectado, carregar o evento, o mapa e o cardápio; colocar o celular em modo avião, mantendo o serviço de localização ativo; reabrir o PWA, visitar as páginas e tocar em **Mostrar minha posição**. A primeira leitura GPS pode demorar em galpões fechados; o teste real deve ser feito no local.

## Convites após login/cadastro
O link /groups?group_invite=TOKEN fica guardado por até 48 horas no armazenamento local do navegador. Pessoas sem sessão veem a tela **Entrar no grupo convidado**, com login e cadastro; após autenticar (inclusive com Google ou Meaple), o aplicativo recupera o convite e mostra a prévia do grupo. A entrada depende de confirmação explícita. O token é descartado após a entrada ou cancelamento.

## QR Code de convite de grupo offline
Na aba Amigos → grupo → Convidar, o aplicativo solicita o convite ao servidor com internet, guarda o token **por até 30 dias neste dispositivo** e desenha o QR Code como SVG diretamente no navegador, sem dependência de imagens externas. Em visitas posteriores, é possível voltar a exibir o mesmo QR Code sem rede.

Ao reiniciar o PWA sem conexão, a aba Amigos oferece **Convites salvos offline** para acessar o QR Code de grupos previamente preparados, mesmo quando a API de grupos está indisponível. Convites nunca abertos com internet não podem ser criados offline. Ao sair/excluir um grupo ou sair da conta, o aplicativo remove os tokens locais. Se o convite deixar de ser válido no servidor (por exemplo, grupo excluído), a confirmação de entrada falhará quando o destinatário voltar a ficar online.

Gerar/exibir o QR Code não precisa de internet após o primeiro carregamento. **Escanear o código é possível no outro celular, mas autenticar e entrar no grupo ainda exigem internet.** Não armazenar convites no Service Worker ou em endpoints públicos.

## Testes
Os testes de regressão abrangem o convite persistente e o login, as restrições de cache para APIs públicas, o GPS local e a geração da lista de assets pelo build. A publicação passa por GitHub Actions antes de chegar ao Dokploy.
