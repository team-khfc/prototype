(function () {
  "use strict";
  window.SecureFlowAdmin = function (ctx) {
    const E = ctx.engine, S = ctx.store, esc = ctx.esc, icon = ctx.icon;
    let agency = "agency_a", tab = "templates", templateId = "firewall";
    let sources = {}, error = "", message = "", busy = false, readSequence = 0;
    function draft() { return S.draft(agency); }
    function currentTemplate() {
      return draft().templates.find(function (t) { return t.id === templateId; }) || draft().templates[0];
    }
    function sourceKey() { return agency + "::" + currentTemplate().id; }
    function sourceText() {
      const key = sourceKey();
      if (Object.hasOwn(sources, key)) return sources[key];
      const t = currentTemplate();
      return t.title + "\n" + t.fields.map(function (f) { return (f.required ? "* " : "") + f.label; }).join("\n");
    }
    function option(value, label, selected) { return "<option value='" + esc(value) + "'" + (value === selected ? " selected" : "") + ">" + esc(label) + "</option>"; }
    function conditions(selected) { return Object.keys(E.conditions).map(function (k) { return option(k, E.conditions[k], selected); }).join(""); }
    function selectOrg(id) { agency = id; templateId = draft().templates[0].id; error = ""; message = ""; }
    function note(text, warn) { (warn ? error = text : message = text); ctx.toast(text, !!warn); }
    function render() {
      const d = draft(), pub = S.published(agency);
      return [
        "<div class='page-head'><div><span class='eyebrow'>INSTITUTION STUDIO · 관리자 역할 시연</span><h1>우리 기관의 보안 업무를 설계하세요</h1><p>양식과 처리 절차를 등록하고 확인·게시하면, 해당 기관의 새 신청에 반영됩니다.</p></div>",
        "<div class='page-actions'><button class='btn btn-secondary' data-admin-action='save'>임시 저장</button><button class='btn btn-primary' data-admin-action='publish'>", icon("check", 16), " 설정 게시</button></div></div>",
        "<div class='agency-selector'>",
        S.ids().map(function (id) {
          const p = S.published(id);
          return "<button class='agency-card " + (agency === id ? "selected" : "") + "' data-admin-action='select-org' data-id='" + id + "'><span class='agency-avatar " + p.accent + "'>" + (id === "agency_a" ? "A" : "B") + "</span><span><strong>" + esc(p.name) + "</strong><small>" + esc(p.subtitle) + "</small></span><span class='tag " + (agency === id ? "blue" : "gray") + "'>v" + p.version + "</span></button>";
        }).join(""),
        "</div>",
        "<div class='config-banner'><div>", icon("settings", 18), "<span><b>게시된 설정 v", pub.version, "</b> · <span id='draft-status'>", S.dirty(agency) ? "미게시 변경사항 있음" : "게시 버전과 동일", "</span></span></div><span>설정은 이 브라우저에만 저장 · 서버·실제 기관 권한 미연결</span></div>",
        "<div class='admin-tabs'><button class='admin-tab ", tab === "templates" ? "active" : "", "' data-admin-action='tab' data-tab='templates'>", icon("docs", 16), " 기관 양식 관리</button>",
        "<button class='admin-tab ", tab === "workflow" ? "active" : "", "' data-admin-action='tab' data-tab='workflow'>", icon("flow", 16), " 처리 절차 설정</button>",
        "<button class='admin-tab ", tab === "overview" ? "active" : "", "' data-admin-action='tab' data-tab='overview'>", icon("shield", 16), " 설정 검증·적용</button></div>",
        error ? "<div class='callout gold admin-message'><span class='callout-symbol'>!</span><p>" + esc(error) + "</p></div>" : "",
        message ? "<div class='callout green admin-message'><span class='callout-symbol'>✓</span><p>" + esc(message) + "</p></div>" : "",
        tab === "templates" ? renderTemplates() : tab === "workflow" ? renderWorkflow() : renderOverview(),
        "<div class='demo-notice'><span class='help-dot'>i</span><span>양식 인식은 규칙 기반 모의 AI입니다. 실제 LLM과 서버 권한 검증은 연결되지 않았습니다. 원본 파일은 저장하지 않고 추출 항목·설정만 브라우저에 저장합니다.</span></div>"
      ].join("");
    }
    function renderTemplates() {
      const d = draft(), t = currentTemplate();
      return [
        "<div class='template-studio'><aside class='template-list panel'><div class='panel-header'><div><h3>등록 양식</h3><p>기관의 신청·검토 서류를 설정합니다.</p></div><span class='tag gray'>", d.templates.length, "종</span></div>",
        d.templates.map(function (form) {
          return "<button class='template-pick " + (t.id === form.id ? "active" : "") + "' data-admin-action='pick-template' data-id='" + form.id + "'>" + icon("file", 19) + "<span><strong>" + esc(form.title) + "</strong><small>" + form.fields.length + "개 항목 · " + (form.confirmed ? "연결 확인됨" : "연결 확인 필요") + "</small></span></button>";
        }).join(""),
        "<button class='btn btn-soft' style='width:100%;margin-top:13px' data-admin-action='add-template' ", d.templates.length >= 8 ? "disabled" : "", ">+ 새 양식 추가</button><hr class='small-divider'/>",
        "<div class='template-help'><b>등록에서 사용까지</b><ol><li>빈 양식 파일 또는 항목명 입력</li><li>모의 AI 항목 인식</li><li>데이터 연결·필수값 확인</li><li>관리자 확인 후 설정 게시</li></ol></div></aside>",
        "<section class='panel template-editor'><div class='panel-header'><div><h2>양식 항목 연결</h2><p>AI의 인식 결과를 확인하고 기관에서 쓰는 항목명과 순서를 정합니다.</p></div>",
        "<button class='btn btn-ghost btn-small danger-text' data-admin-action='remove-template' ", d.templates.length <= 1 ? "disabled" : "", ">양식 삭제</button></div>",
        "<div class='form-row'><div class='field'><label for='template-title'>문서 제목</label><input id='template-title' data-admin-template='title' value='", esc(t.title), "' maxlength='120'/></div>",
        "<div class='field'><label for='template-layout'>출력 레이아웃</label><select id='template-layout' data-admin-template='layout'>", option("table", "표 형식", t.layout), option("sections", "번호·항목 형식", t.layout), "</select></div></div>",
        "<div class='form-row'><div class='field'><label for='template-kind'>문서 유형</label><select id='template-kind' data-admin-template='kind'>", option("firewall", "방화벽 신청", t.kind), option("security", "보안성 검토", t.kind), option("custom", "기타 보안 서류", t.kind), "</select></div>",
        "<div class='field'><label for='template-condition'>사용 조건 · 기관 설정 예시</label><select id='template-condition' data-admin-template='condition'>", conditions(t.condition), "</select></div></div>",
        "<div class='template-upload'><div class='upload-icon'>", icon("file", 26), "</div><div><strong>빈 양식 파일 등록</strong><p>TXT · MD · JSON · HWPX · DOCX / 최대 5MB</p><small>", esc(t.fileName), "</small></div><label class='btn btn-secondary btn-small' for='template-file'>파일 선택</label><input type='file' id='template-file' accept='.txt,.md,.json,.hwpx,.docx' hidden/></div>",
        "<div class='field' style='margin-top:15px'><label for='template-source'>또는 양식 항목을 붙여 넣기 <small>한 줄에 항목 하나 · * 표시는 필수 후보</small></label><textarea id='template-source' data-admin-source='1' rows='6'>", esc(sourceText()), "</textarea></div>",
        "<div class='extract-actions'><span class='field-hint'>HWPX·DOCX는 텍스트 항목을 읽습니다. 원본의 표 병합·폰트까지 재현하지는 않습니다.<br/><a href='./sample-institution-template.txt' download='기관맞춤_샘플양식.txt'>등록용 샘플 양식 다운로드</a></span><button class='btn btn-primary' data-admin-action='extract' ", busy ? "disabled" : "", ">", icon("spark", 15), busy ? " 파일 읽는 중…" : " 모의 AI 항목 인식", "</button></div>",
        "<div class='mapping-heading'><h3>항목 매핑</h3><span class='tag blue'>", t.fields.length, "개 항목</span><span class='field-hint'>인식 결과는 관리자 확인 후 사용</span></div>",
        "<div class='mapping-table-wrap'><table class='mapping-table'><thead><tr><th>순서</th><th>양식에 표시할 항목명</th><th>연결할 프로젝트 정보</th><th>필수</th><th>편집</th></tr></thead><tbody>",
        t.fields.map(function (field, index) {
          const custom = field.key.startsWith("custom_");
          return "<tr><td><span class='field-number'>" + (index + 1) + "</span></td><td><input aria-label='항목명 " + (index + 1) + "' data-admin-field='" + field.id + "' data-prop='label' value='" + esc(field.label) + "' maxlength='80'/></td>" +
            "<td><select aria-label='정보 연결 " + (index + 1) + "' data-admin-field='" + field.id + "' data-prop='key'>" +
            Object.keys(E.fields).map(function (k) { return option(k, E.fields[k].label, field.key); }).join("") + option("__custom__", "기관 전용 · 별도 입력", custom ? "__custom__" : field.key) +
            "</select>" + (custom ? "<span class='custom-hint'>추가 질문에 자동 표시</span>" : "") + "</td>" +
            "<td><input type='checkbox' aria-label='필수 " + (index + 1) + "' data-admin-field='" + field.id + "' data-prop='required' " + (field.required ? "checked" : "") + "/></td>" +
            "<td><div class='row-actions'><button title='항목 위로' aria-label='항목 " + (index + 1) + " 위로' data-admin-action='field-up' data-id='" + field.id + "' " + (index === 0 ? "disabled" : "") + ">↑</button><button title='항목 아래로' aria-label='항목 " + (index + 1) + " 아래로' data-admin-action='field-down' data-id='" + field.id + "' " + (index === t.fields.length - 1 ? "disabled" : "") + ">↓</button><button title='항목 삭제' aria-label='항목 " + (index + 1) + " 삭제' data-admin-action='field-remove' data-id='" + field.id + "'>×</button></div></td></tr>";
        }).join(""),
        "</tbody></table></div><button class='btn btn-soft btn-small' style='margin-top:13px' data-admin-action='field-add' ", t.fields.length >= 40 ? "disabled" : "", ">+ 직접 항목 추가</button>",
        "<div class='mapping-confirm'><label class='checkbox-row'><input type='checkbox' id='template-confirmed' ", t.confirmed ? "checked" : "", "/><span><b>항목 연결과 필수 여부를 확인했습니다.</b><br>이 확인은 시연용 설정 확정이며 기관 정책의 법적·보안상 적정성 판단을 대체하지 않습니다.</span></label></div></section></div>"
      ].join("");
    }
    function renderWorkflow() {
      const d = draft();
      return [
        "<div class='workflow-builder'><section><div class='panel workflow-presets'><div><h3 class='subheading'>처리 절차 편집</h3><p class='section-subtitle'>순서를 바꾸고 담당 역할을 추가하세요. 같은 단계의 여러 역할은 병렬로 검토합니다.</p></div><div class='pill-row'><button class='btn btn-secondary btn-small' data-admin-action='preset-sequential'>순차 검토 예시</button><button class='btn btn-secondary btn-small' data-admin-action='preset-parallel'>병렬 검토 예시</button></div></div>",
        d.workflow.map(function (stage, index) {
          return "<article class='workflow-stage'><div class='stage-order'>" + (index + 1) + "</div><div class='stage-body'><div class='stage-head'><input aria-label='단계명 " + (index + 1) + "' data-admin-stage='" + stage.id + "' data-prop='title' value='" + esc(stage.title) + "' maxlength='80'/>" +
            "<span class='tag " + (stage.roles.length > 1 ? "blue" : "gray") + "'>" + (stage.roles.length > 1 ? "병렬 · 모두 완료" : "순차 검토") + "</span><div class='row-actions'>" +
            "<button aria-label='단계 " + (index + 1) + " 위로' title='위로 이동' data-admin-action='stage-up' data-id='" + stage.id + "' " + (index === 0 ? "disabled" : "") + ">↑</button><button aria-label='단계 " + (index + 1) + " 아래로' title='아래로 이동' data-admin-action='stage-down' data-id='" + stage.id + "' " + (index === d.workflow.length - 1 ? "disabled" : "") + ">↓</button><button aria-label='단계 " + (index + 1) + " 삭제' title='단계 삭제' data-admin-action='stage-remove' data-id='" + stage.id + "'>×</button></div></div>" +
            "<div class='stage-settings'><div><span class='field-label'>담당 역할</span><div class='role-options'>" + Object.keys(E.roles).map(function (role) {
              return "<label class='role-check " + (stage.roles.includes(role) ? "selected" : "") + "'><input type='checkbox' data-admin-stage='" + stage.id + "' data-prop='role' data-role='" + role + "' " + (stage.roles.includes(role) ? "checked" : "") + "/>" + E.roles[role].short + "</label>";
            }).join("") + "</div></div><div class='field' style='margin:0'><label>단계 실행 조건</label><select aria-label='단계 " + (index + 1) + " 조건' data-admin-stage='" + stage.id + "' data-prop='condition'>" + conditions(stage.condition) + "</select></div></div>" +
            "<div class='stage-rule'>" + icon("shield", 14) + " 지정 역할 모두 완료 후 다음 단계 · 보완 요청은 신청자에게 반환</div></div></article>";
        }).join(""),
        "<button class='btn btn-soft' style='width:100%' data-admin-action='stage-add' ", d.workflow.length >= 8 ? "disabled" : "", ">+ 검토 단계 추가</button></section>",
        "<aside class='panel sticky-aside workflow-preview'><div class='panel-header'><div><h3>절차 미리보기</h3><p>신청자에게 적용될 흐름입니다.</p></div></div><div class='mini-flow'><div class='mini-node start'>신청자 · 서류 작성</div>",
        d.workflow.map(function (stage, index) {
          return "<div class='mini-connector'>↓</div><div class='mini-node'><small>STEP " + (index + 1) + "</small><strong>" + esc(stage.title) + "</strong><div class='mini-roles'>" + stage.roles.map(function (role) { return "<span>" + E.roles[role].short + "</span>"; }).join("") + "</div>" +
            (stage.condition !== "always" ? "<p>" + E.conditions[stage.condition] + "</p>" : "") + "</div>";
        }).join(""),
        "<div class='mini-connector'>↓</div><div class='mini-node end'>신청자 최종 확인 · 제출 준비</div></div><hr class='small-divider'/><p class='section-subtitle'>조건이 미확정이면 해당 검토 단계를 생략하지 않고 확인 대상으로 표시합니다. 실제 의무 절차는 기관 관리자가 결정해야 합니다.</p></aside></div>"
      ].join("");
    }
    function renderOverview() {
      const d = draft(), errors = E.validatePack(d), p = S.published(agency);
      return [
        "<div class='split-grid'><section class='panel'><div class='panel-header'><div><h2>기관 기본 정보</h2><p>시연에 표시할 기관명을 정합니다. 실제 권한 체계는 연결되지 않았습니다.</p></div></div>",
        "<div class='field'><label for='agency-name'>기관 표시명</label><input id='agency-name' data-admin-org='name' value='", esc(d.name), "' maxlength='60'/></div><div class='field'><label for='agency-subtitle'>기관 설정 설명</label><input id='agency-subtitle' data-admin-org='subtitle' value='", esc(d.subtitle), "' maxlength='120'/></div>",
        "<div class='overview-summary'><div class='summary-title'>게시 전 확인</div>", errors.length ? errors.map(function (e) { return "<div class='summary-item warning'><span class='check-icon'>!</span><span>" + esc(e) + "</span></div>"; }).join("") : "<div class='summary-item'><span class='check-icon'>✓</span><span>현재 구성에 형식 오류가 없습니다. 기관 담당자의 실제 정책 검토는 별도로 필요합니다.</span></div>", "</div>",
        "<div class='panel-footer'><button class='btn btn-secondary' data-admin-action='discard'>초안 변경 취소</button><button class='btn btn-primary' data-admin-action='publish'>설정 v", p.version + 1, " 게시</button></div></section>",
        "<aside class='panel'><div class='panel-header'><div><h3>설정 적용 원칙</h3><p>진행 중인 신청의 기준을 보호합니다.</p></div></div><ul class='simple-list'><li><span class='list-mark'>1</span><span><b>초안과 게시본 분리</b><br>임시 저장은 사용자 문서 생성에 영향을 주지 않습니다.</span></li><li><span class='list-mark'>2</span><span><b>새 신청은 최신 게시본</b><br>분석 시작 시 기관 설정을 복사하여 고정합니다.</span></li><li><span class='list-mark'>3</span><span><b>진행 건은 기존 버전 유지</b><br>새 버전을 명시적으로 적용하면 서류·검토 상태가 초기화됩니다.</span></li><li><span class='list-mark'>4</span><span><b>수정 후 재검토</b><br>검토한 내용을 바꾸면 완료 상태를 그대로 유지하지 않습니다.</span></li></ul>",
        "<div class='callout gold' style='margin-top:20px'><span class='callout-symbol'>!</span><p>이 프로토타입은 브라우저 내 설정·역할 시연입니다. 실제 기관별 데이터 격리, 사용자 인증, 감사 로그 보존은 정식 서버에서 구현해야 합니다.</p></div></aside></div>"
      ].join("");
    }
    function move(array, id, delta) {
      const at = array.findIndex(function (x) { return x.id === id; }), to = at + delta;
      if (at >= 0 && to >= 0 && to < array.length) { const item = array.splice(at, 1)[0]; array.splice(to, 0, item); }
    }
    function click(button) {
      const action = button.dataset.adminAction, d = draft(), t = currentTemplate();
      error = ""; message = "";
      if (action === "select-org") selectOrg(button.dataset.id);
      if (action === "tab") tab = button.dataset.tab;
      if (action === "pick-template") templateId = button.dataset.id;
      if (action === "save") note(S.save() ? "설정 초안을 이 브라우저에 저장했습니다. 게시본은 변경되지 않았습니다." : "브라우저 저장이 제한되어 이번 화면에서만 유지됩니다.", false);
      if (action === "publish") {
        const result = S.publish(agency);
        if (!result.ok) { error = result.errors.join(" "); ctx.toast("게시 전 확인 사항을 해결해주세요.", true); }
        else { note("기관 설정 v" + result.version + "을 게시했습니다. 새 신청에 적용되며 진행 건은 기존 버전을 유지합니다." + (result.persisted ? "" : " 브라우저 저장은 사용할 수 없습니다.")); ctx.onPublish(agency); }
      }
      if (action === "discard") {
        if (!window.confirm("기관 설정의 미게시 초안 변경을 취소할까요? 게시된 설정은 유지됩니다.")) return;
        S.discard(agency); sources = {}; templateId = currentTemplate().id; note("게시된 설정으로 초안을 되돌렸습니다.");
      }
      if (action === "extract") {
        try {
          const result = E.parseTemplateText(sourceText(), t.id);
          if (result.title) t.title = result.title;
          t.fields = result.fields; t.confirmed = false;
          note(result.fields.length + "개 항목을 인식했습니다. " + result.recognized + "개 공통 항목을 연결했고 나머지는 기관 전용 항목입니다. 매핑을 확인해주세요.");
        } catch (e) { note(e.message, true); }
      }
      if (action === "add-template" && d.templates.length < 8) {
        const id = E.uid("template");
        d.templates.push({ id: id, title: "새 보안 양식", kind: "custom", condition: "always", layout: "table", fileName: "직접 등록", confirmed: false, fields: [{ id: E.uid("f"), key: "name", label: "프로젝트명", required: true }] });
        templateId = id;
      }
      if (action === "remove-template" && d.templates.length > 1) {
        if (!window.confirm("현재 양식을 초안에서 제거할까요? 게시 전까지 기존 사용자 양식은 유지됩니다.")) return;
        d.templates = d.templates.filter(function (x) { return x.id !== t.id; }); templateId = d.templates[0].id;
      }
      if (action === "field-add" && t.fields.length < 40) {
        const id = E.uid("f"); t.fields.push({ id: id, key: "custom_" + t.id + "_" + id, label: "추가 항목", required: false }); t.confirmed = false;
      }
      if (action === "field-remove") { t.fields = t.fields.filter(function (x) { return x.id !== button.dataset.id; }); t.confirmed = false; }
      if (action === "field-up" || action === "field-down") { move(t.fields, button.dataset.id, action === "field-up" ? -1 : 1); t.confirmed = false; }
      if (action === "stage-add" && d.workflow.length < 8) d.workflow.push({ id: E.uid("stage"), title: "추가 검토", roles: ["security"], condition: "always" });
      if (action === "stage-remove") d.workflow = d.workflow.filter(function (s) { return s.id !== button.dataset.id; });
      if (action === "stage-up" || action === "stage-down") move(d.workflow, button.dataset.id, action === "stage-up" ? -1 : 1);
      if (action === "preset-sequential" || action === "preset-parallel") {
        if (!window.confirm("처리 절차 초안을 선택한 예시로 교체할까요?")) return;
        d.workflow = action === "preset-sequential" ?
          [{ id: E.uid("stage"), title: "인프라 사전 검토", roles: ["infra"], condition: "always" }, { id: E.uid("stage"), title: "정보보안 검토", roles: ["security"], condition: "always" }] :
          [{ id: E.uid("stage"), title: "보안·인프라 동시 검토", roles: ["security", "infra"], condition: "always" }, { id: E.uid("stage"), title: "최종 검토 승인", roles: ["manager"], condition: "always" }];
      }
      ctx.render();
    }
    function input(target) {
      const d = draft(), t = currentTemplate();
      if (target.dataset.adminSource) sources[sourceKey()] = target.value;
      if (target.dataset.adminTemplate) t[target.dataset.adminTemplate] = target.value;
      if (target.dataset.adminOrg) d[target.dataset.adminOrg] = target.value;
      if (target.dataset.adminField) {
        const field = t.fields.find(function (f) { return f.id === target.dataset.adminField; });
        if (field && target.dataset.prop === "label") {
          field.label = target.value; t.confirmed = false;
          const confirm = document.getElementById("template-confirmed");
          if (confirm) confirm.checked = false;
        }
      }
      if (target.dataset.adminStage && target.dataset.prop === "title") {
        const stage = d.workflow.find(function (s) { return s.id === target.dataset.adminStage; });
        if (stage) stage.title = target.value;
      }
      const status = document.getElementById("draft-status");
      if (status) status.textContent = S.dirty(agency) ? "미게시 변경사항 있음" : "게시 버전과 동일";
    }
    async function change(target) {
      const d = draft(), t = currentTemplate();
      if (target.id === "template-file" && target.files && target.files[0]) {
        const file = target.files[0], capturedKey = sourceKey(), targetTemplate = t, capturedAgency = agency, job = ++readSequence;
        busy = true; error = ""; message = ""; ctx.render();
        try {
          const text = await E.extractFile(file);
          if (job !== readSequence || !S.draft(capturedAgency).templates.includes(targetTemplate)) {
            if (job === readSequence) { busy = false; ctx.render(); }
            return;
          }
          sources[capturedKey] = text; targetTemplate.fileName = file.name; targetTemplate.confirmed = false;
          note("파일에서 양식 텍스트를 읽었습니다. 모의 AI 항목 인식 버튼을 눌러 연결 후보를 확인하세요.");
        } catch (e) { if (job === readSequence) note(e.message || "파일을 읽지 못했습니다. 항목명을 직접 붙여 넣어주세요.", true); }
        if (job === readSequence) { busy = false; ctx.render(); } return;
      }
      if (target.id === "template-confirmed") { t.confirmed = target.checked; ctx.render(); return; }
      if (target.dataset.adminField) {
        if (target.dataset.prop === "label") return;
        const field = t.fields.find(function (f) { return f.id === target.dataset.adminField; });
        if (!field) return;
        if (target.dataset.prop === "required") field.required = target.checked;
        if (target.dataset.prop === "key") field.key = target.value === "__custom__" ? "custom_" + t.id + "_" + field.id : target.value;
        t.confirmed = false; ctx.render(); return;
      }
      if (target.dataset.adminTemplate) { t[target.dataset.adminTemplate] = target.value; if (target.tagName === "SELECT") ctx.render(); return; }
      if (target.dataset.adminStage) {
        if (target.dataset.prop === "title") return;
        const stage = d.workflow.find(function (s) { return s.id === target.dataset.adminStage; });
        if (!stage) return;
        if (target.dataset.prop === "condition") stage.condition = target.value;
        if (target.dataset.prop === "role") {
          const role = target.dataset.role;
          stage.roles = target.checked ? Array.from(new Set(stage.roles.concat([role]))) : stage.roles.filter(function (r) { return r !== role; });
        }
        ctx.render(); return;
      }
      // Text input changes are already reflected in the draft. Do not replace the
      // focused DOM on blur: doing so would swallow the user's next button click.
    }
    return { render: render, click: click, input: input, change: change, selectOrg: selectOrg };
  };
})();
