# Calibração e orientação por GPS — Submundo808

## Administração

- Abra o editor da planta de um estabelecimento. Sem calibração válida, toque em **Calibrar mapa**. Com quatro pontos válidos, o botão muda para **Ver calibração**, que abre uma consulta com opção de **Editar** as coordenadas individuais, com planta geográfica **norte para cima**, salas projetadas a partir dos quatro cantos salvos, medidas, margem e coordenadas originais. A projeção usa a mesma associação lógica entre cantos GPS e o plano da planta, sem rotação ou espelhamento artificiais. A seta verde mostra a direção real do topo do desenho, que não precisa coincidir com o norte. A borda representa os limites expandidos do mapa quando configurados; os pontos numerados representam as posições originalmente medidas. A vista é geográfica em 2D, não um relevo 3D nem uma fotografia de satélite. O botão **Editar** em Pontos de referência permite alterar latitude e longitude dos quatro cantos. Enquanto os campos são editados, o desenho geográfico, as posições numeradas, as dimensões laterais e os valores em metros são atualizados **em tempo real** quando o quadrilátero é válido. Com coordenadas incompletas ou inválidas, a tela mantém a última prévia válida e apresenta um aviso; cancelar reverte imediatamente a visualização. A prévia não altera o rascunho persistível até Aplicar. **Aplicar ao rascunho** valida a geometria, recalcula os limites com margem de 5 m, atualiza a visualização e deixa a mudança pendente até **Salvar mapa**; **Cancelar** descarta a edição. O desenho exibe somente a metragem sobre cada lado da borda verde, sem caixas, numeração 1–2 ou linhas de cota pontilhadas. Os valores representam as distâncias entre os pontos originais, sem incluir a margem de 5 m, e também aparecem na lista lateral. O botão **Recalibrar** inicia novamente a escolha entre GPS e coordenadas manuais.
- Na calibração manual, um esboço indica **↑ Topo do desenho**, que não representa necessariamente o norte geográfico. Quatro botões **+** numerados ficam distribuídos pelas bordas do desenho para selecionar os **quatro cantos técnicos** armazenados (`tl/tr/br/bl`), sem fingir que os pontos médios das bordas foram medidos. A seleção leva ao campo correspondente. O quarto ponto estimado continua explicitamente sinalizado no modo de três pontos.
- Os quatro controles **+** agora ficam **sobre os respectivos cantos da própria planta**, sem depender de rótulos externos. Cantos medidos passam a exibir ✓.
- Fique parado no canto, dentro do espaço, e toque no seu botão. O aplicativo solicita posições GPS durante **8 segundos**, com contagem regressiva e barra de progresso real.
- Ao concluir, o administrador vê a posição estimada, a precisão reportada pelo aparelho e a quantidade de leituras aproveitadas. Pode **Confirmar ponto**, **Mapear novamente** ou **Cancelar** sem modificar a planta.
- A captura utiliza mediana das coordenadas após filtro de leituras inválidas, imprecisas (>50 m) e discrepantes. Caso as leituras sejam escassas/inconsistentes, a interface sinaliza incerteza; não afirma precisão absoluta.
- Depois dos **quatro cantos válidos**, a planta é expandida **5 metros para fora em cada direção local**: cima/esquerda no superior esquerdo, cima/direita no superior direito e assim por diante. A transformação usa os vetores de cada borda, acompanhando uma planta rotacionada em relação ao Norte.
- A tabela de medidas compara a distância **entre os pontos originalmente medidos**, sem incorporar os 5 metros. A borda representa a planta expandida; pontos amarelos indicam as posições originais.
- Salva os limites ajustados nas coordenadas `gps.tl/tr/bl/br` e conserva as leituras brutas separadas em `gps.rawCorners`, com `gps.marginMeters=5`, evitando duplicar margens durante futuras recalibrações.
- Mapas já existentes não mudam automaticamente de coordenada. Após recalibrar um canto, o sistema utiliza as medidas anteriores como base e aplica a expansão de 5 m ao conjunto válido.
- A validação final compara dimensões e quadrilátero; a interface informa que um espelhamento completo não pode ser detectado exclusivamente por GPS. Verifique a orientação visual antes de publicar.
- Em caso de erro ao salvar, a janela permanece aberta e mostra o erro.

## Mapa do participante

Com localização ativa e planta calibrada, se a pessoa estiver fora do mapa:

- Exibe a seta sobre a borda, **apontando para a entrada mais próxima** cadastrada na planta; na ausência de entrada, indica apenas a direção da borda mais próxima.
- Exibe distância geográfica **em linha reta** até a entrada. Essa distância **não equivale ao caminho caminhável** nem representa uma rota dentro do local.
- Mostra linha tracejada de orientação visual. O usuário pode tocar em **Como chegar à entrada** para abrir o Google Maps, somente quando existe entrada cadastrada na planta.
- Mostra a precisão do aparelho. Quando a distância até a borda está contida na incerteza do GPS, informa **próximo ao limite** em vez de afirmar que está fora.
- Mapas demonstrativos não oferecem instruções geográficas confiáveis.

## Segurança operacional

O GPS pode apresentar erro sistemático em áreas internas e 8 segundos não garantem posição exata. A margem de 5 metros é uma tolerância visual, **não** deve ser usada para segurança, medição de lotação ou controle de acesso. A orientação não supõe rotas seguras e depende de uma entrada cadastrada e validada pelo organizador.

## Verificação

`node --test tests/map-calibration-guidance.test.mjs` cobre deslocamento geográfico, rotação, cantos cruzados, preservação dos pontos originais, filtro de amostras e presença dos componentes de navegação.

## Ajustar diretamente sobre o satélite

Na aba **Calibração manual → Ajustar pelo mapa**, o administrador pode selecionar o ponto numerado (1 a 4), clicar no Google Maps ou arrastar um dos marcadores para atualizar sua latitude/longitude com sete casas decimais. A conexão entre os quatro pontos aparece como um polígono semitransparente; há controles para mapa/satélite, opacidade, contorno e medidas aproximadas das quatro bordas. O topo da planta é indicado pelo segmento entre os pontos 1 e 2, independentemente do norte geográfico. O modo com mapa usa quatro pontos reais, não a estimativa opcional de três pontos. Alterações permanecem no mesmo rascunho de coordenadas da entrada manual e só substituem a calibração cadastrada após Revisar → Confirmar → Salvar mapa; cancelar fecha a edição sem publicar.

**Requisito operacional:** configurar `GOOGLE_MAPS_BROWSER_API_KEY` no servidor (Dokploy), uma chave de navegador habilitada para **Google Maps JavaScript API**, com cobrança configurada e restrições de domínio (`https://admin.submundo.menudevendas.com.br/*` e domínios de desenvolvimento quando necessário). O servidor disponibiliza exclusivamente essa chave pública aos administradores autenticados por `GET /api/admin/map-config`. Não reutilizar credenciais privadas de backend, não inserir a chave no Git e não permitir o uso irrestrito da chave. Sem configuração, o sistema exibe o iframe já existente do Google Maps como referência sem drag-and-drop e orienta a continuar editando as coordenadas manualmente.
