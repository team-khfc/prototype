import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'secureflow-test-'));
try {
 for(const name of ['domain','gateway']){const source=readFileSync(`lib/${name}.ts`,'utf8').replace("from './domain'","from './domain.mjs'");writeFileSync(join(dir,`${name}.mjs`),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);}
 const {seedData}=await import(pathToFileURL(join(dir,'domain.mjs')));
 const {applyCommand}=await import(pathToFileURL(join(dir,'gateway.mjs')));
 const initial=seedData();const base={requestId:initial.requests[0].id,expectedVersion:1,role:'SECURITY'};
 assert.throws(()=>applyCommand(initial,{...base,type:'complete',text:'완료',checks:{}}),/3개/);
 assert.equal(initial.requests[0].rowVersion,1);
 console.log('PASS incomplete review rejected without mutation');
 const noted=applyCommand(initial,{...base,type:'note',text:'메모'});
 assert.equal(noted.requests[0].notes[0].text,'메모');
 assert.throws(()=>applyCommand(noted,{...base,type:'note',text:'중복'}),/변경/);
 console.log('PASS stale version rejected');
 assert.throws(()=>applyCommand(initial,{...base,role:'APPLICANT',type:'note',text:'메모'}),/담당자/);
 console.log('PASS applicant review blocked');
 const supplemented=applyCommand(initial,{...base,type:'supplement',text:'기간 확인',field:'사용 기간'});
 assert.equal(supplemented.requests[0].status,'보완 대기');assert.match(supplemented.requests[0].notes[0].text,/사용 기간/);
 console.log('PASS supplement linked to field and status');
 const completed=applyCommand(initial,{...base,type:'complete',text:'완료',checks:{'SECURITY-0':true,'SECURITY-1':true,'SECURITY-2':true}});
 assert.equal(completed.requests[0].status,'협의 완료');
 assert.throws(()=>applyCommand(completed,{...base,type:'save-review',expectedVersion:2,text:'변경'}),/완료된/);
 console.log('PASS completed review locked');
 const draft=applyCommand(initial,{type:'save-config',expectedVersion:1,config:{...initial.config,questions:initial.config.questions.map((q,i)=>i? q:{...q,title:'수정 질문'})}});
 assert.equal(draft.config.publishedQuestions[0].title,'사업 목적 및 배경');
 const published=applyCommand(draft,{type:'publish-config',expectedVersion:2});
 assert.equal(published.config.version,'v2.4.0');assert.equal(published.requests[0].configVersion,'v2.3.0');
 const created=applyCommand(published,{type:'create-request',title:'새 사업',summary:'설명',department:'테스트'});
 assert.equal(created.requests[0].configVersion,'v2.4.0');assert.equal(created.requests[1].configVersion,'v2.3.0');
 console.log('PASS publication only applies to new requests');
} finally {rmSync(dir,{recursive:true,force:true});}
