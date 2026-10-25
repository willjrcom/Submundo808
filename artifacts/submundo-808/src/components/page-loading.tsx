import {LoaderCircle} from 'lucide-react';

type PageLoadingProps={
 label?:string;
 description?:string;
 compact?:boolean;
};

// Um único estado visual para carregar autenticação, dados da festa e listas.
// Não renderizar conteúdo protegido, formulários ou "nenhum resultado" antes do fetch inicial.
export default function PageLoading({
 label='Carregando...',
 description='Preparando as informações para você.',
 compact=false
}:PageLoadingProps){
 return <section
  role="status"
  aria-live="polite"
  aria-busy="true"
  aria-label={label}
  className={'flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] px-6 text-center '+(compact?'min-h-[220px] py-10':'min-h-[420px] py-16')}
 >
  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#c4ff40]/25 bg-[#c4ff40]/10">
   <LoaderCircle size={30} strokeWidth={2.5} className="motion-safe:animate-spin text-[#c4ff40]"/>
  </div>
  <div>
   <p className="text-base font-black text-white">{label}</p>
   <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/50">{description}</p>
  </div>
  <span className="sr-only">Aguarde enquanto carregamos a tela.</span>
 </section>;
}
