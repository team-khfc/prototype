/* SecureFlow KRDS prototype v0.4. Local simulation, not an authorization service. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SecureFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = p => p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9);
  const now = () => new Date().toISOString();
  const ROLES = { applicant:'신청자', infra:'ICT인프라 담당자', security:'정보보안 담당자', privacy:'개인정보 담당자', manager:'최종 검토자', admin:'기관 관리자' };
  const CONDITIONS = { always:'항상', external_yes:'외부 연계 시', personal_yes:'개인정보 처리 시', cloud:'클라우드 사용 시' };
  const PHASES = ['사업 등록·인터뷰','담당자 사전 협의','사용자 보완·제출','최종 검토·적용'];
  const unknown = v => v === undefined || v === null || !String(v).trim() || v === '확인 필요';
  function field(key,label,owner,gate,type='text',options=[],help='',condition='always',required=true) { return {key,label,owner,gate,type,options,help,condition,required}; }
  function config(id) {
    const cfg = { id, name:id==='a'?'가상 공공기관 A':'가상 공공기관 B', version:1, phaseNames:clone(PHASES),
      fields:[
        field('hosting','서버 운영 환경','applicant',1,'select',['기관 내부 서버','외부 클라우드','혼합 운영'],'서비스가 실행될 서버의 위치입니다.'),
        field('db','사용하는 데이터베이스','applicant',1,'text',[],'예: PostgreSQL, Oracle, 사용하지 않음'),
        field('personal','개인정보 처리 여부','applicant',1,'select',['포함','미포함'],'어떤 정보를 다루는지 아직 모르면 확인 필요를 선택하세요.'),
        field('external','외부 시스템 연계 여부','applicant',1,'select',['있음','없음'],'외부 API 또는 기관 밖의 서비스와 통신하는지 확인합니다.'),
        field('usePeriod','사용 기간','applicant',3,'text',[],'예: 2026-11-01 ~ 2026-11-30. 종료일 또는 상시 사용 사유를 적습니다.'),
        field('purpose','업무·통신 목적','applicant',1,'text',[],'연결이 필요한 업무와 사용할 기능을 설명하세요.'),
        field('sourceIp','출발지 IP','infra',2,'text',[],'사용자가 모르는 기술정보는 인프라 담당자가 확인합니다.','external_yes'),
        field('destIp','목적지 주소','infra',2,'text',[],'승인된 접속 대상을 확인합니다.','external_yes'),
        field('port','목적지 포트','infra',2,'text',[],'실제 필요한 포트만 확인합니다.','external_yes'),
        field('protocol','전송 프로토콜','infra',2,'select',['TCP','UDP'],'통신에 사용하는 전송 프로토콜입니다.','external_yes'),
        field('accessControl','접근통제·인증 계획','security',2,'text',[],'검토자가 확인한 설계 또는 보완 계획을 기록합니다.'),
        field('securityMeasures','보안 검토 의견','security',2,'textarea',[],'현재 확인한 사실과 향후 조치 계획을 구분하세요.')
      ],
      workflow:id==='a' ? [
        {id:'infra',title:'인프라 구성 확인',roles:['infra'],condition:'always'},
        {id:'security',title:'정보보안 사전 협의',roles:['security'],condition:'always'}
      ] : [
        {id:'parallel',title:'보안·인프라 병렬 협의',roles:['infra','security'],condition:'always'},
        {id:'privacy',title:'개인정보 추가 확인',roles:['privacy'],condition:'personal_yes'}
      ],
      templates:[
        {id:'firewall',title:id==='a'?'방화벽 정책 신청서':'외부망 접근 허용 요청서',condition:'external_yes',applyRole:'infra',fields:['hosting','sourceIp','destIp','protocol','port','purpose','usePeriod']},
        {id:'security',title:id==='a'?'정보시스템 보안성검토서':'서비스 보안 사전협의서',condition:'always',applyRole:'security',fields:['hosting','db','personal','external','accessControl','securityMeasures','usePeriod']}
      ]
    };
    if(id==='b') cfg.fields.push(field('dataScope','처리 데이터의 범위','applicant',3,'text',[],'처리하거나 저장하는 데이터의 종류와 범위를 적어주세요.'));
    return cfg;
  }
  const answer = (p,key) => p.answers[key]?.value ?? '';
  function condition(c,p) {
    if(!c || c==='always') return 'yes';
    const rules={external_yes:['external','있음'],personal_yes:['personal','포함'],cloud:['hosting','외부 클라우드']};
    if(!rules[c]) return 'unknown';
    const [key,value]=rules[c], v=answer(p,key);
    return unknown(v)?'unknown':v===value?'yes':'no';
  }
  function activeFields(p) {return p.config.fields.filter(f=>condition(f.condition,p)!=='no');}
  function activeTemplates(p) {return p.config.templates.filter(t=>condition(t.condition,p)!=='no');}
  function log(p,role,title,detail='') {p.events.push({id:uid('event'),at:now(),role,title,detail,revision:p.revision});p.updatedAt=now();}
  function createProject(cfg,info={},role='applicant') {
    if(role!=='applicant') throw Error('신청자 역할에서 새 신청을 시작하세요.');
    const p={id:uid('project'),agency:cfg.id,config:clone(cfg),name:info.name||'',department:info.department||'',description:info.description||'',serviceState:info.serviceState||'계획 중',sourceName:info.sourceName||'',phase:1,revision:1,answers:{},suggestions:[],requests:[],reviews:{},finalReviews:{},documents:[],submissions:[],applications:{},events:[],completed:false,confirmedDocs:[],createdAt:now(),updatedAt:now()};
    log(p,'applicant','신청 초안 생성',`기관 설정 v${cfg.version}을 이 신청에 고정했습니다.`);return p;
  }
  function changed(p,role,reason,keys=null) {
    p.revision++;
    if(p.phase===2 && keys && !keys.some(k=>['hosting','personal','external'].includes(k))) {
      const owners=new Set(keys.map(k=>p.config.fields.find(f=>f.key===k)?.owner));
      const first=p.config.workflow.findIndex(g=>g.roles.some(r=>owners.has(r)));
      if(first<0)p.reviews={};
      else for(const g of p.config.workflow.slice(first))for(const r of g.roles)delete p.reviews[g.id+':'+r];
    } else p.reviews={};
    p.finalReviews={};p.applications={};p.confirmedDocs=[];p.completed=false;
    log(p,role,'정보 변경',reason+' 영향받는 검토 확인을 초기화하고 과거 제출본은 보존합니다.');
  }
  function updateInfo(p,info,role) {
    if(role!=='applicant'||p.phase!==1) throw Error('사업 기본정보는 등록 단계의 신청자가 수정할 수 있습니다.');
    const keys=['name','department','description','serviceState','sourceName'];let diff=false;
    for(const k of keys)if(k in info&&p[k]!==String(info[k])){p[k]=String(info[k]);diff=true;}
    if(diff){p.suggestions=[];for(const k of Object.keys(p.answers))if(p.answers[k].source==='원문 추출 후 사용자 확인')delete p.answers[k];changed(p,role,'사업 기본정보를 수정했습니다. 원문 기반 답변을 다시 확인하세요.');}return p;
  }
  function setAnswers(p,values,role,source='직접 입력') {
    if(p.phase===4) throw Error('제출본은 수정할 수 없습니다. 담당자의 보완 요청을 먼저 진행하세요.');
    const allowed=activeFields(p).filter(f=>
      (p.phase===1&&role==='applicant'&&f.owner==='applicant') ||
      (p.phase===2&&role!=='applicant'&&role!=='admin'&&(f.owner===role||answer(p,f.key)==='확인 필요')) ||
      (p.phase===3&&role==='applicant'&&f.owner==='applicant')
    );
    const valid=new Set(allowed.map(f=>f.key));
    for(const key of Object.keys(values))if(!valid.has(key))throw Error('현재 역할 또는 단계에서는 이 항목을 수정할 수 없습니다: '+key);
    let diff=false;const changedKeys=[];
    for(const [key,raw] of Object.entries(values)) {const value=String(raw).trim().slice(0,5000);if(answer(p,key)!==value){p.answers[key]={value,source,by:role,at:now()};diff=true;changedKeys.push(key);}}
    if(diff){changed(p,role,'수집 정보가 변경되었습니다.',changedKeys);if(p.phase===3){p.needsRecheck=true;makeDocuments(p);}}return p;
  }
  function extract(p) {
    const text=p.description; const defs=[
      ['hosting',/기관 내부 서버|내부 서버|내부망 서버/,'기관 내부 서버'],
      ['hosting',/외부 클라우드/,'외부 클라우드'],
      ['db',/PostgreSQL|Oracle|MySQL|MariaDB|MongoDB/i,null],
      ['personal',/개인정보(?:는|를)?\s*(?:처리하지 않|포함하지 않|없|미포함)/,'미포함'],
      ['external',/외부\s*(?:공공데이터\s*)?API|외부 시스템과 연계/,'있음']
    ];
    const results=[];for(const [key,re,value]of defs){const m=text.match(re);if(m&&!results.some(s=>s.key===key)&&p.config.fields.some(f=>f.key===key))results.push({key,value:value||m[0],quote:m[0]});}
    p.suggestions=results;log(p,'system','사업 설명 항목 추출 (모의)',`${results.length}개 제안. 사용자 확인 전에는 사실로 확정하지 않습니다.`);return results;
  }
  function acceptSuggestions(p,role) {
    const values={};for(const s of p.suggestions)if(unknown(answer(p,s.key)))values[s.key]=s.value;
    setAnswers(p,values,role,'원문 추출 후 사용자 확인');p.suggestions=[];
  }
  function missing(p,gate=3,owner=null,allowUnknown=false) {
    return activeFields(p).filter(f=>f.required&&f.gate<=gate&&(!owner||f.owner===owner)&&(allowUnknown?!String(answer(p,f.key)).trim():unknown(answer(p,f.key))));
  }
  function sendToStaff(p,role) {
    if(role!=='applicant'||p.phase!==1)throw Error('등록 단계의 신청자만 협의를 요청할 수 있습니다.');
    if(!p.name.trim()||!p.department.trim()||p.description.trim().length<10)throw Error('프로젝트명, 담당 부서, 10자 이상의 서비스 설명을 입력하세요.');
    const ms=missing(p,1,'applicant',true);if(ms.length)throw Error('답변이 필요한 항목: '+ms.map(f=>f.label).join(', '));
    p.phase=2;log(p,role,'담당자 협의 요청',`기관 설정 v${p.config.version}에 따라 내부 시연함에 접수했습니다. 실제 알림은 전송하지 않습니다.`);
  }
  function tasks(p,final=false) {
    const done=final?p.finalReviews:p.reviews;let previous=true;const out=[];
    for(const g of p.config.workflow){const test=condition(g.condition,p);if(test==='no')continue;
      const groupDone=g.roles.every(r=>done[g.id+':'+r]);
      for(const role of g.roles)out.push({id:g.id+':'+role,role,title:g.title,group:g.id,done:!!done[g.id+':'+role],pending:test==='unknown',enabled:previous&&test==='yes',condition:g.condition});
      previous=previous&&groupDone&&test==='yes';
    }return out;
  }
  function markReview(p,taskId,role,note='',final=false) {
    if(p.phase!==(final?4:2))throw Error('현재 단계에서는 이 검토를 진행할 수 없습니다.');
    const t=tasks(p,final).find(t=>t.id===taskId);
    if(!t||t.role!==role)throw Error('해당 담당 역할로 전환한 후 검토하세요.');
    if(!t.enabled)throw Error(t.pending?'검토 조건에 필요한 정보가 미확정입니다.':'선행 담당자의 검토가 끝나지 않았습니다.');
    if(t.done)throw Error('이미 완료한 검토입니다.');
    const ms=final?missing(p):missing(p,2,role);if(ms.length)throw Error('먼저 필수 정보를 확인하세요: '+ms.map(f=>f.label).join(', '));
    if(final&&!p.submissions.length)throw Error('최종 제출본이 없습니다.');
    (final?p.finalReviews:p.reviews)[taskId]={at:now(),note:String(note).trim(),revision:p.revision,by:role};
    log(p,role,final?'제출 서류 검토 완료':'사전 협의 완료',t.title+(note?' · '+note:''));
  }
  function addRequest(p,role,text,fieldKey='') {
    if(!['security','infra','privacy','manager'].includes(role)||![2,4].includes(p.phase))throw Error('담당자 협의 또는 최종 검토 단계에서 보완을 요청하세요.');
    if(!String(text).trim())throw Error('보완 요청 내용을 입력하세요.');
    const q={id:uid('request'),text:String(text).trim(),fieldKey,by:role,at:now(),response:'',respondedAt:null};p.requests.push(q);
    if(p.phase===4){p.phase=3;p.completed=false;p.finalReviews={};p.applications={};p.confirmedDocs=[];p.needsRecheck=true;}
    log(p,role,'사용자 보완 요청',q.text);return q;
  }
  function makeDocuments(p) {
    p.documents=activeTemplates(p).map(t=>({id:t.id,title:t.title,version:p.revision,applyRole:t.applyRole,condition:t.condition,rows:[{label:'프로젝트명',value:p.name,source:'신청자'},{label:'담당 부서',value:p.department,source:'신청자'},{label:'사업 개요',value:p.description,source:p.sourceName||'사용자 설명'},...t.fields.map(key=>{const f=p.config.fields.find(f=>f.key===key);return {label:f?.label||key,value:answer(p,key)||'확인 필요',source:p.answers[key]?.source||'미확정'};})]}));return p.documents;
  }
  function sendDraft(p,role) {
    if(p.phase!==2||!['security','infra','privacy','manager'].includes(role))throw Error('담당자 협의 단계에서 초안을 전달하세요.');
    if(tasks(p).some(t=>!t.done||t.pending))throw Error('모든 필수 담당자의 사전 협의를 완료해야 합니다.');
    makeDocuments(p);p.phase=3;p.confirmedDocs=[];log(p,role,'서류 초안·보완 사항 전달',`${p.documents.length}종의 초안과 ${p.requests.filter(q=>!q.response).length}건의 보완 요청을 전달했습니다.`);
  }
  function returnToStaff(p,role) {
    if(role!=='applicant'||p.phase!==3)throw Error('사용자 보완 단계의 신청자만 재확인을 요청할 수 있습니다.');
    p.phase=2;p.reviews={};p.finalReviews={};p.confirmedDocs=[];p.applications={};p.completed=false;
    log(p,role,'담당자 재확인 요청','미확정 기술정보와 변경된 내용을 사전 협의 단계에서 다시 확인합니다.');
  }
  function respond(p,id,text,role) {
    if(role!=='applicant'||p.phase!==3)throw Error('사용자 보완 단계에서 답변하세요.');
    const q=p.requests.find(q=>q.id===id);if(!q)throw Error('보완 요청을 찾을 수 없습니다.');
    if(!String(text).trim())throw Error('보완 답변을 입력하세요.');
    if(q.response!==text){q.response=String(text).trim();q.respondedAt=now();changed(p,role,'보완 요청에 답변했습니다.');p.needsRecheck=true;makeDocuments(p);}
  }
  function submit(p,role,confirmed) {
    if(role!=='applicant'||p.phase!==3)throw Error('사용자 보완 단계에서만 최종 제출할 수 있습니다.');
    const ms=missing(p);if(ms.length)throw Error('최종 제출 전 확인할 필수 항목: '+ms.map(f=>f.label).join(', '));
    if(p.requests.some(q=>!q.response.trim()))throw Error('모든 보완 요청에 답변하세요.');
    makeDocuments(p);
    if(!confirmed||!p.documents.every(d=>confirmed.includes(d.id)))throw Error('모든 서류의 내용을 확인해 주세요.');
    p.confirmedDocs=clone(confirmed);p.phase=4;p.finalReviews={};p.applications={};
    const sub={id:uid('submission'),number:p.submissions.length+1,at:now(),revision:p.revision,configVersion:p.config.version,info:{name:p.name,department:p.department,description:p.description},answers:clone(p.answers),documents:clone(p.documents),requests:clone(p.requests)};p.submissions.push(sub);
    log(p,role,'최종 서류 제출',`제출본 #${sub.number} · 문서 v${p.revision}. 실제 전자결재가 아닌 시연 접수입니다.`);return sub;
  }
  function apply(p,docId,role,note) {
    if(p.phase!==4||!p.submissions.length)throw Error('먼저 최종 서류를 제출해야 합니다.');
    if(tasks(p,true).some(t=>!t.done||t.pending))throw Error('모든 최종 검토가 완료되어야 적용 결과를 기록할 수 있습니다.');
    const doc=p.submissions.at(-1).documents.find(d=>d.id===docId);if(!doc||doc.applyRole!==role)throw Error('해당 서류의 처리 담당자 역할로 전환하세요.');
    if(p.applications[docId])throw Error('이미 처리 결과가 기록되어 있습니다.');
    if(!String(note).trim())throw Error('수행 내용 또는 결과 근거를 입력하세요.');
    p.applications[docId]={at:now(),by:role,note:String(note).trim(),submission:p.submissions.at(-1).number};
    p.completed=p.submissions.at(-1).documents.every(d=>p.applications[d.id]);log(p,role,'모의 적용 결과 기록',doc.title+' · '+note+(p.completed?' · 전체 처리 완료':''));
  }
  function validateConfig(c) {
    const errors=[];if(c.mappingPending)errors.push('새 양식의 항목 연결 결과를 확인하세요.');if(!c.name?.trim())errors.push('기관 이름을 입력하세요.');
    const keys=new Set();for(const f of c.fields){if(!/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(f.key)||['constructor','__proto__','prototype'].includes(f.key))errors.push('올바르지 않은 항목 키');if(keys.has(f.key))errors.push('중복 항목 키');keys.add(f.key);if(!f.label.trim())errors.push('항목명을 입력하세요.');if(!ROLES[f.owner])errors.push('항목 담당자를 확인하세요.');}
    if(!c.workflow.length)errors.push('검토 단계를 하나 이상 등록하세요.');
    for(const s of c.workflow){if(!s.title.trim()||!s.roles.length)errors.push('각 검토 단계의 이름과 담당자를 지정하세요.');if(s.roles.some(r=>['applicant','admin'].includes(r)||!ROLES[r]))errors.push('검토 담당 역할이 올바르지 않습니다.');}
    if(!c.workflow.some(s=>s.condition==='always'&&s.roles.includes('security')))errors.push('항상 실행하는 정보보안 검토를 포함하세요.');
    for(const f of c.fields.filter(f=>f.required&&f.owner!=='applicant'))if(!c.workflow.some(s=>s.roles.includes(f.owner)))errors.push(f.label+'의 확인 담당자가 절차에 없습니다.');
    if(!c.templates.length)errors.push('양식을 하나 이상 등록하세요.');
    for(const t of c.templates){if(!t.title.trim()||!t.fields.length)errors.push('서류명과 항목을 지정하세요.');if(t.fields.some(k=>!keys.has(k)))errors.push('양식에 삭제된 항목이 연결되어 있습니다.');}
    return errors;
  }
  function publish(org,role) {
    if(!['security','admin'].includes(role))throw Error('정보보안 담당자 또는 기관 관리자가 게시할 수 있습니다.');
    const es=validateConfig(org.draft);if(es.length)throw Error(es.join(' '));
    const next=clone(org.draft);next.version=org.published.version+1;org.published=next;org.draft=clone(next);return next;
  }
  function createState(seed=true) {
    const a=config('a'),b=config('b');const state={schema:4,orgs:{a:{published:a,draft:clone(a)},b:{published:b,draft:clone(b)}},projects:[],activeOrg:'a',role:'applicant',prefs:{scale:1,contrast:false}};
    if(seed){const p=sampleProject(a,'staff');state.projects.push(p);const q=sampleProject(a,'supplement',{name:'내부 업무자료 검색 서비스',department:'업무지원팀 (가상)'});state.projects.push(q);const r=sampleProject(a,'final',{name:'부서 통계 현황 대시보드',department:'통계지원팀 (가상)'});state.projects.push(r);}return state;
  }
  const SAMPLE_INFO={name:'공공데이터 연계 업무지원 서비스',department:'디지털혁신팀 (가상)',serviceState:'개발 중',description:'직원이 기관 내부 서버에서 공공 통계자료를 조회하는 웹 업무도구입니다. 외부 공공데이터 API를 연계하고 PostgreSQL에 공개 통계자료를 저장합니다. 개인정보는 처리하지 않습니다. 서버 주소와 허용 포트는 ICT인프라 담당자의 확인이 필요합니다.'};
  const SAMPLE_USER={hosting:'기관 내부 서버',db:'PostgreSQL',personal:'미포함',external:'있음',purpose:'공개 통계자료 조회·수집',usePeriod:'2026-11-01 ~ 2026-11-30'};
  const SAMPLE_STAFF={sourceIp:'192.0.2.10 (모의)',destIp:'api.example.org (모의)',port:'443',protocol:'TCP',accessControl:'기관 계정 인증 및 부서별 조회 역할을 적용할 계획입니다.',securityMeasures:'공개 통계자료만 수집하는 조건으로 사전 협의를 진행합니다. 운영 전 로그 수집과 접근통제 적용 여부를 별도 확인합니다.'};
  function sampleProject(cfg,at='intake',info={}) {
    const p=createProject(cfg,Object.assign(clone(SAMPLE_INFO),info));
    const uv={};for(const f of activeFields(p).filter(f=>f.owner==='applicant'))uv[f.key]=SAMPLE_USER[f.key]||'공개 통계자료 (가상)';setAnswers(p,uv,'applicant','합성 시연 데이터');
    if(at==='intake')return p;sendToStaff(p,'applicant');if(at==='staff')return p;
    for(const role of ['infra','security']){const values={};for(const f of activeFields(p).filter(f=>f.owner===role))values[f.key]=SAMPLE_STAFF[f.key]||'담당자 확인 예시';setAnswers(p,values,role,'합성 담당자 입력');}
    for(const t of tasks(p)){try{markReview(p,t.id,t.role,'합성 사례의 사전 협의 기록');}catch(_){}}
    addRequest(p,'security','사용 종료일과 종료 후 수집 데이터의 처리 계획을 설명해 주세요.');sendDraft(p,'security');
    if(at==='supplement')return p;
    respond(p,p.requests[0].id,'2026년 11월 30일 사용을 종료하고 시험용 수집 자료를 삭제할 계획입니다.','applicant');submit(p,'applicant',p.documents.map(d=>d.id));return p;
  }
  function status(p) {return p.completed?'처리 완료':['','작성 중','사전 협의 중','보완·확인 필요','최종 검토 중'][p.phase];}
  return {clone,uid,ROLES,CONDITIONS,PHASES,unknown,config,field,answer,condition,activeFields,activeTemplates,log,createProject,updateInfo,setAnswers,extract,acceptSuggestions,missing,sendToStaff,tasks,markReview,addRequest,makeDocuments,sendDraft,returnToStaff,respond,submit,apply,validateConfig,publish,createState,sampleProject,status,SAMPLE_INFO,SAMPLE_USER,SAMPLE_STAFF};
});
