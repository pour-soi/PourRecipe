import type {ToolCategory} from "../../lib/kitchen-tools";

export interface SavedConversion{id:string;category:ToolCategory;input:string;output:string;createdAt:string}
const recentKey="pourrecipe-kitchen-recent",favoriteKey="pourrecipe-kitchen-favorites";
const read=(key:string):SavedConversion[]=>{try{const value=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(value)?value:[]}catch{return[]}};
const write=(key:string,value:SavedConversion[])=>localStorage.setItem(key,JSON.stringify(value));
export const getRecentConversions=()=>read(recentKey);
export const getFavoriteConversions=()=>read(favoriteKey);
export function addRecentConversion(value:SavedConversion){const next=[value,...read(recentKey).filter(item=>item.input!==value.input||item.output!==value.output)].slice(0,30);write(recentKey,next);return next}
export function addFavoriteConversion(value:SavedConversion){const next=[value,...read(favoriteKey).filter(item=>item.input!==value.input||item.output!==value.output)];write(favoriteKey,next);return next}
export function deleteSavedConversion(kind:"recent"|"favorite",id:string){const key=kind==="recent"?recentKey:favoriteKey,next=read(key).filter(item=>item.id!==id);write(key,next);return next}
export function clearSavedConversions(kind:"recent"|"favorite"){write(kind==="recent"?recentKey:favoriteKey,[]);return[]}
