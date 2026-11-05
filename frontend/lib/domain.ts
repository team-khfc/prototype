export type Role = 'SECURITY' | 'INFRA' | 'ADMIN' | 'APPLICANT';
export type Status = '접수 대기' | '검토 중' | '보완 대기' | '협의 완료';
export type Note = { id: string; author: string; role: string; text: string; time: string; type: 'event' | 'note' | 'supplement' };
export type RequestItem = { id: string; title: string; applicant: string; department: string; type: string; status: Status; assignee: 'SECURITY' | 'INFRA'; due: string; priority: '긴급' | '높음' | '보통'; updatedAt: string; summary: string; configVersion: string; rowVersion: number; checks: Record<string, boolean>; notes: Note[]; opinion: string };
export type Question = { id: string; key: string; title: string; description: string; type: string; role: string; requiredAt: string; condition: string; required: boolean; enabled: boolean };
export type Config = { version: string; draftVersion: string; questions: Question[]; publishedQuestions: Question[]; workflow: '순차 검토' | '병렬 검토'; publishedWorkflow: '순차 검토' | '병렬 검토'; rowVersion: number; dirty: boolean };
export type WorkspaceData = { requests: RequestItem[]; config: Config };
export const roles: Record<Role, {name:string; person:string; initial:string}> = { SECURITY:{name:'정보보안 담당자',person:'김보안',initial:'김'}, INFRA:{name:'ICT인프라 담당자',person:'윤인프라',initial:'윤'}, ADMIN:{name:'기관 관리자',person:'박관리',initial:'박'}, APPLICANT:{name:'신청자',person:'이민주',initial:'이'} };
export const securityChecks = ['개인정보 수집 항목 및 보유기간', '외부 연계 데이터와 전송 범위', '사용자·관리자 접근통제 방안'];
export const infraChecks = ['서버·DB 구성 및 운영 환경', '출발지·목적지·포트 확인', '접속 기간 및 운영 담당자 확인'];
export function checkKey(role:Role, index:number) { return `${role === 'INFRA' ? 'INFRA' : 'SECURITY'}-${index}`; }
export function formatTime() { return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()); }
export const initialQuestions: Question[] = [
 ['purpose','project.purpose','사업 목적 및 배경','사업을 추진하는 목적과 기대 효과를 입력해 주세요.','장문형','신청자','최초 신청','전체'],
 ['overview','project.overview','서비스 개요','어떤 서비스를 누구에게 제공하는지 설명해 주세요.','장문형','신청자','최초 신청','전체'],
 ['diagram','system.diagram','시스템 구성도','서버와 시스템 간 연결 관계를 첨부해 주세요.','파일 첨부','신청자','사전 협의','전체'],
 ['privacy','privacy.items','개인정보 수집 항목','처리할 개인정보의 종류와 수집 목적을 입력해 주세요. 아직 정해지지 않았다면 확인 필요로 남길 수 있습니다.','단답형','신청자','검토 완료 전','개인정보 포함 시'],
 ['external','network.external','외부 연계 시스템','외부 시스템과 주고받는 정보를 설명해 주세요.','장문형','신청자','검토 완료 전','외부 연계 시'],
 ['retention','privacy.retention','데이터 보관 기간','데이터 보관 기간과 파기 기준을 선택해 주세요.','선택형','신청자','검토 완료 전','개인정보 포함 시'],
 ['server','system.server','서버 사양 (WEB)','담당자가 서버 사양과 운영 환경을 확인해 주세요.','단답형','ICT인프라','사전 협의','전체'],
 ['network','network.connections','네트워크 구성','출발지·목적지·프로토콜·포트를 확인해 주세요.','장문형','ICT인프라','사전 협의','전체']
].map(([id,key,title,description,type,role,requiredAt,condition])=>({id,key,title,description,type,role,requiredAt,condition,required:true,enabled:true}));
const seedRows = [
 ['차세대 업무포털 구축','이민주','디지털혁신부','신규 구축','검토 중','SECURITY','2026-11-05','긴급'],
 ['모바일 현장점검 서비스','박서윤','현장지원부','서비스 연계','접수 대기','INFRA','2026-11-06','높음'],
 ['데이터 분석 플랫폼','김지원','데이터전략부','신규 구축','보완 대기','SECURITY','2026-11-06','높음'],
 ['그룹웨어 클라우드 전환','최지우','정보기획부','서비스 변경','검토 중','INFRA','2026-11-09','보통'],
 ['민원 AI 챗봇 서비스','정하늘','대민서비스부','신규 서비스','접수 대기','SECURITY','2026-11-10','보통'],
 ['연구용 PC 교체 사업','윤태호','연구지원부','장비 교체','협의 완료','INFRA','2026-11-10','보통'],
 ['통합문서 관리 시스템','홍예린','운영지원부','서비스 변경','검토 중','SECURITY','2026-11-11','보통'],
 ['재난대응 모바일 업무','백도윤','재난관리부','신규 구축','보완 대기','INFRA','2026-11-11','높음'],
 ['공공데이터 연계 고도화','강시우','데이터전략부','서비스 연계','접수 대기','INFRA','2026-11-12','보통'],
 ['전자결재 시스템 개선','유하진','정보기획부','서비스 변경','협의 완료','SECURITY','2026-11-12','보통'],
 ['내부망 모니터링 구축','이민주','디지털혁신부','신규 구축','검토 중','INFRA','2026-11-13','보통'],
 ['통합 계정 관리 시스템','김유진','정보보안부','신규 구축','협의 완료','SECURITY','2026-11-13','보통']
];
export function seedData():WorkspaceData { return { requests:seedRows.map((r,i)=>({id:`SF-2026-${String(123+i).padStart(4,'0')}`,title:r[0],applicant:r[1],department:r[2],type:r[3],status:r[4] as Status,assignee:r[5] as 'SECURITY'|'INFRA',due:r[6],priority:r[7] as RequestItem['priority'],updatedAt:`11. 04. ${String(14-Math.floor(i/4)).padStart(2,'0')}:${String(30-i*2).padStart(2,'0')}`,summary:i===0?'기관 임직원용 업무포털을 신규 구축합니다. 내부 서버와 Oracle DB를 사용하며, 공공데이터 API와 연계합니다. 개인정보 처리 범위와 접근통제 방안은 담당자의 확인이 필요합니다.':`${r[2]}에서 추진하는 ${r[0]} 사업입니다. 시스템 구성, 처리 데이터 및 외부 연계 범위를 검토하고 기관의 보안 기준에 맞춰 필요한 정보를 확인합니다.`,configVersion:'v2.3.0',rowVersion:1,checks:{},opinion:'',notes:[{id:`seed-${i}-1`,author:'윤인프라',role:'ICT인프라',text:'서버·DB 구성 정보를 보충했습니다.',time:'11. 04. 11:15',type:'event'},{id:`seed-${i}-2`,author:r[1],role:'신청자',text:'사업계획서와 인터뷰 답변을 제출했습니다.',time:'11. 03. 16:20',type:'event'}]})),config:{version:'v2.3.0',draftVersion:'v2.4.0',questions:structuredClone(initialQuestions),publishedQuestions:structuredClone(initialQuestions),workflow:'순차 검토',publishedWorkflow:'순차 검토',rowVersion:1,dirty:false}}; }
export function nextVersion(v:string){ const parts=v.replace('v','').split('.').map(Number);return `v${parts[0]}.${parts[1]+1}.0`; }
export function downloadFile(name:string,content:string,type='text/plain;charset=utf-8'){ const blob=new Blob(['\ufeff'+content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
