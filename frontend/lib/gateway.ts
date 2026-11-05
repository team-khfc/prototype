import { seedData, nextVersion, roles, checkKey, formatTime, type Role, type WorkspaceData, type RequestItem, type Config } from './domain';
export type Command = {type:'note'|'supplement'|'complete'|'save-review';requestId:string;expectedVersion:number;role:Role;text:string;checks?:Record<string,boolean>;field?:string} | {type:'save-config';expectedVersion:number;config:Config} | {type:'publish-config';expectedVersion:number} | {type:'create-request';title:string;summary:string;department:string};
const KEY='secureflow-wide-v1';
const base=process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/,'');
export const apiMode=Boolean(base);
async function remote(path:string,options?:RequestInit):Promise<WorkspaceData>{const res=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',...options?.headers}});if(!res.ok){const error=await res.json().catch(()=>({message:'요청을 처리하지 못했습니다.'}));throw new Error(error.message||'서버 연결을 확인해 주세요.');}return res.json();}
export async function loadWorkspace():Promise<WorkspaceData>{if(base)return remote('/workspace'); const saved=localStorage.getItem(KEY);if(saved){try{const d=JSON.parse(saved);if(Array.isArray(d.requests)&&d.config?.questions)return d;}catch{/* corrupted demo state */}}return seedData();}
export function applyCommand(state:WorkspaceData,command:Command):WorkspaceData{
 const data=structuredClone(state);
 if(command.type==='create-request'){
  if(!command.title.trim()||!command.summary.trim())throw new Error('사업명과 서비스 설명을 입력해 주세요.');
  const max=Math.max(0,...data.requests.map(x=>Number(x.id.split('-').at(-1))));
  const newItem:RequestItem={...seedData().requests[0],id:`SF-2026-${String(max+1).padStart(4,'0')}`,title:command.title.trim(),summary:command.summary.trim(),department:command.department||'디지털혁신부',status:'접수 대기',priority:'보통',due:'2026-11-13',configVersion:data.config.version,checks:{},notes:[],opinion:'',rowVersion:1,updatedAt:formatTime()};data.requests.unshift(newItem);return data;
 }
 if(command.type==='save-config'||command.type==='publish-config'){
  if(command.expectedVersion!==data.config.rowVersion)throw new Error('다른 화면에서 설정이 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
  if(command.type==='save-config'){data.config={...command.config,version:data.config.version,publishedQuestions:data.config.publishedQuestions,publishedWorkflow:data.config.publishedWorkflow,dirty:true,rowVersion:data.config.rowVersion+1};}
  else {if(!data.config.dirty)throw new Error('변경한 초안을 먼저 저장해 주세요.');if(data.config.questions.some(q=>!q.title.trim()||!q.key.trim()))throw new Error('질문 제목과 항목 키를 확인해 주세요.');data.config.publishedQuestions=structuredClone(data.config.questions);data.config.publishedWorkflow=data.config.workflow;data.config.version=data.config.draftVersion;data.config.draftVersion=nextVersion(data.config.version);data.config.rowVersion++;data.config.dirty=false;}return data;
 }
 const request=data.requests.find(r=>r.id===command.requestId);if(!request)throw new Error('신청을 찾을 수 없습니다.');
 if(request.rowVersion!==command.expectedVersion)throw new Error('다른 화면에서 신청이 변경되었습니다. 새로고침 후 다시 확인해 주세요.');
 if(command.role==='APPLICANT')throw new Error('담당자 역할에서 검토할 수 있습니다.');
 if(request.status==='협의 완료'&&command.type!=='note')throw new Error('완료된 협의는 수정할 수 없습니다.');
 if(command.type==='complete'&&![0,1,2].every(i=>command.checks?.[checkKey(command.role,i)]))throw new Error('담당 검토 항목 3개를 모두 확인해 주세요.');
 if(command.type!=='save-review'&&!command.text.trim())throw new Error('내용을 입력해 주세요.');
 if(command.checks)request.checks={...request.checks,...command.checks};
 if(command.type==='save-review'||command.type==='complete')request.opinion=command.text;
 if(command.type==='complete')request.status='협의 완료';
 if(command.type==='supplement')request.status='보완 대기';
 if(command.type==='save-review'&&request.status==='접수 대기')request.status='검토 중';
 const text=command.type==='complete'?`사전 협의 완료 · ${command.text}`:command.type==='supplement'?`[${command.field||'전체'}] ${command.text}`:command.type==='save-review'?'검토 내용을 임시 저장했습니다.':command.text;
 request.notes.unshift({id:`note-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`,author:roles[command.role].person,role:roles[command.role].name,text,time:formatTime(),type:command.type==='note'?'note':command.type==='supplement'?'supplement':'event'});
 request.rowVersion++;request.updatedAt=formatTime();return data;
}
export async function executeCommand(command:Command):Promise<WorkspaceData>{if(base)return remote('/commands',{method:'POST',body:JSON.stringify(command)});const data=applyCommand(await loadWorkspace(),command);localStorage.setItem(KEY,JSON.stringify(data));return data;}
export async function resetWorkspace(){if(base)throw new Error('API 모드에서는 서버를 재시작하여 예시 데이터를 초기화합니다.');localStorage.removeItem(KEY);return seedData();}
