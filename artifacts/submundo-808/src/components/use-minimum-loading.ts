import {useEffect,useRef,useState} from 'react';

// Evita o flash de loaders que aparecem por apenas um frame.
// Não atrasa requisições: só posterga a transição visual para o conteúdo final.
// O relógio começa no primeiro render e reinicia quando uma nova carga começa.
export const MINIMUM_LOADING_MS=500;

export default function useMinimumLoading(isLoading:boolean,minMs=MINIMUM_LOADING_MS):boolean{
 const startedAt=useRef(Date.now());
 const [visible,setVisible]=useState(true);

 useEffect(()=>{
  if(isLoading){
   startedAt.current=Date.now();
   setVisible(true);
   return;
  }
  const remaining=Math.max(0,minMs-(Date.now()-startedAt.current));
  const timeout=window.setTimeout(()=>setVisible(false),remaining);
  return()=>window.clearTimeout(timeout);
 },[isLoading,minMs]);

 return isLoading||visible;
}
