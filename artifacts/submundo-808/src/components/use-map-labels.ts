import {useEffect,useMemo,useState} from 'react';
import {layoutRoomLabels,layoutPointLabels} from './map-label-layout';

type Room={id:string;name:string;x:number;y:number;width:number;height:number};
type Point={x:number;y:number;name:string;size?:number};

export default function useMapLabels(rooms:Room[],points:Point[]){
 const [mapElement,setMapElement]=useState<HTMLDivElement|null>(null);
 const [dimensions,setDimensions]=useState({width:600,height:450});
 useEffect(()=>{
  if(!mapElement)return;
  const update=()=>{
   const width=mapElement.clientWidth,height=mapElement.clientHeight;
   if(width&&height)setDimensions(current=>current.width===width&&current.height===height?current:{width,height});
  };
  update();
  if(typeof ResizeObserver!=='undefined'){
   const observer=new ResizeObserver(update);
   observer.observe(mapElement);
   return()=>observer.disconnect();
  }
  window.addEventListener('resize',update);
  return()=>window.removeEventListener('resize',update);
 },[mapElement]);
 const labels=useMemo(()=>layoutRoomLabels(rooms,points,dimensions.width,dimensions.height),[rooms,points,dimensions]);
 const pointLabels=useMemo(()=>layoutPointLabels(rooms,points,dimensions.width,dimensions.height),[rooms,points,dimensions]);
 return {labels,pointLabels,setMapElement};
}
