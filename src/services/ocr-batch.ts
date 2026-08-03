import {db} from "../data/db";
import {getOrCreateOcrRecord} from "../data/operations";
import type {OcrLanguage,StoredImage} from "../data/types";
import {enqueueOcr} from "./ocr";

export type BatchMode="running"|"paused"|"cancelled";
export interface BatchControl{mode:BatchMode}

const transientStatuses=new Set(["queued","loading_language","recognizing"]);

export async function prepareScreenshotOcr(recipeId:string,images:StoredImage[]){
  for(const image of images)await getOrCreateOcrRecord(recipeId,image.id);
}

export async function recoverInterruptedOcr(recipeId:string){
  await db.ocrRecords.where("recipeId").equals(recipeId).filter(record=>!record.deletedAt&&transientStatuses.has(record.status)).modify({status:"not_started",progress:0,errorCode:null,errorMessage:null});
}

export async function runSequentialOcr(input:{
  recipeId:string;
  images:StoredImage[];
  language:OcrLanguage;
  control:BatchControl;
  onStart?:(index:number)=>void;
  onProgress?:(index:number,progress:number)=>void;
  onComplete?:(index:number,status:"completed"|"error")=>void;
}){
  const images=[...input.images].filter(image=>!image.deletedAt).sort((a,b)=>a.sortOrder-b.sortOrder);
  let completed=0,failed=0;
  for(const [index,image] of images.entries()){
    if(input.control.mode!=="running")break;
    const record=await getOrCreateOcrRecord(input.recipeId,image.id,input.language);
    if(record.status==="completed"){completed++;continue}
    input.onStart?.(index);
    try{
      await enqueueOcr(input.recipeId,image.id,image.blob,input.language,value=>input.onProgress?.(index,value.progress));
      completed++;
      input.onComplete?.(index,"completed");
    }catch{
      failed++;
      input.onComplete?.(index,"error");
    }
  }
  return{completed,failed,stopped:input.control.mode!=="running"};
}

export async function retryFailedOcr(recipeId:string,images:StoredImage[],language:OcrLanguage,control:BatchControl,onStart?:(index:number)=>void){
  const failedIds=new Set((await db.ocrRecords.where("recipeId").equals(recipeId).filter(record=>!record.deletedAt&&record.status==="error").toArray()).map(record=>record.imageId));
  return runSequentialOcr({recipeId,images:images.filter(image=>failedIds.has(image.id)),language,control,onStart});
}

export async function combinedOcrDocument(recipeId:string){
  const images=await db.images.where("recipeId").equals(recipeId).filter(image=>!image.deletedAt&&image.type==="source").sortBy("sortOrder");
  const records=await db.ocrRecords.where("recipeId").equals(recipeId).filter(record=>!record.deletedAt).toArray();
  const byImage=new Map(records.map(record=>[record.imageId,record]));
  return images.map((image,index)=>{
    const record=byImage.get(image.id),content=record?.editedOcrText||record?.rawOcrText||"";
    return `--- 截图 ${index+1} [image:${image.id}] ---\n${content}`;
  }).join("\n\n");
}

export async function confirmedCombinedOcrText(recipeId:string){
  const images=await db.images.where("recipeId").equals(recipeId).filter(image=>!image.deletedAt&&image.type==="source").sortBy("sortOrder");
  const records=await db.ocrRecords.where("recipeId").equals(recipeId).filter(record=>!record.deletedAt).toArray();
  const byImage=new Map(records.map(record=>[record.imageId,record]));
  return images.flatMap((image,index)=>{
    const text=byImage.get(image.id)?.editedOcrText.trim()??"";
    return text?[`--- 截图 ${index+1} ---\n${text}`]:[];
  }).join("\n\n");
}

export async function screenshotHash(blob:Blob){
  const digest=await crypto.subtle.digest("SHA-256",await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,"0")).join("");
}
