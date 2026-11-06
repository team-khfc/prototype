/* 보안길잡이 AI | 화면 전용 코드: network.js */
'use strict';
/* ---------- network (ICT인프라) ---------- */
function renderNet(){
  const f=state.nf||'need';
  let rows=projects.filter(p=>p.stage>=1&&p.stage<=3).flatMap(p=>p.rules.map((r,i)=>({p,r,i,need:[r.fromIp,r.toIp,r.port].some(v=>v===null)})));
  const total=rows.length, need=rows.filter(x=>x.need).length;
  if(f==='need') rows=rows.filter(x=>x.need); if(f==='mine') rows=rows.filter(x=>myTurn(x.p));
  const cell=v=>v===null?'<span class="badge b-warning">입력 필요</span>':esc(v);
  $main.innerHTML=`<div class="page-head"><div><h1>통신 정보</h1></div>
    ${dlNS?`<button type="button" class="btn" data-act="csv-net">조회 결과 다운로드 (CSV)</button>`:''}</div>
  ${flashHTML()}
  <div class="toolbar"><div class="pills" role="group" aria-label="규칙 거르기">${[['need',`입력 필요 ${need}`],['mine','내 차례 신청'],['all',`전체 ${total}`]].map(([k,l])=>`<button type="button" class="pill" data-act="nf" data-k="${k}" aria-pressed="${f===k}">${l}</button>`).join('')}</div></div>
  <p class="filter-state" role="status">규칙 ${rows.length}건</p>
  ${rows.length?`<div class="tbl-wrap"><table class="tbl"><caption class="sr-only">진행 중인 신청의 방화벽 규칙</caption>
    <thead><tr><th scope="col">신청</th><th scope="col">업무 표현</th><th scope="col">출발지</th><th scope="col">목적지</th><th scope="col">포트</th><th scope="col">방향</th><th scope="col">처리</th></tr></thead>
    <tbody>${rows.map(({p,r,i,need})=>`<tr><td><div class="p-id">${p.id} ${i+1}번</div><div class="p-name"><a href="request-detail.html?id=${p.id}">${esc(p.name)}</a></div></td><td>${esc(r.biz)}</td>
      <td>${esc(r.from)}<br>${cell(r.fromIp)}</td><td>${esc(r.to)}<br>${cell(r.toIp)}</td><td>${cell(r.port)}</td><td>${esc(r.dir)}</td>
      <td>${need&&myTurn(p)?`<a class="btn btn-sm" href="request-detail.html?id=${p.id}">입력하기</a>`:`<a class="link-more" href="request-detail.html?id=${p.id}">${I.chev}<span>상세 보기</span></a>`}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-box">이 조건에 해당하는 규칙이 없습니다.</div>'}`;
}

/* ---------- 화면 동작 ---------- */
ACT['nf']=(b,p,e)=>{ state.nf=b.dataset.k; renderNet(); $main.querySelector(`[data-act=nf][data-k="${state.nf}"]`).focus(); return;
};
ACT['csv-net']=(b,p,e)=>{ {const rows=projects.filter(x=>x.stage>=1&&x.stage<=3).flatMap(x=>x.rules.map((r,i)=>[x.id,x.name,i+1,r.biz,r.from,r.fromIp??'입력 필요',r.to,r.toIp??'입력 필요',r.port??'입력 필요',r.dir]));
      saveFile('통신정보_'+TODAY_STR+'.csv',csv([['신청번호','사업명','규칙','업무 표현','출발지','출발지 주소','목적지','목적지 주소','포트','방향'],...rows])); return;}
};
VIEWS.net=renderNet;
