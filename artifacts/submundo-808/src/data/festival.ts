export type StageId = 'casco' | 'porao' | 'mirante';

export const STAGES: Record<StageId, { nome: string; cor: string; area: 'indoor' | 'outdoor' }> = {
  casco: { nome: 'Casco', cor: 'hsl(72 100% 55%)', area: 'indoor' },
  porao: { nome: 'Porão', cor: 'hsl(326 100% 60%)', area: 'indoor' },
  mirante: { nome: 'Mirante', cor: 'hsl(186 100% 62%)', area: 'outdoor' },
};

export interface Slot {
  stage: StageId;
  nome: string;
  inicio: number; // minutos após 22:00
  fim: number;
  genero: string;
  origem: string;
}

export const LINEUP: Slot[] = [
  { stage: 'casco', nome: 'Ostra Dura', inicio: 0, fim: 90, genero: 'Acid / Electro', origem: 'Santos' },
  { stage: 'casco', nome: 'Ivi Desfase', inicio: 90, fim: 180, genero: 'Breakbeat', origem: 'Recife' },
  { stage: 'casco', nome: 'Tainá Ruído', inicio: 180, fim: 300, genero: 'Techno industrial', origem: 'São Paulo' },
  { stage: 'casco', nome: 'NNEGRA', inicio: 300, fim: 420, genero: 'Hard techno', origem: 'Salvador' },
  { stage: 'casco', nome: 'Hertz Caboclo', inicio: 420, fim: 540, genero: 'Trance sombrio', origem: 'Belém' },
  { stage: 'porao', nome: 'Zé Sintético', inicio: 30, fim: 150, genero: 'Miami bass', origem: 'Rio de Janeiro' },
  { stage: 'porao', nome: 'Lupe Vacuum', inicio: 150, fim: 270, genero: 'Electro / EBM', origem: 'Curitiba' },
  { stage: 'porao', nome: 'KRMN', inicio: 270, fim: 390, genero: 'Jungle', origem: 'São Paulo' },
  { stage: 'porao', nome: 'Bruma 303', inicio: 390, fim: 510, genero: 'Acid house', origem: 'Porto Alegre' },
  { stage: 'mirante', nome: 'Kuruminha', inicio: 60, fim: 180, genero: 'Funk 150 bpm', origem: 'Belo Horizonte' },
  { stage: 'mirante', nome: 'Cobalto 9', inicio: 180, fim: 300, genero: 'Dub techno', origem: 'Florianópolis' },
  { stage: 'mirante', nome: 'Abissal', inicio: 300, fim: 420, genero: 'Ambient / IDM', origem: 'Fortaleza' },
  { stage: 'mirante', nome: 'Dona Fita', inicio: 420, fim: 600, genero: 'Sunrise set', origem: 'São Paulo' },
];

export const fmtTime = (min: number) => {
  const t = (22 * 60 + min) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export const NOTICES = [
  { tipo: 'aviso', texto: 'Fila do bar Cobalto está em 4 min. Aproveita agora.' },
  { tipo: 'lineup', texto: 'Tainá Ruído estende o set em 10 min no Casco.' },
  { tipo: 'seguranca', texto: 'Ponto de água gratuita reabastecido perto do Porão.' },
  { tipo: 'promo', texto: 'Combo Gelo Seco: 2 cervejas artesanais por R$ 28,00 até 04:00.' },
  { tipo: 'aviso', texto: 'Mirante liberado. Vista do nascer do sol a partir das 05:40.' },
  { tipo: 'seguranca', texto: 'Lembrete: hidrate-se. Pausa no chill room, ao lado do guarda-volumes.' },
  { tipo: 'lineup', texto: 'Surpresa: b2b entre KRMN e Lupe Vacuum no Porão.' },
  { tipo: 'aviso', texto: 'Banheiros do lado externo sem fila agora.' },
  { tipo: 'promo', texto: 'Camiseta Submundo 808 com 15% de desconto informativo no Quiosque Merch.' },
];

export const PROMOS = [
  { titulo: 'Combo Gelo Seco', detalhe: '2 cervejas artesanais', preco: 'R$ 28,00', cor: 'acid' },
  { titulo: 'Água + Isotônico', detalhe: 'Para o terceiro turno', preco: 'R$ 12,00', cor: 'ice' },
  { titulo: 'Pastel da Madruga', detalhe: 'Queijo coalho com mel', preco: 'R$ 18,00', cor: 'magenta' },
];

export const EVENTOS = [
  { id: 'mooca', nome: 'Submundo 808: Galpão Mooca', local: 'Galpão Pavilhão 7, Mooca, São Paulo', data: 'Sáb, 22:00 até Dom, 08:00' },
  { id: 'pedreira', nome: 'Submundo 808: Pedreira Sul', local: 'Pedreira Velha, Cotia, SP', data: 'Sex, 22:00 até Sáb, 08:00' },
] as const;
export type EventoId = (typeof EVENTOS)[number]['id'];

export type PoiType = 'stage' | 'bar' | 'wc' | 'entrada';
export interface Poi {
  id: string;
  tipo: PoiType;
  area: 'indoor' | 'outdoor';
  x: number;
  y: number;
  nomes: Record<EventoId, string>;
  desc: string;
  fila: Record<EventoId, number>;
}

export const POIS: Poi[] = [
  { id: 'casco', tipo: 'stage', area: 'indoor', x: 110, y: 85, nomes: { mooca: 'Palco Casco', pedreira: 'Palco Casco' }, desc: 'Palco principal. Sistema de som 4 pontos e telão de LED.', fila: { mooca: 0, pedreira: 0 } },
  { id: 'porao', tipo: 'stage', area: 'indoor', x: 190, y: 225, nomes: { mooca: 'Palco Porão', pedreira: 'Palco Porão' }, desc: 'Pista baixa, teto rebaixado, graves no peito.', fila: { mooca: 0, pedreira: 0 } },
  { id: 'mirante', tipo: 'stage', area: 'outdoor', x: 325, y: 110, nomes: { mooca: 'Palco Mirante', pedreira: 'Palco Mirante' }, desc: 'Palco ao ar livre com vista da cidade.', fila: { mooca: 0, pedreira: 0 } },
  { id: 'bar1', tipo: 'bar', area: 'indoor', x: 60, y: 180, nomes: { mooca: 'Bar Cobalto', pedreira: 'Bar Cinza' }, desc: 'Cervejas, drinks de gelo seco e água.', fila: { mooca: 4, pedreira: 9 } },
  { id: 'bar2', tipo: 'bar', area: 'indoor', x: 215, y: 135, nomes: { mooca: 'Bar Ferrugem', pedreira: 'Bar Ferrugem' }, desc: 'Drinks autorais e shots.', fila: { mooca: 11, pedreira: 3 } },
  { id: 'bar3', tipo: 'bar', area: 'outdoor', x: 335, y: 235, nomes: { mooca: 'Bar Brasa', pedreira: 'Bar Brasa' }, desc: 'Bar externo com comida de rua.', fila: { mooca: 6, pedreira: 5 } },
  { id: 'wc1', tipo: 'wc', area: 'indoor', x: 55, y: 255, nomes: { mooca: 'Banheiros A', pedreira: 'Banheiros A' }, desc: 'Banheiros acessíveis incluídos.', fila: { mooca: 7, pedreira: 2 } },
  { id: 'wc2', tipo: 'wc', area: 'outdoor', x: 215, y: 372, nomes: { mooca: 'Banheiros B', pedreira: 'Banheiros B' }, desc: 'Banheiros externos.', fila: { mooca: 1, pedreira: 8 } },
  { id: 'ent1', tipo: 'entrada', area: 'indoor', x: 135, y: 292, nomes: { mooca: 'Entrada Galpão', pedreira: 'Portão Norte' }, desc: 'Acesso à área interna. Demonstração, sem validação real.', fila: { mooca: 0, pedreira: 0 } },
  { id: 'ent2', tipo: 'entrada', area: 'outdoor', x: 45, y: 405, nomes: { mooca: 'Portão Principal', pedreira: 'Portão Sul' }, desc: 'Chegada de carros de aplicativo e pedestres.', fila: { mooca: 0, pedreira: 0 } },
];

export interface Pessoa {
  id: string;
  nome: string;
  handle: string;
  cidade: string;
  cor: string;
  amigosEmComum: number;
  pos: Record<EventoId, { x: number; y: number; area: 'indoor' | 'outdoor' }>;
}

export const PESSOAS: Pessoa[] = [
  { id: 'p1', nome: 'Caio Brandão', handle: '@caio.bpm', cidade: 'São Paulo', cor: '72 100% 55%', amigosEmComum: 4, pos: { mooca: { x: 120, y: 120, area: 'indoor' }, pedreira: { x: 300, y: 150, area: 'outdoor' } } },
  { id: 'p2', nome: 'Marina Sol', handle: '@marinasol', cidade: 'Campinas', cor: '326 100% 60%', amigosEmComum: 2, pos: { mooca: { x: 330, y: 190, area: 'outdoor' }, pedreira: { x: 90, y: 200, area: 'indoor' } } },
  { id: 'p3', nome: 'Davi Okafor', handle: '@davi.okafor', cidade: 'Rio de Janeiro', cor: '186 100% 62%', amigosEmComum: 7, pos: { mooca: { x: 100, y: 100, area: 'indoor' }, pedreira: { x: 180, y: 240, area: 'indoor' } } },
  { id: 'p4', nome: 'Letícia Azevedo', handle: '@leti.vinil', cidade: 'Belo Horizonte', cor: '40 100% 60%', amigosEmComum: 1, pos: { mooca: { x: 200, y: 245, area: 'indoor' }, pedreira: { x: 250, y: 380, area: 'outdoor' } } },
  { id: 'p5', nome: 'Bia Nakamura', handle: '@bia.n', cidade: 'São Paulo', cor: '326 100% 60%', amigosEmComum: 9, pos: { mooca: { x: 310, y: 130, area: 'outdoor' }, pedreira: { x: 120, y: 110, area: 'indoor' } } },
  { id: 'p6', nome: 'Rafa Tavares', handle: '@rafa.tvs', cidade: 'Santos', cor: '72 100% 55%', amigosEmComum: 5, pos: { mooca: { x: 70, y: 200, area: 'indoor' }, pedreira: { x: 340, y: 240, area: 'outdoor' } } },
  { id: 'p7', nome: 'Yasmin Prado', handle: '@yas.prado', cidade: 'Curitiba', cor: '186 100% 62%', amigosEmComum: 0, pos: { mooca: { x: 220, y: 380, area: 'outdoor' }, pedreira: { x: 60, y: 260, area: 'indoor' } } },
  { id: 'p8', nome: 'Otávio Lins', handle: '@otavio.lins', cidade: 'Salvador', cor: '40 100% 60%', amigosEmComum: 3, pos: { mooca: { x: 150, y: 90, area: 'indoor' }, pedreira: { x: 220, y: 130, area: 'indoor' } } },
  { id: 'p9', nome: 'Helena Quintela', handle: '@helenaq', cidade: 'Porto Alegre', cor: '326 100% 60%', amigosEmComum: 6, pos: { mooca: { x: 340, y: 240, area: 'outdoor' }, pedreira: { x: 130, y: 280, area: 'indoor' } } },
  { id: 'p10', nome: 'Joaquim Veloso', handle: '@jq.veloso', cidade: 'Recife', cor: '186 100% 62%', amigosEmComum: 2, pos: { mooca: { x: 60, y: 260, area: 'indoor' }, pedreira: { x: 320, y: 100, area: 'outdoor' } } },
  { id: 'p11', nome: 'Nina Albuquerque', handle: '@ninaalb', cidade: 'Florianópolis', cor: '72 100% 55%', amigosEmComum: 1, pos: { mooca: { x: 190, y: 140, area: 'indoor' }, pedreira: { x: 90, y: 410, area: 'outdoor' } } },
  { id: 'p12', nome: 'Tomás Reis', handle: '@tomas.reis', cidade: 'São Paulo', cor: '40 100% 60%', amigosEmComum: 8, pos: { mooca: { x: 280, y: 90, area: 'outdoor' }, pedreira: { x: 200, y: 220, area: 'indoor' } } },
];

export const iniciais = (n: string) =>
  n.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();

export type Cat = 'Bebidas' | 'Comida' | 'Merch';
export interface Item {
  id: string;
  cat: Cat;
  nome: string;
  desc: string;
  preco: number;
  tags: string[];
  img: string;
  pos: string;
  hue: number;
}

export const ITENS: Item[] = [
  { id: 'i1', cat: 'Bebidas', nome: 'Gelo Seco', desc: 'Gin, cachaça de jambu, tônica de hibisco e fumaça de gelo seco servida na hora.', preco: 32, tags: ['Autoral', 'Alcoólico'], img: 'drink.jpg', pos: '30% 50%', hue: 72 },
  { id: 'i2', cat: 'Bebidas', nome: 'Lager Cobalto 473 ml', desc: 'Lager artesanal paulistana, leve, ideal para pistas longas.', preco: 16, tags: ['Cerveja', 'Alcoólico'], img: 'drink.jpg', pos: '80% 40%', hue: 186 },
  { id: 'i3', cat: 'Bebidas', nome: 'Caipirinha Ferrugem', desc: 'Cachaça envelhecida, limão-cravo e açúcar mascavo.', preco: 24, tags: ['Clássico', 'Alcoólico'], img: 'drink.jpg', pos: '55% 70%', hue: 40 },
  { id: 'i4', cat: 'Bebidas', nome: 'Água mineral 500 ml', desc: 'Gelada. Ponto de refil gratuito próximo ao Porão.', preco: 6, tags: ['Sem álcool'], img: 'drink.jpg', pos: '10% 20%', hue: 186 },
  { id: 'i5', cat: 'Bebidas', nome: 'Isotônico Maracujá', desc: 'Reposição de sais para o terceiro turno.', preco: 9, tags: ['Sem álcool'], img: 'drink.jpg', pos: '90% 80%', hue: 40 },
  { id: 'i6', cat: 'Bebidas', nome: 'Energético Acid', desc: 'Lata 269 ml, sabor limão-siciliano.', preco: 14, tags: ['Sem álcool', 'Cafeína'], img: 'drink.jpg', pos: '45% 15%', hue: 72 },
  { id: 'i7', cat: 'Comida', nome: 'Pastel da Madruga', desc: 'Massa crocante, queijo coalho e mel de engenho.', preco: 18, tags: ['Vegetariano'], img: 'food.jpg', pos: '40% 50%', hue: 326 },
  { id: 'i8', cat: 'Comida', nome: 'Espetinho Brasa', desc: 'Contrafilé na brasa com farofa e vinagrete.', preco: 22, tags: ['Carne'], img: 'food.jpg', pos: '75% 35%', hue: 20 },
  { id: 'i9', cat: 'Comida', nome: 'Pão de Queijo Recheado', desc: 'Recheio de requeijão cremoso. Porção com 6.', preco: 17, tags: ['Vegetariano'], img: 'food.jpg', pos: '20% 65%', hue: 40 },
  { id: 'i10', cat: 'Comida', nome: 'Hot Dog Subsolo', desc: 'Salsicha artesanal, purê, batata palha e molho verde.', preco: 21, tags: ['Carne'], img: 'food.jpg', pos: '60% 80%', hue: 72 },
  { id: 'i11', cat: 'Comida', nome: 'Bowl Vegano 808', desc: 'Arroz, grão-de-bico crocante, abóbora e tahine.', preco: 26, tags: ['Vegano'], img: 'food.jpg', pos: '90% 20%', hue: 150 },
  { id: 'i12', cat: 'Merch', nome: 'Camiseta Subsolo', desc: 'Algodão pesado 220 g, estampa em tinta que brilha no escuro.', preco: 89.9, tags: ['Edição limitada'], img: 'merch.jpg', pos: '30% 50%', hue: 72 },
  { id: 'i13', cat: 'Merch', nome: 'Bucket Hat 808', desc: 'Bucket de nylon preto, bordado em verde ácido.', preco: 69.9, tags: ['Unissex'], img: 'merch.jpg', pos: '70% 30%', hue: 326 },
  { id: 'i14', cat: 'Merch', nome: 'Ecobag Reator', desc: 'Lona crua pesada com alça longa para a madrugada.', preco: 47.5, tags: ['Reutilizável'], img: 'merch.jpg', pos: '55% 80%', hue: 186 },
  { id: 'i15', cat: 'Merch', nome: 'Protetor Auricular Hi-Fi', desc: 'Par de protetores com estojo. Seus ouvidos agradecem.', preco: 39, tags: ['Saúde'], img: 'merch.jpg', pos: '10% 85%', hue: 72 },
];

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const HISTORICO = [
  { id: 'h1', nome: 'Submundo 808: Edição Zero', local: 'Galpão Mooca', data: '14 set 2024', horas: 9, palcos: 3 },
  { id: 'h2', nome: 'Submundo 808: Subsolo', local: 'Estacionamento Subterrâneo, Centro', data: '23 nov 2024', horas: 7, palcos: 2 },
  { id: 'h3', nome: 'Submundo 808: Verão Cinza', local: 'Pedreira Velha, Cotia', data: '08 mar 2025', horas: 11, palcos: 3 },
  { id: 'h4', nome: 'Submundo 808: Contra-Madrugada', local: 'Galpão Mooca', data: '19 jul 2025', horas: 8, palcos: 3 },
];

export const CONQUISTAS = [
  { id: 'c1', nome: 'Carimbo Zero', desc: 'Esteve na primeira edição.', base: true },
  { id: 'c2', nome: 'Três Pistas', desc: 'Passou pelos três palcos em uma noite.', base: true },
  { id: 'c3', nome: 'Amanhecer', desc: 'Ficou até o nascer do sol.', base: true },
  { id: 'c4', nome: 'Primeira Conexão', desc: 'Tenha ao menos 1 amigo no passaporte.', base: false },
  { id: 'c5', nome: 'Bando', desc: 'Tenha 4 amigos conectados.', base: false },
  { id: 'c6', nome: 'Comunicado', desc: 'Compartilhe a localização simulada com um amigo.', base: false },
  { id: 'c7', nome: 'Explorador', desc: 'Visite o mapa e selecione 3 pontos.', base: false },
  { id: 'c8', nome: 'Paladar', desc: 'Favorite 3 itens do cardápio.', base: false },
];
