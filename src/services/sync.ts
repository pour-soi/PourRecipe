import type {Table} from "dexie";
import {db,now} from "../data/db";
import {queue} from "../data/operations";
import type {CookRecord,OcrRecord,Recipe,StoredImage,SyncConflict,SyncObjectType,SyncState,Taxonomy} from "../data/types";
import {getSupabase,isSupabaseConfigured} from "./supabase";

type SyncValue=Recipe|Taxonomy|CookRecord|StoredImage|OcrRecord;
type RemoteChange={objectType:SyncObjectType;id:string;revision:number;deletedAt:string|null;data:Record<string,unknown>};
type PushResult={id:string;objectType:SyncObjectType;status:"synced"|"conflict"|"error";serverRevision:number;serverData?:Record<string,unknown>;error?:string};

const tableFor=(type:SyncObjectType):Table<SyncValue,string>=>{
  const table=type==="recipe"?db.recipes:type==="category"?db.categories:type==="tag"?db.tags:type==="cook_record"?db.cookRecords:type==="image"?db.images:db.ocrRecords;
  return table as unknown as Table<SyncValue,string>;
};
const objectFor=(type:SyncObjectType,id:string)=>tableFor(type).get(id);
const serializable=(type:SyncObjectType,value:SyncValue)=>{
  if(type==="ocr_record"){const {aiDraft:_,aiDraftUpdatedAt:__,...record}=value as OcrRecord;return record as unknown as Record<string,unknown>}
  if(type!=="image")return value as unknown as Record<string,unknown>;
  const {blob:_,thumbnailBlob:__,...metadata}=value as StoredImage;
  return metadata as unknown as Record<string,unknown>;
};

export class SupabaseSyncProvider{
  async session(){
    if(!isSupabaseConfigured())return{authenticated:false as const};
    const {data,error}=await getSupabase().auth.getSession();
    if(error||!data.session)return{authenticated:false as const};
    return{authenticated:true as const,email:data.session.user.email??"",userId:data.session.user.id};
  }

  private async uploadImage(image:StoredImage,userId:string){
    if(!["image/jpeg","image/png","image/webp"].includes(image.mimeType))throw new Error("不支持的图片类型");
    if(image.blob.size>12*1024*1024)throw new Error("完整图片超过 12 MB");
    const root=`${userId}/recipes/${image.recipeId}/images/${image.id}`;
    const storage=getSupabase().storage.from("pourrecipe-images");
    const full=await storage.upload(`${root}/full.webp`,image.blob,{contentType:image.mimeType,upsert:true});
    if(full.error)throw new Error("完整图片同步失败");
    const thumb=await storage.upload(`${root}/thumb.webp`,image.thumbnailBlob,{contentType:image.mimeType,upsert:true});
    if(thumb.error)throw new Error("缩略图同步失败");
  }

  async push(){
    const session=await this.session();
    if(!session.authenticated)throw new Error("Supabase 未登录或不可用");
    const tasks=await db.syncQueue.toArray();
    const order:Record<SyncObjectType,number>={category:0,tag:1,recipe:2,cook_record:3,image:4,ocr_record:5};
    tasks.sort((a,b)=>order[a.objectType]-order[b.objectType]);
    let synced=0,errors=0,conflicts=0;
    for(const task of tasks){
      const value=await objectFor(task.objectType,task.objectId);
      if(!value){await db.syncQueue.delete(task.id);continue}
      await tableFor(task.objectType).update(task.objectId,{syncStatus:"syncing"} as Partial<SyncValue>);
      const {data,error}=await getSupabase().rpc("push_sync_change",{p_change:{
        objectType:task.objectType,id:task.objectId,baseRevision:task.baseRevision,
        deletedAt:"deletedAt" in value?value.deletedAt??null:null,data:serializable(task.objectType,value)
      }});
      if(error){await tableFor(task.objectType).update(task.objectId,{syncStatus:"error"} as Partial<SyncValue>);await db.syncQueue.update(task.id,{attempts:task.attempts+1,lastError:"云端同步失败"});errors++;continue}
      const result=data as PushResult;
      if(result.status==="conflict"){
        const conflict:SyncConflict={id:task.id,objectId:task.objectId,objectType:task.objectType,localData:JSON.stringify(serializable(task.objectType,value)),remoteData:JSON.stringify(result.serverData??null),remoteRevision:result.serverRevision,createdAt:now()};
        await db.syncConflicts.put(conflict);await tableFor(task.objectType).update(task.objectId,{syncStatus:"conflict"} as Partial<SyncValue>);conflicts++;continue;
      }
      if(task.objectType==="image"&&!value.deletedAt)await this.uploadImage(value as StoredImage,session.userId);
      await tableFor(task.objectType).update(task.objectId,{revision:result.serverRevision,syncStatus:"synced"} as Partial<SyncValue>);
      await db.syncQueue.delete(task.id);synced++;
    }
    return{synced,errors,conflicts};
  }

  async pull(reset=false){
    const session=await this.session();if(!session.authenticated)throw new Error("Supabase 未登录或不可用");
    const state=await getState(),cursor=reset?0:state.cursor;
    const {data,error}=await getSupabase().rpc("pull_sync_changes",{p_since:cursor});
    if(error)throw new Error("无法恢复云端数据");
    const changes=(data??[]) as Array<RemoteChange&{cursor:number}>;
    for(const change of changes)await applyRemote(change);
    await db.syncState.put({...state,cursor:changes.at(-1)?.cursor??cursor,lastSyncedAt:now()});
  }

  async downloadImage(image:StoredImage,variant:"full"|"thumb"){
    const session=await this.session();if(!session.authenticated)throw new Error("Supabase 未登录");
    const path=`${session.userId}/recipes/${image.recipeId}/images/${image.id}/${variant==="full"?"full.webp":"thumb.webp"}`;
    const {data,error}=await getSupabase().storage.from("pourrecipe-images").download(path);
    if(error)throw new Error("图片下载失败");return data;
  }

  async permanentlyDeleteRecipe(id:string){
    const session=await this.session();if(!session.authenticated)throw new Error("Supabase 未登录");
    const images=await db.images.where("recipeId").equals(id).toArray();
    const paths=images.flatMap(image=>{const root=`${session.userId}/recipes/${id}/images/${image.id}`;return[`${root}/full.webp`,`${root}/thumb.webp`]});
    if(paths.length){const removed=await getSupabase().storage.from("pourrecipe-images").remove(paths);if(removed.error)throw new Error("云端图片清理失败，尚未删除食谱数据")}
    const {data,error}=await getSupabase().rpc("permanently_delete_recipe",{p_recipe_id:id});
    if(error)throw new Error("云端永久删除失败");return data as {ok:boolean};
  }
}

export const syncProvider=new SupabaseSyncProvider();
export const getSession=()=>syncProvider.session();
export async function syncNow(){const state=await getState();if(state.paused)return{synced:0,errors:0,conflicts:0};const result=await syncProvider.push();if(!result.conflicts)await syncProvider.pull();await db.syncState.put({...await getState(),lastSyncedAt:now()});return result}
export const pullChanges=(reset=false)=>syncProvider.pull(reset);

async function applyRemote(change:RemoteChange){
  const task=await db.syncQueue.get(`${change.objectType}:${change.id}`),local=await objectFor(change.objectType,change.id);
  if(task&&local){await db.syncConflicts.put({id:task.id,objectId:change.id,objectType:change.objectType,localData:JSON.stringify(serializable(change.objectType,local)),remoteData:JSON.stringify(change.data),remoteRevision:change.revision,createdAt:now()});await tableFor(change.objectType).update(change.id,{syncStatus:"conflict"} as Partial<SyncValue>);return}
  if(change.objectType==="image"){
    const image=change.data as unknown as StoredImage;
    await db.images.put({...image,id:change.id,blob:new Blob(),thumbnailBlob:new Blob(),revision:change.revision,deletedAt:change.deletedAt,syncStatus:"synced",remoteFull:true,remoteThumb:true});return;
  }
  await tableFor(change.objectType).put({...change.data,id:change.id,revision:change.revision,deletedAt:change.deletedAt,syncStatus:"synced"} as unknown as SyncValue);
}

export async function resolveConflict(id:string,choice:"local"|"remote"){
  const conflict=await db.syncConflicts.get(id);if(!conflict)return;
  if(choice==="local"){await db.syncQueue.update(id,{baseRevision:conflict.remoteRevision,lastError:null,attempts:0});await tableFor(conflict.objectType).update(conflict.objectId,{syncStatus:"pending"} as Partial<SyncValue>)}
  else{const remote=JSON.parse(conflict.remoteData) as Record<string,unknown>;await tableFor(conflict.objectType).put({...remote,id:conflict.objectId,revision:conflict.remoteRevision,syncStatus:"synced"} as unknown as SyncValue);await db.syncQueue.delete(id)}
  await db.syncConflicts.delete(id);
}

export async function beginSync(mode:"upload"|"download"|"merge"|"later",email:string,localBackupConfirmed=false){
  const state=await getState();if(mode==="later"){await db.syncState.put({...state,accountEmail:email,onboardingComplete:false});return}
  if(mode==="download"){
    if(!localBackupConfirmed)throw new Error("下载云端数据前必须先导出本地 ZIP 安全快照");
    await db.transaction("rw",[db.recipes,db.categories,db.tags,db.cookRecords,db.images,db.ocrRecords,db.syncQueue,db.syncConflicts],async()=>Promise.all([db.recipes.clear(),db.categories.clear(),db.tags.clear(),db.cookRecords.clear(),db.images.clear(),db.ocrRecords.clear(),db.syncQueue.clear(),db.syncConflicts.clear()]));
    await db.syncState.put({...state,cursor:0,accountEmail:email,onboardingComplete:true});await pullChanges(true);return;
  }
  await queueAll();await db.syncState.put({...state,cursor:0,accountEmail:email,onboardingComplete:true});await syncNow();await pullChanges(true);
}
export async function queueAll(){for(const item of await db.categories.toArray())await queue(item.id,"category","upsert",item.revision??0);for(const item of await db.tags.toArray())await queue(item.id,"tag","upsert",item.revision??0);for(const item of await db.recipes.toArray())await queue(item.id,"recipe",item.deletedAt?"delete":"upsert",item.revision);for(const item of await db.cookRecords.toArray())await queue(item.id,"cook_record",item.deletedAt?"delete":"upsert",item.revision??0);for(const item of await db.images.toArray())await queue(item.id,"image",item.deletedAt?"delete":"upsert",item.revision??0);for(const item of await db.ocrRecords.toArray())await queue(item.id,"ocr_record",item.deletedAt?"delete":"upsert",item.revision)}
export async function getState():Promise<SyncState>{return await db.syncState.get("sync")??{id:"sync",cursor:0,lastSyncedAt:null,paused:false,accountEmail:null,onboardingComplete:false}}
export async function setPaused(paused:boolean){await db.syncState.put({...await getState(),paused})}
export async function fetchRemoteImage(id:string,variant:"full"|"thumb"){const image=await db.images.get(id);if(!image)throw new Error("图片不存在");return syncProvider.downloadImage(image,variant)}
export const deleteRemoteRecipe=(id:string)=>syncProvider.permanentlyDeleteRecipe(id);
