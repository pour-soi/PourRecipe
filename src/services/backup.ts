import JSZip from "jszip";
import type {Table} from "dexie";
import {db,now} from "../data/db";
import type {CookRecord,OcrRecord,Recipe,StoredImage,Taxonomy} from "../data/types";
import {fetchRemoteImage} from "./sync";

export const BACKUP_FORMAT="PourRecipe";
export const BACKUP_VERSION=1;
const MAX_ZIP_SIZE=512*1024*1024,MAX_UNCOMPRESSED=1024*1024*1024,MAX_ENTRIES=20_000;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder=new TextEncoder();

type ImageMeta=Omit<StoredImage,"blob"|"thumbnailBlob">&{fullPath:string;thumbnailPath:string;fullSha256:string;thumbnailSha256:string};
type BackupData={recipes:Recipe[];categories:Taxonomy[];tags:Taxonomy[];cookRecords:CookRecord[];images:ImageMeta[];ocrRecords:OcrRecord[]};
export interface BackupPreview{counts:Record<string,number>;estimatedBytes:number;includesTrash:boolean;createdAt:string}
export interface ValidatedBackup{preview:BackupPreview;data:BackupData;imageBlobs:Map<string,{full:Blob;thumbnail:Blob}>}

const json=(value:unknown)=>JSON.stringify(value,null,2);
const sha256=async(value:Blob|Uint8Array|string)=>{
  const bytes=typeof value==="string"?encoder.encode(value):value instanceof Blob?new Uint8Array(await value.arrayBuffer()):value;
  const stable=new Uint8Array(bytes).buffer as ArrayBuffer;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",stable))].map(x=>x.toString(16).padStart(2,"0")).join("");
};
const unique=(values:string[],label:string)=>{if(new Set(values).size!==values.length)throw new Error(`${label}包含重复 UUID`)};

async function snapshot():Promise<{data:BackupData;rawImages:StoredImage[]}>{
  return db.transaction("r",[db.recipes,db.categories,db.tags,db.cookRecords,db.images,db.ocrRecords],async()=>{
    const [recipes,categories,tags,cookRecords,rawImages,ocrRecords]=await Promise.all([db.recipes.toArray(),db.categories.toArray(),db.tags.toArray(),db.cookRecords.toArray(),db.images.toArray(),db.ocrRecords.toArray()]);
    const recipeIds=new Set(recipes.map(x=>x.id)),imageIds=new Set(rawImages.map(x=>x.id));
    if(cookRecords.some(x=>!recipeIds.has(x.recipeId))||rawImages.some(x=>!recipeIds.has(x.recipeId))||ocrRecords.some(x=>!recipeIds.has(x.recipeId)||!imageIds.has(x.imageId)))throw new Error("本地数据存在无效关联，已停止导出");
    return{data:{recipes,categories,tags,cookRecords,images:[],ocrRecords},rawImages};
  });
}

export async function exportBackup(onProgress?:(progress:number)=>void){
  const {data,rawImages:storedImages}=await snapshot(),rawImages=[] as StoredImage[];
  for(const image of storedImages){
    const blob=image.blob.size?image.blob:image.remoteFull?await fetchRemoteImage(image.id,"full"):image.blob;
    const thumbnailBlob=image.thumbnailBlob.size?image.thumbnailBlob:image.remoteThumb?await fetchRemoteImage(image.id,"thumb"):image.thumbnailBlob;
    rawImages.push({...image,blob,thumbnailBlob});
  }
  if(rawImages.some(x=>!x.blob.size||!x.thumbnailBlob.size))throw new Error("存在缺失的图片 Blob，已停止导出");
  const zip=new JSZip(),files=new Map<string,Blob|Uint8Array|string>();
  const add=(path:string,value:Blob|Uint8Array|string)=>files.set(path,value);
  const imageMeta:ImageMeta[]=[];
  for(let i=0;i<rawImages.length;i++){
    const image=rawImages[i],fullPath=`images/full/${image.id}.bin`,thumbnailPath=`images/thumbnails/${image.id}.bin`;
    const fullBytes=new Uint8Array(await image.blob.arrayBuffer()),thumbnailBytes=new Uint8Array(await image.thumbnailBlob.arrayBuffer());
    add(fullPath,fullBytes);add(thumbnailPath,thumbnailBytes);
    const {blob:_,thumbnailBlob:__,...metadata}=image;
    imageMeta.push({...metadata,fullPath,thumbnailPath,fullSha256:await sha256(fullBytes),thumbnailSha256:await sha256(thumbnailBytes)});
    onProgress?.((i+1)/Math.max(rawImages.length,1)*0.45);
  }
  data.images=imageMeta;
  const ingredients=data.recipes.flatMap(recipe=>recipe.ingredients.map(item=>({...item,recipeId:recipe.id})));
  const steps=data.recipes.flatMap(recipe=>recipe.steps.map(item=>({...item,recipeId:recipe.id})));
  const recipeCategories=data.recipes.flatMap(recipe=>recipe.categoryIds.map(categoryId=>({recipeId:recipe.id,categoryId})));
  const recipeTags=data.recipes.flatMap(recipe=>recipe.tagIds.map(tagId=>({recipeId:recipe.id,tagId})));
  const recipes=data.recipes.map(({ingredients:_,steps:__,categoryIds:___,tagIds:____,...recipe})=>recipe);
  const dataFiles:Record<string,unknown>={
    "data/recipes.json":recipes,"data/ingredients.json":ingredients,"data/steps.json":steps,
    "data/categories.json":data.categories,"data/tags.json":data.tags,
    "data/recipe-categories.json":recipeCategories,"data/recipe-tags.json":recipeTags,
    "data/cook-records.json":data.cookRecords,"data/images.json":imageMeta,"data/ocr-records.json":data.ocrRecords
  };
  for(const [path,value] of Object.entries(dataFiles))add(path,json(value));
  const createdAt=now(),counts={recipes:recipes.length,ingredients:ingredients.length,steps:steps.length,categories:data.categories.length,tags:data.tags.length,cookRecords:data.cookRecords.length,images:imageMeta.length,ocrRecords:data.ocrRecords.length};
  add("manifest.json",json({backupFormat:BACKUP_FORMAT,backupVersion:BACKUP_VERSION,appName:"PourRecipe",appVersion:"0.3.0",createdAt,sourceDatabaseVersion:5,counts,includesTrash:data.recipes.some(x=>!!x.deletedAt),checksumAlgorithm:"SHA-256"}));
  const checksums=[] as Array<{path:string;size:number;sha256:string}>;
  let index=0;for(const [path,value] of files){const size=typeof value==="string"?encoder.encode(value).byteLength:value instanceof Blob?value.size:value.byteLength;checksums.push({path,size,sha256:await sha256(value)});zip.file(path,value);onProgress?.(0.45+(++index/files.size)*0.35)}
  zip.file("checksums.json",json(checksums));
  const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}},metadata=>onProgress?.(0.8+metadata.percent/500));
  const stamp=createdAt.replace(/[-:]/g,"").replace("T","-").slice(0,15);
  return{blob,filename:`PourRecipe-Backup-${stamp}.zip`,preview:{counts,estimatedBytes:blob.size,includesTrash:data.recipes.some(x=>!!x.deletedAt),createdAt}};
}

const required=["manifest.json","checksums.json","data/recipes.json","data/ingredients.json","data/steps.json","data/categories.json","data/tags.json","data/recipe-categories.json","data/recipe-tags.json","data/cook-records.json","data/images.json","data/ocr-records.json"];
async function readJson<T>(zip:JSZip,path:string){const file=zip.file(path);if(!file)throw new Error(`备份缺少 ${path}`);try{return JSON.parse(await file.async("string")) as T}catch{throw new Error(`${path} JSON 已损坏`)}}

export async function validateBackup(file:Blob):Promise<ValidatedBackup>{
  if(file.size===0||file.size>MAX_ZIP_SIZE)throw new Error("ZIP 为空或超过 512 MB 限制");
  let zip:JSZip;try{zip=await JSZip.loadAsync(await file.arrayBuffer())}catch{throw new Error("文件不是有效 ZIP")}
  const entries=Object.values(zip.files);if(entries.length>MAX_ENTRIES)throw new Error("ZIP 文件数量异常");
  const sizes=entries.reduce((sum,entry)=>{const data=(entry as JSZip.JSZipObject&{_data?:{compressedSize?:number;uncompressedSize?:number}})._data;return{compressed:sum.compressed+(data?.compressedSize??0),uncompressed:sum.uncompressed+(data?.uncompressedSize??0)}},{compressed:0,uncompressed:0});
  if(sizes.uncompressed>MAX_UNCOMPRESSED||(sizes.uncompressed>10*1024*1024&&sizes.compressed>0&&sizes.uncompressed/sizes.compressed>200))throw new Error("ZIP 解压体积或压缩比异常");
  for(const entry of entries){const unsafe=(entry as JSZip.JSZipObject&{unsafeOriginalName?:string}).unsafeOriginalName??entry.name;if(unsafe.split(/[\\/]/).includes("..")||unsafe.startsWith("/"))throw new Error("ZIP 包含不安全路径")}
  for(const path of required)if(!zip.file(path))throw new Error(`备份缺少 ${path}`);
  const manifest=await readJson<Record<string,unknown>>(zip,"manifest.json");
  if(manifest.backupFormat!==BACKUP_FORMAT)throw new Error("不是 PourRecipe 备份");
  if(manifest.backupVersion!==BACKUP_VERSION)throw new Error("不支持的备份版本");
  const checksumRows=await readJson<Array<{path:string;size:number;sha256:string}>>(zip,"checksums.json");
  let uncompressed=0;
  for(const row of checksumRows){if(!row.path||!/^[a-f0-9]{64}$/i.test(row.sha256))throw new Error("checksums.json 无效");const item=zip.file(row.path);if(!item)throw new Error(`备份缺少 ${row.path}`);const bytes=await item.async("uint8array");uncompressed+=bytes.byteLength;if(uncompressed>MAX_UNCOMPRESSED)throw new Error("ZIP 解压后超过 1 GB 限制");if(bytes.byteLength!==row.size||await sha256(bytes)!==row.sha256)throw new Error(`${row.path} 校验失败`)}
  const recipesRaw=await readJson<Array<Omit<Recipe,"ingredients"|"steps"|"categoryIds"|"tagIds">>>(zip,"data/recipes.json");
  const ingredients=await readJson<Array<Recipe["ingredients"][number]&{recipeId:string}>>(zip,"data/ingredients.json");
  const steps=await readJson<Array<Recipe["steps"][number]&{recipeId:string}>>(zip,"data/steps.json");
  const categories=await readJson<Taxonomy[]>(zip,"data/categories.json"),tags=await readJson<Taxonomy[]>(zip,"data/tags.json");
  const recipeCategories=await readJson<Array<{recipeId:string;categoryId:string}>>(zip,"data/recipe-categories.json");
  const recipeTags=await readJson<Array<{recipeId:string;tagId:string}>>(zip,"data/recipe-tags.json");
  const cookRecords=await readJson<CookRecord[]>(zip,"data/cook-records.json"),images=await readJson<ImageMeta[]>(zip,"data/images.json"),ocrRecords=await readJson<OcrRecord[]>(zip,"data/ocr-records.json");
  const idGroups:[string,string[]][]= [["食谱",recipesRaw.map(x=>x.id)],["分类",categories.map(x=>x.id)],["标签",tags.map(x=>x.id)],["制作记录",cookRecords.map(x=>x.id)],["图片",images.map(x=>x.id)],["OCR记录",ocrRecords.map(x=>x.id)]];
  for(const [label,ids] of idGroups){if(ids.some(id=>!uuid.test(id)))throw new Error(`${label}包含无效 UUID`);unique(ids,label)}
  const recipeIds=new Set(recipesRaw.map(x=>x.id)),categoryIds=new Set(categories.map(x=>x.id)),tagIds=new Set(tags.map(x=>x.id)),imageIds=new Set(images.map(x=>x.id));
  if(ingredients.some(x=>!recipeIds.has(x.recipeId))||steps.some(x=>!recipeIds.has(x.recipeId))||cookRecords.some(x=>!recipeIds.has(x.recipeId))||images.some(x=>!recipeIds.has(x.recipeId))||recipeCategories.some(x=>!recipeIds.has(x.recipeId)||!categoryIds.has(x.categoryId))||recipeTags.some(x=>!recipeIds.has(x.recipeId)||!tagIds.has(x.tagId))||ocrRecords.some(x=>!recipeIds.has(x.recipeId)||!imageIds.has(x.imageId)))throw new Error("备份包含无效关联");
  const imageBlobs=new Map<string,{full:Blob;thumbnail:Blob}>();
  for(const image of images){if(!["image/jpeg","image/png","image/webp"].includes(image.mimeType))throw new Error("备份包含不支持的图片 MIME");const full=zip.file(image.fullPath),thumb=zip.file(image.thumbnailPath);if(!full||!thumb)throw new Error(`图片 ${image.id} 文件缺失`);const fullBytes=await full.async("uint8array"),thumbBytes=await thumb.async("uint8array");const fullBlob=new Blob([new Uint8Array(fullBytes).buffer as ArrayBuffer],{type:image.mimeType}),thumbnail=new Blob([new Uint8Array(thumbBytes).buffer as ArrayBuffer],{type:image.mimeType});if(await sha256(fullBlob)!==image.fullSha256||await sha256(thumbnail)!==image.thumbnailSha256)throw new Error(`图片 ${image.id} 哈希错误`);imageBlobs.set(image.id,{full:fullBlob,thumbnail})}
  const recipes=recipesRaw.map(recipe=>({...recipe,ingredients:ingredients.filter(x=>x.recipeId===recipe.id).map(({recipeId:_,...x})=>x),steps:steps.filter(x=>x.recipeId===recipe.id).map(({recipeId:_,...x})=>x),categoryIds:recipeCategories.filter(x=>x.recipeId===recipe.id).map(x=>x.categoryId),tagIds:recipeTags.filter(x=>x.recipeId===recipe.id).map(x=>x.tagId)}));
  const createdAt=String(manifest.createdAt??"");
  return{preview:{counts:manifest.counts as Record<string,number>,estimatedBytes:file.size,includesTrash:Boolean(manifest.includesTrash),createdAt},data:{recipes,categories,tags,cookRecords,images,ocrRecords},imageBlobs};
}

export async function importBackup(validated:ValidatedBackup,mode:"replace"|"merge"){
  const safetyBackup=mode==="replace"?await exportBackup():null;
  await db.transaction("rw",[db.recipes,db.categories,db.tags,db.cookRecords,db.images,db.ocrRecords,db.syncQueue,db.syncConflicts],async()=>{
    if(mode==="replace")await Promise.all([db.recipes.clear(),db.categories.clear(),db.tags.clear(),db.cookRecords.clear(),db.images.clear(),db.ocrRecords.clear(),db.syncQueue.clear(),db.syncConflicts.clear()]);
    const insert=async<T extends {id:string;revision?:number}>(table:Table<T,string>,values:T[],objectType:"recipe"|"category"|"tag"|"cook_record"|"ocr_record")=>{for(const value of values){const local=await table.get(value.id);if(!local||mode==="replace")await table.put(value);else await db.syncConflicts.put({id:`${objectType}:${value.id}`,objectId:value.id,objectType,localData:JSON.stringify(local),remoteData:JSON.stringify(value),remoteRevision:value.revision??0,createdAt:now()})}};
    await insert(db.categories as unknown as Table<Taxonomy,string>,validated.data.categories,"category");await insert(db.tags as unknown as Table<Taxonomy,string>,validated.data.tags,"tag");await insert(db.recipes as unknown as Table<Recipe,string>,validated.data.recipes,"recipe");await insert(db.cookRecords as unknown as Table<CookRecord,string>,validated.data.cookRecords,"cook_record");
    for(const metadata of validated.data.images){if(mode==="merge"&&await db.images.get(metadata.id))continue;const blobs=validated.imageBlobs.get(metadata.id)!;const {fullPath:_,thumbnailPath:__,fullSha256:___,thumbnailSha256:____,...image}=metadata;await db.images.put({...image,blob:blobs.full,thumbnailBlob:blobs.thumbnail})}
    await insert(db.ocrRecords as unknown as Table<OcrRecord,string>,validated.data.ocrRecords,"ocr_record");
  });
  return{safetyBackup,conflicts:await db.syncConflicts.count()};
}

export function downloadBackup(blob:Blob,filename:string){const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=filename;anchor.hidden=true;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export async function shareBackup(blob:Blob,filename:string){const file=new File([blob],filename,{type:"application/zip"});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:"PourRecipe 完整备份",files:[file]});return true}downloadBackup(blob,filename);return false}
