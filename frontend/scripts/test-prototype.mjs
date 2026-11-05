import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'sf-v3-test-'));let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)};
try{
 for(const name of ['domain','prototype']){writeFileSync(join(dir,name+'.mjs'),ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8').replace("from './domain'","from './domain.mjs'"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
 const {initialState,transition}=await import(pathToFileURL(join(dir,'prototype.mjs')));const s=initialState(),r=s.requests[0],done={checks:[true,true,true],opinion:'근거 확인',done:false};
 const review={type:'review',id:r.id,version:r.version,review:done,complete:true};
 test('Incomplete checklist rejected and input not mutated',()=>{assert.throws(()=>transition(s,{...review,review:{...done,checks:[false,true,true]}},'SECURITY'),/3개/);assert.equal(r.version,1)});
 test('Applicant cannot complete reviews or publish settings',()=>{assert.throws(()=>transition(s,review,'APPLICANT'),/담당자/);assert.throws(()=>transition(s,{type:'publish'},'APPLICANT'),/관리자/)});
 let a=transition(s,review,'SECURITY');test('One completed role does not finish consultation',()=>assert.equal(a.requests[0].phase,'사전 협의 중'));
 test('Stale record version rejected',()=>assert.throws(()=>transition(a,review,'SECURITY'),/변경/));
 a=transition(a,{...review,version:2},'INFRA');test('Both reviewers required before final submission',()=>{assert.equal(a.requests[0].phase,'제출 준비');assert.throws(()=>transition(s,{type:'submit',id:r.id,version:1},'APPLICANT'),/미확정|먼저/)});
 test('Unconfirmed AI fields block submission',()=>assert.throws(()=>transition(a,{type:'submit',id:r.id,version:3},'APPLICANT'),/미확정/));
 a.requests[0].answers=a.requests[0].answers.map(x=>({...x,value:x.key==='privacy'?'개인정보 미처리':x.value,confirmed:true}));
 let submitted=transition(a,{type:'submit',id:r.id,version:3},'APPLICANT');test('Submission snapshot immutable and duplicate submit rejected',()=>{assert.equal(submitted.requests[0].submission.title,r.title);assert.throws(()=>transition(submitted,{type:'submit',id:r.id,version:4},'APPLICANT'),/이미/);assert.throws(()=>transition(submitted,{...review,version:4},'SECURITY'),/읽기/)});
 let b=transition(a,{type:'supplement',id:r.id,version:3,field:'보유기간',reason:'명시 필요'},'SECURITY');test('Unresolved supplement blocks completion',()=>assert.throws(()=>transition(b,{...review,version:4},'SECURITY'),/미해결/));
 b=transition(b,{type:'answer',id:r.id,version:4,supplementId:b.requests[0].supplements[0].id,answer:'사업 종료 시 파기'},'APPLICANT');test('Supplement answer triggers re-review',()=>{assert.equal(b.requests[0].phase,'사전 협의 중');assert.equal(b.requests[0].reviews.SECURITY.done,false);assert.deepEqual(b.requests[0].reviews.SECURITY.checks,[false,false,false])});
 let c=transition(s,{type:'save-config',questions:s.config.draft.map((q,i)=>i?q:{...q,title:'개정된 사업 목적'}),workflow:'순차 검토'},'ADMIN');c=transition(c,{type:'publish'},'ADMIN');c=transition(c,{type:'create',draft:{title:'새 신청',summary:'새 개요',answers:[]},consult:true},'APPLICANT');test('Published config snapshot applies only to new requests',()=>{assert.equal(c.requests[0].configVersion,'v2.4');assert.equal(c.requests[1].configVersion,'v2.3');assert.equal(c.requests[0].questions[0].title,'개정된 사업 목적');assert.notEqual(c.requests[1].questions[0].title,'개정된 사업 목적')});
 test('Sequential review blocks infrastructure before security',()=>assert.throws(()=>transition(c,{...review,id:c.requests[0].id,version:1},'INFRA'),/먼저/));
 test('Duplicate config keys rejected',()=>assert.throws(()=>transition(s,{type:'save-config',questions:[s.config.draft[0],s.config.draft[0]],workflow:'병렬 검토'},'ADMIN'),/중복/));
 test('Important field changes reset both completed reviews',()=>{const z=transition(a,{type:'update-answer',id:r.id,version:3,key:'system',value:'변경된 운영 환경',confirmed:true},'SECURITY');assert.equal(z.requests[0].phase,'사전 협의 중');assert.equal(z.requests[0].reviews.SECURITY.done,false);assert.equal(z.requests[0].reviews.INFRA.done,false)});

 test('Empty or blank answers cannot be submitted',()=>{
  for (const answers of [[], [{key:'empty',title:'필수 답변',value:'   ',confirmed:true,source:'입력'}]]) {
   const invalid=structuredClone(a);invalid.requests[0].answers=answers;
   assert.throws(()=>transition(invalid,{type:'submit',id:r.id,version:3},'APPLICANT'),/입력/);
  }
 });
 test('A late supplement answer cannot reopen a submitted case',()=>{
  const locked=structuredClone(submitted);
  locked.requests[0].supplements=[{id:'late',field:'보유기간',reason:'확인',role:'SECURITY',answer:'답변됨',resolved:true}];
  assert.throws(()=>transition(locked,{type:'answer',id:r.id,version:4,supplementId:'late',answer:'늦은 답변'},'APPLICANT'),/읽기/);
  assert.equal(locked.requests[0].phase,'제출됨');
 });
 console.log(`${passed} meaningful domain checks passed. Browser demo only; these are not server authorization or AI quality tests.`);
}finally{rmSync(dir,{recursive:true,force:true})}
