import type {AiRecipeDraft,Recipe} from "../data/types";
import {getSupabase,isSupabaseConfigured} from "./supabase";
import {enhanceUnits} from "../../lib/units";

const preferenceKey="pourrecipe-ai-enabled";
export const isAiEnabled=()=>localStorage.getItem(preferenceKey)==="true";
export const setAiEnabled=(enabled:boolean)=>localStorage.setItem(preferenceKey,String(enabled));

export async function getAiStatus(){
  if(!isSupabaseConfigured())return{available:false,monthCalls:0};
  const {data:{session}}=await getSupabase().auth.getSession();
  if(!session)return{available:false,monthCalls:0};
  const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recipe-structure`,{method:"POST",headers:{"Content-Type":"application/json",apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action:"status"})});
  if(!response.ok)return{available:false,monthCalls:0};
  const data=await response.json().catch(()=>null);
  return{available:Boolean(data?.available),monthCalls:Number(data?.monthCalls??0)};
}

export async function createAiDraft(text:string,signal:AbortSignal){
  if(!isAiEnabled())throw new Error("请先在设置中开启智能整理");
  if(!text.trim())throw new Error("没有可发送的 OCR 文字");
  if(!isSupabaseConfigured())throw new Error("智能整理当前不可用；本地整理仍可使用");
  const {data:{session}}=await getSupabase().auth.getSession();
  if(!session)throw new Error("请先登录后再使用智能整理");
  const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recipe-structure`,{method:"POST",signal,headers:{"Content-Type":"application/json",apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action:"structure",text})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||"智能整理失败；可继续使用本地整理");
  return parseAiDraft(body.draft);
}

export function parseAiDraft(value:unknown):AiRecipeDraft{
  if(!value||typeof value!=="object")throw new Error("智能整理结果无效；OCR 内容未受影响");
  const draft=value as Record<string,unknown>,ingredients=Array.isArray(draft.ingredients)?draft.ingredients:[],steps=Array.isArray(draft.steps)?draft.steps:[];
  const validIngredient=(item:unknown)=>Boolean(item&&typeof item==="object"&&typeof (item as AiRecipeDraft["ingredients"][number]).originalText==="string"&&typeof (item as AiRecipeDraft["ingredients"][number]).name==="string");
  const validStep=(item:unknown)=>Boolean(item&&typeof item==="object"&&typeof (item as AiRecipeDraft["steps"][number]).originalText==="string"&&("temperatureC" in (item as object))&&("temperatureF" in (item as object))&&("durationMinutes" in (item as object)));
  if(typeof draft.suggestedTitle!=="string"||!ingredients.every(validIngredient)||!steps.every(validStep)||!Array.isArray(draft.otherText)||!draft.otherText.every(item=>typeof item==="string")||!Array.isArray(draft.warnings)||!draft.warnings.every(item=>typeof item==="string"))throw new Error("智能整理结果无效；OCR 内容未受影响");
  return value as AiRecipeDraft;
}

export function applyAiDraft(recipe:Recipe,draft:AiRecipeDraft,selected:{title:boolean;ingredients:boolean[];steps:boolean[]},id:()=>string){
  const ingredients=draft.ingredients.filter((_,index)=>selected.ingredients[index]).map((item,index)=>({id:id(),originalText:item.originalText,normalizedText:enhanceUnits(item.originalText),sortOrder:recipe.ingredients.length+index}));
  const steps=draft.steps.filter((_,index)=>selected.steps[index]).map((item,index)=>({id:id(),originalText:item.originalText,normalizedText:enhanceUnits(item.originalText),sortOrder:recipe.steps.length+index}));
  return{...recipe,name:selected.title&&draft.suggestedTitle?draft.suggestedTitle:recipe.name,ingredients:[...recipe.ingredients,...ingredients],steps:[...recipe.steps,...steps]};
}

export async function clearLocalAiResults(){
  await (await import("../data/db")).db.ocrRecords.toCollection().modify({aiDraft:null,aiDraftUpdatedAt:null});
}
