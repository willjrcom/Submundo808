# Calibração e orientação por GPS — Submundo808

## Administração

- Abra o editor da planta de um estabelecimento e toque em **Calibrar mapa**.
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
