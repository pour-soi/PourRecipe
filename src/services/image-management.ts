import {db,now} from "../data/db";
import {getOrCreateOcrRecord,saveImage} from "../data/operations";
import type {ImageType,StoredImage} from "../data/types";
import {processImage} from "./images";

export async function changeImageType(image:StoredImage,type:ImageType){
  const saved={...image,type,updatedAt:now()};
  await saveImage(saved);
  if(type==="source")await getOrCreateOcrRecord(image.recipeId,image.id);
  return saved;
}

export async function replaceImageFile(image:StoredImage,file:File){
  const replacement=await processImage(file,{recipeId:image.recipeId,type:image.type,cookRecordId:image.cookRecordId,stepId:image.stepId,sortOrder:image.sortOrder});
  return saveImage({...image,blob:replacement.blob,thumbnailBlob:replacement.thumbnailBlob,mimeType:replacement.mimeType,width:replacement.width,height:replacement.height,updatedAt:now(),remoteFull:false,remoteThumb:false});
}

export async function reorderImages(images:StoredImage[],index:number,direction:-1|1){
  const sorted=[...images].filter(image=>!image.deletedAt).sort((a,b)=>a.sortOrder-b.sortOrder),target=index+direction;
  if(target<0||target>=sorted.length)return sorted;
  [sorted[index],sorted[target]]=[sorted[target],sorted[index]];
  for(const [sortOrder,image] of sorted.entries())if(image.sortOrder!==sortOrder){const current=await db.images.get(image.id);await saveImage({...current??image,sortOrder,updatedAt:now()})}
  return sorted;
}

export async function saveImageNote(image:StoredImage,note:string){
  return saveImage({...image,note,updatedAt:now()});
}
