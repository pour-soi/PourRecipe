import {db,now} from "../data/db";
import {getOrCreateOcrRecord,saveOcrRecord} from "../data/operations";
import type {OcrLanguage,OcrRecord} from "../data/types";
import {parseRecipeText} from "./recipe-parser";

export interface OcrProgress{status:OcrRecord["status"];progress:number}
interface Job{recordId:string;image:Blob;resolve:(record:OcrRecord)=>void;reject:(error:unknown)=>void;onProgress?:(value:OcrProgress)=>void}

const jobs:Job[]=[];
let active:{recordId:string;terminate:()=>Promise<unknown>}|null=null;
let processing=false;

async function update(record:OcrRecord,patch:Partial<OcrRecord>,onProgress?:Job["onProgress"]){
  const value={...record,...patch,updatedAt:now()};
  await db.ocrRecords.put(value);
  onProgress?.({status:value.status,progress:value.progress});
  return value;
}

async function run(job:Job){
  let record=await db.ocrRecords.get(job.recordId);
  if(!record)throw new Error("OCR 记录不存在");
  record=await update(record,{status:"loading_language",progress:0,errorCode:null,errorMessage:null},job.onProgress);
  const {createWorker}=await import("tesseract.js");
  const worker=await createWorker(record.language,undefined,{logger:message=>{
    const progress=typeof message.progress==="number"?message.progress:0;
    const status=message.status==="recognizing text"?"recognizing":"loading_language";
    void db.ocrRecords.update(record!.id,{status,progress,updatedAt:now()});
    job.onProgress?.({status,progress});
  }});
  active={recordId:record.id,terminate:()=>worker.terminate()};
  try{
    record=await update(record,{status:"recognizing",progress:0},job.onProgress);
    const result=await worker.recognize(job.image);
    const latest=await db.ocrRecords.get(record.id)??record;
    return await saveOcrRecord({...latest,status:"completed",progress:1,engine:"tesseract.js",engineVersion:"7.0.0",errorCode:null,rawOcrText:result.data.text,editedOcrText:result.data.text,parserResult:parseRecipeText(result.data.text),errorMessage:null});
  }finally{
    await worker.terminate();
    active=null;
  }
}

async function drain(){
  if(processing||jobs.length===0)return;
  processing=true;
  const job=jobs.shift()!;
  try{job.resolve(await run(job))}
  catch(error){
    const record=await db.ocrRecords.get(job.recordId);
    if(record&&record.status!=="cancelled")await saveOcrRecord({...record,status:"error",errorCode:error instanceof DOMException?error.name:"recognition_failed",errorMessage:error instanceof Error?error.message:"文字识别失败"});
    job.reject(error);
  }finally{active=null;processing=false;void drain()}
}

export async function enqueueOcr(recipeId:string,imageId:string,image:Blob,language:OcrLanguage,onProgress?:Job["onProgress"]){
  let record=await getOrCreateOcrRecord(recipeId,imageId,language);
  record=await saveOcrRecord({...record,language,status:"queued",progress:0,errorCode:null,errorMessage:null});
  return new Promise<OcrRecord>((resolve,reject)=>{jobs.push({recordId:record.id,image,resolve,reject,onProgress});void drain()});
}

export async function cancelOcr(recordId:string){
  const index=jobs.findIndex(job=>job.recordId===recordId);
  if(index>=0)jobs.splice(index,1)[0].reject(new DOMException("OCR 已取消","AbortError"));
  if(active?.recordId===recordId)await active.terminate();
  const record=await db.ocrRecords.get(recordId);
  if(record)await saveOcrRecord({...record,status:"cancelled",progress:0,errorMessage:null});
}

export async function clearOcrCaches(){
  if(active)throw new Error("请先取消正在进行的识别");
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.includes("ocr")||key.includes("tesseract")).map(key=>caches.delete(key)));
}
