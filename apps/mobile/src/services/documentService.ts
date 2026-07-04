import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

export type StoredDocument = { uri:string; mimeType?:string; originalName:string };

export async function chooseSupportingDocument(): Promise<StoredDocument|undefined> {
  const result=await DocumentPicker.getDocumentAsync({type:['application/pdf','image/*'],copyToCacheDirectory:true,multiple:false});
  if(result.canceled)return undefined;
  const asset=result.assets[0];
  const directory=new Directory(Paths.document,'proofvault','supporting-documents');
  directory.create({idempotent:true,intermediates:true});
  const safeName=asset.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const destination=new File(directory,`${Date.now()}_${safeName}`);
  await new File(asset.uri).copy(destination);
  return{uri:destination.uri,mimeType:asset.mimeType,originalName:asset.name};
}
