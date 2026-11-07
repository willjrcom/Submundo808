// Icon artwork is a display preference; it must not change the marker's semantic type.
export const POINT_ICON_OPTIONS=[
 {id:'pin',name:'Localização'},
 {id:'microphone',name:'Microfone'},
 {id:'stage',name:'Palco / Apresentação'},
 {id:'music',name:'Música / Pista'},
 {id:'dj',name:'DJ / Disco'},
 {id:'headphones',name:'Fones de ouvido'},
 {id:'speaker',name:'Caixas de som'},
 {id:'vip',name:'Coroa / VIP'},
 {id:'warehouse',name:'Estrutura / Galpão'},
 {id:'people',name:'Pessoas'},
 {id:'entrance',name:'Porta / Entrada'},
 {id:'sofa',name:'Lounge / Sofá'},
 {id:'food',name:'Alimentação'},
 {id:'drink',name:'Bar / Bebidas'},
 {id:'coffee',name:'Café'},
 {id:'bath',name:'Banheiro'},
 {id:'medical',name:'Atendimento médico'},
 {id:'exit',name:'Saída'},
 {id:'ticket',name:'Ingresso'},
 {id:'shopping',name:'Loja / Produtos'},
 {id:'security',name:'Segurança'},
 {id:'camp',name:'Área externa / Tenda'},
 {id:'bus',name:'Transporte'},
 {id:'accessibility',name:'Acessibilidade'},
 {id:'info',name:'Informações'},
 {id:'star',name:'Destaque'}
] as const;

export type PointIconId=(typeof POINT_ICON_OPTIONS)[number]['id'];

const DEFAULT_ICONS:Record<string,PointIconId>={
 principal:'music',pista:'music',palco:'microphone',vip:'vip',backstage:'warehouse',
 recepcao:'people',entrada:'entrance',descanso:'sofa',cozinha:'food',
 alimentacao:'food',bar:'drink',banheiro:'bath',saida:'exit',
 'posto-medico':'medical',passagem:'entrance',outro:'pin'
};

const allowed=new Set<string>(POINT_ICON_OPTIONS.map(option=>option.id));
export const isPointIconId=(id:unknown):id is PointIconId=>typeof id==='string'&&allowed.has(id);
export function defaultPointIconId(type:string):PointIconId{
 return DEFAULT_ICONS[type]||'pin';
}
export function resolvePointIconId(type:string,override?:string|null):PointIconId{
 return isPointIconId(override)?override:defaultPointIconId(type);
}
export function pointIconName(id:PointIconId):string{
 return POINT_ICON_OPTIONS.find(option=>option.id===id)?.name||'Localização';
}
