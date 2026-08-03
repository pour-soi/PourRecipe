import Dexie,{type EntityTable} from "dexie";
import type {CookRecord,OcrRecord,Recipe,StoredImage,SyncConflict,SyncState,SyncTask,Taxonomy} from "./types";

export class PourRecipeDB extends Dexie {
  recipes!:EntityTable<Recipe,"id">; categories!:EntityTable<Taxonomy,"id">; tags!:EntityTable<Taxonomy,"id">;
  cookRecords!:EntityTable<CookRecord,"id">; images!:EntityTable<StoredImage,"id">; syncQueue!:EntityTable<SyncTask,"id">;
  ocrRecords!:EntityTable<OcrRecord,"id">;syncConflicts!:EntityTable<SyncConflict,"id">;syncState!:EntityTable<SyncState,"id">;
  constructor(name="pourrecipe"){super(name);this.version(2).stores({
    recipes:"id,status,updatedAt,deletedAt,*categoryIds,*tagIds",
    categories:"id,sortOrder,&name",tags:"id,&name",
    cookRecords:"id,recipeId,cookedAt,isBestVersion",
    images:"id,recipeId,cookRecordId,stepId,type,sortOrder",
    syncQueue:"id,objectId,objectType,createdAt"
  });this.version(3).stores({
    recipes:"id,status,updatedAt,deletedAt,*categoryIds,*tagIds",
    categories:"id,sortOrder,&name,deletedAt",tags:"id,&name,deletedAt",
    cookRecords:"id,recipeId,cookedAt,isBestVersion,deletedAt",
    images:"id,recipeId,cookRecordId,stepId,type,sortOrder,deletedAt",
    syncQueue:"id,objectId,objectType,updatedAt",
    syncConflicts:"id,objectId,objectType,createdAt",
    syncState:"id"
  }).upgrade(async tx=>{await tx.table("syncQueue").clear()});this.version(4).stores({
    recipes:"id,status,updatedAt,deletedAt,*categoryIds,*tagIds",
    categories:"id,sortOrder,&name,deletedAt",tags:"id,&name,deletedAt",
    cookRecords:"id,recipeId,cookedAt,isBestVersion,deletedAt",
    images:"id,recipeId,cookRecordId,stepId,type,sortOrder,deletedAt",
    ocrRecords:"id,recipeId,imageId,status,updatedAt,deletedAt",
    syncQueue:"id,objectId,objectType,updatedAt",
    syncConflicts:"id,objectId,objectType,createdAt",
    syncState:"id"
  });this.version(5).stores({
    recipes:"id,status,updatedAt,deletedAt,*categoryIds,*tagIds",
    categories:"id,sortOrder,&name,deletedAt",tags:"id,&name,deletedAt",
    cookRecords:"id,recipeId,cookedAt,isBestVersion,deletedAt",
    images:"id,recipeId,cookRecordId,stepId,type,sortOrder,deletedAt",
    ocrRecords:"id,recipeId,imageId,status,updatedAt,deletedAt",
    syncQueue:"id,objectId,objectType,updatedAt",syncConflicts:"id,objectId,objectType,createdAt",syncState:"id"
  }).upgrade(async tx=>{for(const name of ["recipes","categories","tags","cookRecords","images","ocrRecords"])await tx.table(name).filter(x=>x.syncStatus==="local").modify({syncStatus:"local_only"})});}
}
export const db=new PourRecipeDB();
export const now=()=>new Date().toISOString();
export const uid=()=>{
  if(typeof globalThis.crypto?.randomUUID==="function"){
    return crypto.randomUUID();
  }

  const randomPart=Array.from({length:16},()=>Math.floor(Math.random()*16).toString(16)).join("");
  return `${Date.now().toString(36)}-${randomPart}`;
};
