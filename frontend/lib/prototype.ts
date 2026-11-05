import {seedData, initialQuestions, type Question, type Role} from './domain';
export type ReviewRole = 'SECURITY'|'INFRA';
export type Phase = '작성 중'|'사전 협의 중'|'보완 중'|'제출 준비'|'제출됨';
export type CheckState = {checks:boolean[]; opinion:string; done:boolean};
export type Event = {text:string;who:string;time:string};
export type Answer = {key:string;title:string;value:string;confirmed:boolean;confirmedBy?:Role;source:string};
export type Supplement = {id:string;field:string;reason:string;role:ReviewRole;answer:string;resolved:boolean};
export type Case = {id:string;title:string;summary:string;department:string;applicant:string;due:string;priority:string;type:string;phase:Phase;version:number;configVersion:string;workflow:string;questions:Question[];answers:Answer[];reviews:Record<ReviewRole,CheckState>;supplements:Supplement[];events:Event[];createdAt:string;submittedAt?:string;submission?:{version:number;title:string;summary:string;answers:Answer[];configVersion:string};note:string};
export type State = {revision:number;requests:Case[];config:{version:number;draft:Question[];published:Question[];workflow:string;publishedWorkflow:string;dirty:boolean;history:{version:number;time:string;count:number}[]}};
export const now = ()=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
export const roleName:Record<Role,string>={SECURITY:'정보보안',INFRA:'ICT인프라',APPLICANT:'신청자',ADMIN:'기관 관리자'};
export const checklists:Record<ReviewRole,string[]>={SECURITY:['개인정보 항목·보유기간 확인','외부 전송 범위·목적 확인','사용자·관리자 접근권한 확인'],INFRA:['서버·DB 구성 및 운영 환경 확인','출발지·목적지·프로토콜·포트 확인','접속 기간 및 운영 책임 확인']};
export const blankReviews=():Record<ReviewRole,CheckState>=>({SECURITY:{checks:[false,false,false],opinion:'',done:false},INFRA:{checks:[false,false,false],opinion:'',done:false}});
export const demoAnswers=():Answer[]=>[{key:'system',title:'운영 환경',value:'내부 서버 · Oracle DB',confirmed:false,source:'시연 사업계획서 · 2절: “내부 서버와 Oracle DB를 사용합니다.”'},{key:'external',title:'외부 연계',value:'공공데이터 API · HTTPS',confirmed:false,source:'시연 사업계획서 · 3절: “공공데이터 API와 HTTPS로 연계합니다.”'},{key:'privacy',title:'개인정보 처리 범위',value:'담당자 확인 필요',confirmed:false,source:'원문에 구체적인 개인정보 항목·보유기간이 없습니다.'}];
export function initialState():State {
 const requests=seedData().requests.map((r,i):Case=>{const reviews=blankReviews(); if(r.status==='협의 완료'){Object.values(reviews).forEach(v=>{v.done=true;v.checks=[true,true,true];v.opinion='시연 검토 기록: 담당 분야 확인 완료';});}return {...r,phase:r.status==='협의 완료'?'제출 준비':r.status==='보완 대기'?'보완 중':'사전 협의 중',version:1,configVersion:'v2.3',workflow:'병렬 검토',questions:structuredClone(initialQuestions),answers:demoAnswers(),reviews,supplements:r.status==='보완 대기'?[{id:'supp-'+i,field:'개인정보 보유기간',reason:'보유기간과 파기 기준을 확인해 주세요.',role:'SECURITY',answer:'',resolved:false}]:[],events:[{text:'사전 협의를 요청했습니다.',who:r.applicant,time:'2026. 11. 04. 10:30'}],createdAt:'2026-11-04',note:''};});
 return {revision:1,requests,config:{version:3,draft:structuredClone(initialQuestions),published:structuredClone(initialQuestions),workflow:'병렬 검토',publishedWorkflow:'병렬 검토',dirty:false,history:[{version:3,time:'2026. 11. 04. 09:00',count:8}]}};
}
export type Action =
 | {type:'create';draft:Pick<Case,'title'|'summary'|'answers'>;consult:boolean}
 | {type:'review';id:string;version:number;review:CheckState;complete:boolean}
 | {type:'supplement';id:string;version:number;field:string;reason:string}
 | {type:'answer';id:string;version:number;supplementId:string;answer:string}
 | {type:'update-answer';id:string;version:number;key:string;value:string;confirmed:boolean}
 | {type:'note';id:string;version:number;text:string}
 | {type:'submit';id:string;version:number}
 | {type:'save-config';questions:Question[];workflow:string}
 | {type:'publish'};
export function transition(input:State,action:Action,role:Role):State {
 const s=structuredClone(input);const event=(r:Case,text:string)=>{r.events.unshift({text,who:roleName[role],time:now()});r.version++;};
 if(action.type==='save-config'||action.type==='publish'){
  if(role!=='ADMIN')throw Error('기관 관리자만 설정을 변경할 수 있습니다.');
  if(action.type==='save-config'){
   if(action.questions.some(q=>!q.key.trim()||!q.title.trim()))throw Error('질문과 저장 키를 입력해 주세요.');
   if(new Set(action.questions.map(q=>q.key)).size!==action.questions.length)throw Error('질문의 저장 키는 중복될 수 없습니다.');
   s.config.draft=action.questions;s.config.workflow=action.workflow;s.config.dirty=true;
  }else{if(!s.config.dirty)throw Error('변경할 초안을 먼저 저장해 주세요.');s.config.version++;s.config.published=structuredClone(s.config.draft);s.config.publishedWorkflow=s.config.workflow;s.config.dirty=false;s.config.history.unshift({version:s.config.version,time:now(),count:s.config.published.length});}
 }else if(action.type==='create'){
  if(role!=='APPLICANT')throw Error('신청자 역할에서 신청을 작성해 주세요.');
  if(!action.draft.title.trim()||!action.draft.summary.trim())throw Error('사업명과 서비스 설명을 입력해 주세요.');
  const id=`SF-2026-${String(Math.max(...s.requests.map(r=>Number(r.id.split('-').at(-1))))+1).padStart(4,'0')}`;
  s.requests.unshift({id,...action.draft,department:'디지털혁신부',applicant:'이민주',due:'2026-11-13',priority:'보통',type:'신규 구축',phase:action.consult?'사전 협의 중':'작성 중',version:1,configVersion:`v2.${s.config.version}`,workflow:s.config.publishedWorkflow,questions:structuredClone(s.config.published),reviews:blankReviews(),supplements:[],events:[{text:'사전 협의를 요청했습니다. (시연)',who:'신청자',time:now()}],createdAt:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),note:''});
 }else{
  const r=s.requests.find(r=>r.id===action.id);if(!r)throw Error('신청을 찾을 수 없습니다.');
  if(r.version!==action.version)throw Error('다른 변경이 있습니다. 최신 내용을 불러온 뒤 다시 적용해 주세요.');
  if(action.type==='submit'){
   if(role!=='APPLICANT'||r.applicant!=='이민주')throw Error('본인의 신청만 제출할 수 있습니다.');
   if(r.phase==='제출됨')throw Error('이미 제출된 신청입니다. 제출본을 확인해 주세요.');
   if(!r.title.trim()||!r.summary.trim()||!r.answers.length||r.answers.some(a=>!a.value.trim()))throw Error('사업 정보와 답변을 입력한 뒤 제출해 주세요.');
   if(r.answers.some(a=>!a.confirmed))throw Error('미확정 정보를 모두 확인한 뒤 제출해 주세요.');
   if(!Object.values(r.reviews).every(v=>v.done)||r.supplements.some(x=>!x.resolved))throw Error('담당자 협의와 보완을 먼저 완료해 주세요.');
   r.phase='제출됨';r.submittedAt=now();r.submission={version:1,title:r.title,summary:r.summary,answers:structuredClone(r.answers),configVersion:r.configVersion};event(r,'제출본 v1을 확정했습니다. 실제 기관 전송은 없는 시연입니다.');
  }else if(action.type==='update-answer'){
   if(role==='ADMIN'||(role==='APPLICANT'&&r.applicant!=='이민주'))throw Error('정보를 수정할 수 없는 역할입니다.');
   if(r.phase==='제출됨')throw Error('제출본은 읽기 전용입니다.');
   if(!action.value.trim()||(action.confirmed&&/^(담당자 확인 필요|미확정|미입력|모름)$/.test(action.value.trim())))throw Error('실제 확인한 값 또는 미해당 사유를 입력해 주세요.');
   const a=r.answers.find(x=>x.key===action.key);if(!a)throw Error('항목을 찾을 수 없습니다.');
   if(a.value!==action.value){r.reviews=blankReviews();r.phase=r.supplements.some(x=>!x.resolved)?'보완 중':'사전 협의 중';}
   a.value=action.value;a.confirmed=action.confirmed;a.confirmedBy=role;event(r,`${a.title} 정보를 확인·수정했습니다. 값 변경 시 담당자 재검토가 필요합니다.`);
  }else if(action.type==='answer'){
   if(r.phase==='제출됨')throw Error('제출본은 읽기 전용입니다.');
   if(role!=='APPLICANT'||r.applicant!=='이민주')throw Error('본인의 보완 요청에만 답변할 수 있습니다.');
   if(!action.answer.trim())throw Error('보완 답변을 입력해 주세요.');
   const x=r.supplements.find(x=>x.id===action.supplementId);if(!x)throw Error('보완 요청을 찾을 수 없습니다.');x.answer=action.answer;x.resolved=true;r.reviews[x.role].done=false;r.reviews[x.role].checks=[false,false,false];r.phase=r.supplements.some(x=>!x.resolved)?'보완 중':'사전 협의 중';event(r,`${x.field} 보완 답변 · 담당자 재검토 필요`);
  }else{
   if(role!=='SECURITY'&&role!=='INFRA')throw Error('담당자 역할에서 검토할 수 있습니다.');
   if(r.phase==='제출됨')throw Error('제출본은 읽기 전용입니다.');
   if(action.type==='review'){
    if(r.workflow==='순차 검토'&&role==='INFRA'&&!r.reviews.SECURITY.done)throw Error('정보보안 협의를 먼저 완료해 주세요.');
    if(action.complete&&(!action.review.checks.every(Boolean)||!action.review.opinion.trim()))throw Error('검토 항목 3개와 검토 의견을 입력해 주세요.');
    if(action.complete&&r.supplements.some(x=>x.role===role&&!x.resolved))throw Error('담당 분야의 미해결 보완 요청을 먼저 확인해 주세요.');
    r.reviews[role]={...action.review,done:action.complete};r.phase=Object.values(r.reviews).every(v=>v.done)?'제출 준비':r.supplements.some(x=>!x.resolved)?'보완 중':'사전 협의 중';event(r,action.complete?'담당 분야의 사전 협의를 완료했습니다.':'검토 초안을 저장했습니다.');
   }else if(action.type==='supplement'){
    if(!action.field.trim()||!action.reason.trim())throw Error('대상 항목과 보완 이유를 입력해 주세요.');
    r.supplements.push({id:`supp-${Date.now()}`,field:action.field,reason:action.reason,role,answer:'',resolved:false});r.reviews[role].done=false;r.phase='보완 중';event(r,`${action.field} 보완을 요청했습니다.`);
   }else{if(!action.text.trim())throw Error('메모 내용을 입력해 주세요.');r.note=action.text;event(r,`내부 메모: ${action.text}`);}
  }
 }
 s.revision++;return s;
}
export const STORAGE_KEY='secureflow-design-v3-demo';
export function readState():State {try{const raw=sessionStorage.getItem(STORAGE_KEY);if(raw){const v=JSON.parse(raw);if(v.revision&&v.requests&&v.config)return v;}}catch{}return initialState();}
export function commitState(previous:State,action:Action,role:Role):State {const saved=sessionStorage.getItem(STORAGE_KEY);if(saved&&JSON.parse(saved).revision!==previous.revision)throw Error('새 변경이 감지되었습니다. 최신 상태를 불러와 다시 시도해 주세요.');const next=transition(previous,action,role);sessionStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next;}
export const documentText=(r:Case)=>`보안성검토 ${r.submission?'제출본 v1':'검토 초안'} · 시연용\n신청번호: ${r.id}\n사업명: ${r.submission?.title||r.title}\n개요: ${r.submission?.summary||r.summary}\n기관 설정: ${r.configVersion}\n생성 시각: ${r.submittedAt||now()}\n\n${(r.submission?.answers||r.answers).map(a=>`${a.title}: ${a.value} [${a.confirmed?'사용자 확인':'미확정'}]`).join('\n')}\n\n정보보안: ${r.reviews.SECURITY.opinion||'담당자 확인 필요'}\nICT인프라: ${r.reviews.INFRA.opinion||'담당자 확인 필요'}\n\n합성 데이터 시연용. 공식 신청서가 아니며 기관으로 전송되지 않았습니다.`;
