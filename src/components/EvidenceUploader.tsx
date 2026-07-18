import { ChangeEvent, useEffect, useState } from 'react';
import { Camera, FileText, Plus, X } from 'lucide-react';
import { evidenceStorageService, EvidenceKind, isSupabaseStorageReference } from '../services/evidenceStorageService';

interface EvidenceUploaderProps {
  label: string;
  hint: string;
  values: string[];
  itemId: string;
  kind: EvidenceKind;
  accept?: string;
  max?: number;
  onChange: (values: string[]) => boolean;
  onError: (message: string) => void;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)});
}

function EvidencePreview({value,label,index}:{value:string;label:string;index:number}) {
 const [resolved,setResolved]=useState(value);
 useEffect(()=>{let active=true;evidenceStorageService.resolveDisplayUrl(value).then(url=>{if(active)setResolved(url||value)}).catch(()=>{if(active)setResolved('')});return()=>{active=false}},[value]);
 if(resolved.startsWith('data:image')||resolved.startsWith('http')) return <img src={resolved} alt={`${label} ${index+1}`}/>;
 if(value.startsWith('data:application/pdf')||isSupabaseStorageReference(value)) return <FileText/>;
 return <Camera/>;
}

export function EvidenceUploader({label,hint,values,itemId,kind,accept='image/*',max=3,onChange,onError}:EvidenceUploaderProps){
 const [uploading,setUploading]=useState(false);
 const add=async(event:ChangeEvent<HTMLInputElement>)=>{const files=Array.from(event.target.files??[]);event.target.value='';if(values.length+files.length>max){onError(`${label} allows up to ${max} files.`);return}const cloudReady=await evidenceStorageService.canUseCloudStorage();const maxSize=cloudReady?10_000_000:1_250_000;if(files.some(file=>file.size>maxSize)){onError(cloudReady?'Each evidence file must be smaller than 10 MB for this demo upload.':'Each evidence file must be smaller than 1.25 MB for browser storage.');return}setUploading(true);try{const encoded=await Promise.all(files.map(file=>cloudReady?evidenceStorageService.uploadFile(file,itemId,kind):readFileAsDataUrl(file)));if(onChange([...values,...encoded]))onError('')}catch(reason){onError(reason instanceof Error?reason.message:'One of the selected files could not be saved.')}finally{setUploading(false)}};
 return <div className="evidenceUploader"><div className="evidenceHead"><div><b>{label}</b><small>{hint}</small></div><label><Plus/>{uploading?'Saving…':'Add'}<input type="file" accept={accept} multiple disabled={uploading} onChange={add}/></label></div><div className="evidenceFiles">{values.map((value,index)=><div className="evidenceFile" key={`${value.slice(0,30)}-${index}`}><EvidencePreview value={value} label={label} index={index}/><span>{isSupabaseStorageReference(value)?'Cloud evidence':value.startsWith('data:application/pdf')?'PDF document':value.startsWith('data:')?'Saved evidence':'Sample evidence'}</span><button type="button" onClick={()=>onChange(values.filter((_,i)=>i!==index))} aria-label={`Remove ${label} file ${index+1}`}><X/></button></div>)}</div></div>
}
