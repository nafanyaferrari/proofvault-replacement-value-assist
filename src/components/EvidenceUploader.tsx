import { ChangeEvent } from 'react';
import { Camera, FileText, Plus, X } from 'lucide-react';

interface EvidenceUploaderProps {
  label: string;
  hint: string;
  values: string[];
  accept?: string;
  max?: number;
  onChange: (values: string[]) => boolean;
  onError: (message: string) => void;
}

export function EvidenceUploader({label,hint,values,accept='image/*',max=3,onChange,onError}:EvidenceUploaderProps){
 const add=async(event:ChangeEvent<HTMLInputElement>)=>{const files=Array.from(event.target.files??[]);event.target.value='';if(values.length+files.length>max){onError(`${label} allows up to ${max} files.`);return}if(files.some(file=>file.size>1_250_000)){onError('Each evidence file must be smaller than 1.25 MB for browser storage.');return}try{const encoded=await Promise.all(files.map(file=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)})));if(onChange([...values,...encoded]))onError('')}catch{onError('One of the selected files could not be read.')}};
 return <div className="evidenceUploader"><div className="evidenceHead"><div><b>{label}</b><small>{hint}</small></div><label><Plus/>Add<input type="file" accept={accept} multiple onChange={add}/></label></div><div className="evidenceFiles">{values.map((value,index)=><div className="evidenceFile" key={`${value.slice(0,30)}-${index}`}>{value.startsWith('data:image')?<img src={value} alt={`${label} ${index+1}`}/>:value.startsWith('data:application/pdf')?<FileText/>:<Camera/>}<span>{value.startsWith('data:application/pdf')?'PDF document':value.startsWith('data:')?'Saved evidence':'Sample evidence'}</span><button type="button" onClick={()=>onChange(values.filter((_,i)=>i!==index))} aria-label={`Remove ${label} file ${index+1}`}><X/></button></div>)}</div></div>
}
