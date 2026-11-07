import type {LucideIcon} from 'lucide-react';
import {
 MapPin,MicVocal,Theater,Music2,Disc3,Headphones,Volume2,Crown,Warehouse,Users,DoorOpen,
 Sofa,Utensils,Wine,Coffee,Bath,Stethoscope,Flag,Ticket,ShoppingBag,ShieldCheck,Tent,
 Bus,Accessibility,Info,Star
} from 'lucide-react';
import {resolvePointIconId,type PointIconId} from './map-point-icon-catalog';

export const POINT_ICON_COMPONENTS:Record<PointIconId,LucideIcon>={
 pin:MapPin,microphone:MicVocal,stage:Theater,music:Music2,dj:Disc3,
 headphones:Headphones,speaker:Volume2,vip:Crown,warehouse:Warehouse,people:Users,
 entrance:DoorOpen,sofa:Sofa,food:Utensils,drink:Wine,coffee:Coffee,bath:Bath,
 medical:Stethoscope,exit:Flag,ticket:Ticket,shopping:ShoppingBag,security:ShieldCheck,
 camp:Tent,bus:Bus,accessibility:Accessibility,info:Info,star:Star
};
export function pointIconFor(type:string,override?:string|null):LucideIcon{
 return POINT_ICON_COMPONENTS[resolvePointIconId(type,override)];
}
