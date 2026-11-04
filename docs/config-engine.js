/* Institution configuration and safe, bounded template parsing for a local demo.
 * Does not use an LLM, grant permissions, or perform official approvals.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SecureFlowConfig = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const clone = function (v) { return JSON.parse(JSON.stringify(v)); };
  let sequence = 0;
  const uid = function (prefix) { sequence += 1; return prefix + "_" + Date.now().toString(36) + "_" + sequence.toString(36); };
  const FIELDS = {
    name: { label: "프로젝트명", aliases: ["프로젝트명", "사업명", "시스템명", "서비스명", "과제명"] },
    department: { label: "담당 부서", aliases: ["신청부서", "담당부서", "요청부서", "주관부서", "부서명"] },
    description: { label: "프로젝트 개요", aliases: ["사업개요", "프로젝트개요", "주요내용", "시스템개요", "서비스개요"] },
    hosting: { label: "운영 환경", aliases: ["운영환경", "구축환경", "설치위치", "망구분", "서비스환경"] },
    external: { label: "외부 연계 여부", aliases: ["외부연계", "외부통신", "인터넷연계", "외부시스템연계", "연계여부"] },
    personal: { label: "개인정보 처리 여부", aliases: ["개인정보", "개인정보처리", "개인정보포함", "개인정보처리여부"] },
    sourceIp: { label: "출발지 IP", aliases: ["출발지ip", "출발지주소", "출발ip", "sourceip", "srcip", "송신지ip", "송신시스템ip", "출발지"] },
    destIp: { label: "목적지 IP", aliases: ["목적지ip", "목적지주소", "대상ip", "destinationip", "dstip", "수신지ip", "수신시스템ip", "목적지"] },
    protocol: { label: "프로토콜", aliases: ["프로토콜", "protocol", "통신프로토콜"] },
    port: { label: "목적지 포트", aliases: ["목적지포트", "서비스포트", "허용포트", "포트번호", "포트", "port", "destinationport"] },
    purpose: { label: "통신 목적", aliases: ["통신목적", "연계목적", "신청사유", "신청목적", "허용사유", "접근목적"] },
    usePeriod: { label: "사용 기간", aliases: ["사용기간", "허용기간", "신청기간", "정책사용기간", "적용기간"] },
    accessControl: { label: "접근 통제·인증 방안", aliases: ["접근통제", "인증방안", "접근권한", "접근통제인증방안", "사용자인증"] },
    logging: { label: "로그 관리 방안", aliases: ["로그관리", "로그보관", "보관정책", "로그관리방안", "로그보관정책"] },
    securityMeasures: { label: "보안 대책", aliases: ["보안대책", "보안조치", "취약점조치", "보안통제", "보호대책"] },
    ownerName: { label: "업무 책임자", aliases: ["업무책임자", "사업책임자", "책임자", "담당자명"] }
  };
  const ROLES = {
    infra: { label: "ICT인프라 담당자", short: "ICT인프라", description: "네트워크 구성, 출발지·목적지 IP와 포트 정보를 검토합니다." },
    security: { label: "정보보안 담당자", short: "정보보안", description: "보안 요구사항, 접근 통제, 로그 관리와 보안 대책을 검토합니다." },
    privacy: { label: "개인정보 담당자", short: "개인정보", description: "개인정보 처리 항목과 보호 방안을 검토합니다." },
    manager: { label: "최종 승인 담당자", short: "최종 승인", description: "선행 검토 결과를 종합하여 최종 상태를 기록합니다. 실제 결재는 아닙니다." }
  };
  const CONDITIONS = { always: "항상", external_yes: "외부 연계가 있을 때", personal_yes: "개인정보를 처리할 때", cloud: "외부 클라우드를 사용할 때" };
  function f(key, label, required) { return { id: uid("f"), key: key, label: label || FIELDS[key].label, required: !!required }; }
  function template(id, kind, title, fields, layout) {
    return { id: id, kind: kind, title: title, fields: fields, layout: layout || "table", condition: "always", fileName: "기본 시연 양식", confirmed: true };
  }
  function defaults() {
    return [
      {
        id: "agency_a", name: "공공기관 A", subtitle: "인프라 선검토 · 순차 협의", version: 1, accent: "blue",
        templates: [
          template("firewall", "firewall", "A기관 방화벽 정책 신청서", [f("name", "사업명", true), f("department", "요청 부서", true), f("sourceIp", null, true), f("destIp", null, true), f("protocol"), f("port", "허용 포트", true), f("purpose", "정책 신청 사유", true), f("usePeriod", "사용 기간", true)]),
          template("security", "security", "A기관 정보시스템 보안성 검토서", [f("name", null, true), f("description", "사업 개요", true), f("hosting"), f("personal", null, true), f("port"), f("accessControl", "접근 통제 방안", true), f("logging"), f("securityMeasures")])
        ],
        workflow: [
          { id: "stage_infra", title: "네트워크 구성 검토", roles: ["infra"], condition: "always" },
          { id: "stage_security", title: "정보보안 검토", roles: ["security"], condition: "always" }
        ]
      },
      {
        id: "agency_b", name: "공공기관 B", subtitle: "보안·인프라 병렬 협의 · 최종 승인", version: 1, accent: "teal",
        templates: [
          template("firewall", "firewall", "B기관 외부망 접근 허용 요청서", [f("department", "신청 부서", true), f("name", "서비스명", true), f("purpose", "연계 목적", true), f("sourceIp", "송신 시스템 IP", true), f("destIp", "수신 시스템 IP", true), f("port", "서비스 포트", true), f("ownerName", "업무 책임자", true)], "sections"),
          template("security", "security", "B기관 서비스 보안 사전점검표", [f("name", "시스템명", true), f("hosting", "서비스 환경", true), f("external", "대외 연계 여부", true), f("personal", "개인정보 포함 여부", true), f("port"), f("logging", "로그 보관 기준", true), f("securityMeasures", "필수 보호조치", true)], "sections")
        ],
        workflow: [
          { id: "stage_parallel", title: "보안·인프라 동시 협의", roles: ["security", "infra"], condition: "always" },
          { id: "stage_privacy", title: "개인정보 추가 검토", roles: ["privacy"], condition: "personal_yes" },
          { id: "stage_manager", title: "최종 검토 승인", roles: ["manager"], condition: "always" }
        ]
      }
    ];
  }
  function conditionResult(condition, project) {
    if (!condition || condition === "always") return "include";
    const map = { external_yes: ["external", "yes"], personal_yes: ["personal", "yes"], cloud: ["hosting", "cloud"] };
    const rule = map[condition];
    if (!rule) return "pending";
    const value = project[rule[0]];
    if (!value || value === "unknown") return "pending";
    return value === rule[1] ? "include" : "skip";
  }
  function activeTemplates(pack, project) {
    return pack.templates.filter(function (t) { return conditionResult(t.condition, project) !== "skip"; });
  }
  function activeStages(pack, project) {
    return pack.workflow.filter(function (s) { return conditionResult(s.condition, project) !== "skip"; }).map(function (s) {
      return Object.assign({}, s, { pendingCondition: conditionResult(s.condition, project) === "pending" });
    });
  }
  function tasksFor(pack, project) {
    return activeStages(pack, project).flatMap(function (stage, index) {
      return stage.roles.map(function (role) { return { id: stage.id + "__" + role, role: role, stageId: stage.id, stageIndex: index, stageTitle: stage.title }; });
    });
  }
  function currentStage(pack, project, records) {
    const stages = activeStages(pack, project);
    return stages.findIndex(function (stage) {
      return stage.pendingCondition || !stage.roles.every(function (role) { return records[stage.id + "__" + role] && records[stage.id + "__" + role].status === "approved"; });
    });
  }
  function canAct(taskId, pack, project, records, requested) {
    const task = tasksFor(pack, project).find(function (t) { return t.id === taskId; });
    return !!(requested && task && !activeStages(pack, project)[task.stageIndex].pendingCondition && task.stageIndex === currentStage(pack, project, records));
  }
  function isFieldKey(key) { return typeof key === "string" && (Object.hasOwn(FIELDS, key) || /^custom_[a-z0-9_]{1,100}$/.test(key)); }
  function validId(id) { return typeof id === "string" && /^[a-z0-9_]{1,70}$/.test(id); }
  function validatePack(pack, allowIncomplete) {
    const errors = [];
    if (!pack || typeof pack !== "object") return ["기관 설정 형식이 올바르지 않습니다."];
    if (typeof pack.name !== "string" || pack.name.length > 60 || (!allowIncomplete && !pack.name.trim())) errors.push("기관명을 입력해주세요.");
    if (typeof pack.subtitle !== "string" || pack.subtitle.length > 120) errors.push("기관 설정 설명을 확인해주세요.");
    if (!["blue", "teal"].includes(pack.accent)) errors.push("기관 표시 설정을 확인해주세요.");
    if (!Number.isInteger(pack.version) || pack.version < 1) errors.push("설정 버전이 올바르지 않습니다.");
    if (!Array.isArray(pack.templates) || !pack.templates.length || pack.templates.length > 8) return ["양식은 1~8개 등록할 수 있습니다."];
    const templateIds = new Set();
    pack.templates.forEach(function (t, i) {
      if (!t || typeof t !== "object") { errors.push("양식 데이터가 손상되었습니다."); return; }
      if (!validId(t.id) || templateIds.has(t.id)) errors.push("양식 식별자가 올바르지 않거나 중복되었습니다.");
      templateIds.add(t.id);
      if (typeof t.title !== "string" || t.title.length > 120 || (!allowIncomplete && !t.title.trim())) errors.push((i + 1) + "번 양식의 제목을 입력해주세요.");
      if (!allowIncomplete && !t.confirmed) errors.push((t.title || "양식") + ": 항목 연결을 확인해주세요.");
      if (typeof t.confirmed !== "boolean") errors.push("양식 확인 상태가 올바르지 않습니다.");
      if (!["firewall", "security", "custom"].includes(t.kind) || typeof t.fileName !== "string") errors.push("양식 종류 또는 파일 표시 정보가 올바르지 않습니다.");
      if (!Array.isArray(t.fields) || (!allowIncomplete && !t.fields.length) || t.fields.length > 40) { errors.push("양식별 항목은 1~40개여야 합니다."); return; }
      const ids = new Set();
      t.fields.forEach(function (field) {
        if (!field || typeof field !== "object") { errors.push("양식 항목이 손상되었습니다."); return; }
        if (typeof field.label !== "string" || field.label.length > 80 || (!allowIncomplete && !field.label.trim())) errors.push("이름 없는 항목이 있습니다.");
        if (typeof field.required !== "boolean") errors.push("필수 항목 설정을 확인해주세요.");
        if (!isFieldKey(field.key)) errors.push("잘못된 데이터 연결 항목이 있습니다.");
        if (!validId(field.id) || ids.has(field.id)) errors.push("양식 항목 ID가 올바르지 않습니다.");
        ids.add(field.id);
      });
      if (typeof t.condition !== "string" || !Object.hasOwn(CONDITIONS, t.condition)) errors.push("양식 적용 조건을 확인해주세요.");
      if (!["table", "sections"].includes(t.layout)) errors.push("지원하지 않는 문서 레이아웃입니다.");
    });
    if (!Array.isArray(pack.workflow) || (!allowIncomplete && !pack.workflow.length) || pack.workflow.length > 8) return errors.concat(["검토 단계는 1~8개여야 합니다."]);
    const stageIds = new Set();
    pack.workflow.forEach(function (s) {
      if (!s || typeof s !== "object") { errors.push("검토 단계가 손상되었습니다."); return; }
      if (typeof s.title !== "string" || s.title.length > 80 || (!allowIncomplete && !s.title.trim())) errors.push("검토 단계명을 입력해주세요.");
      if (!Array.isArray(s.roles) || (!allowIncomplete && !s.roles.length) || s.roles.some(function (r) { return typeof r !== "string" || !Object.hasOwn(ROLES, r); })) errors.push("각 단계에 담당 역할을 한 개 이상 지정해주세요.");
      if (Array.isArray(s.roles) && new Set(s.roles).size !== s.roles.length) errors.push("같은 단계의 역할이 중복되었습니다.");
      if (!validId(s.id) || stageIds.has(s.id)) errors.push("검토 단계 ID가 올바르지 않습니다.");
      stageIds.add(s.id);
      if (typeof s.condition !== "string" || !Object.hasOwn(CONDITIONS, s.condition)) errors.push("검토 조건을 확인해주세요.");
    });
    if (!allowIncomplete && !pack.workflow.some(function (s) { return s && s.condition === "always"; })) errors.push("조건과 관계없이 수행하는 검토 단계가 한 개 이상 필요합니다.");
    return Array.from(new Set(errors));
  }
  function missingFields(pack, project, custom) {
    const missing = [];
    activeTemplates(pack, project).forEach(function (t) {
      t.fields.filter(function (field) { return field.required; }).forEach(function (field) {
        const value = field.key.startsWith("custom_") ? custom[field.key] : project[field.key];
        if (value == null || !String(value).trim() || value === "unknown" || value === "미정") missing.push({ key: field.key, label: field.label, template: t.title });
      });
    });
    return missing;
  }
  function normalizeLabel(v) { return String(v).toLowerCase().replace(/[\s()[\]{}_*:：·/\\.,-]/g, ""); }
  function guessKey(label) {
    const normalized = normalizeLabel(label);
    const exact = Object.keys(FIELDS).find(function (key) { return FIELDS[key].aliases.some(function (a) { return normalizeLabel(a) === normalized; }); });
    if (exact) return exact;
    return Object.keys(FIELDS).find(function (key) {
      return FIELDS[key].aliases.filter(function (a) { return a.length >= 3; }).some(function (a) { return normalized.includes(normalizeLabel(a)); });
    }) || null;
  }
  function parseTemplateText(text, templateId) {
    if (!validId(templateId)) throw new Error("양식 식별자가 올바르지 않습니다.");
    if (!String(text).trim()) throw new Error("양식 내용이 비어 있습니다.");
    if (String(text).length > 100000) throw new Error("양식 텍스트는 10만 자 이내로 입력해주세요.");
    const lines = String(text).split(/\r?\n/).map(function (v) { return v.trim(); }).filter(Boolean);
    let title = "";
    let proposed = [];
    if (/^[\[{]/.test(String(text).trim())) {
      let parsed;
      try { parsed = JSON.parse(text); } catch (_) { throw new Error("JSON 양식 문법이 올바르지 않습니다."); }
      const rows = Array.isArray(parsed) ? parsed : parsed.fields;
      if (!Array.isArray(rows)) throw new Error("JSON 양식에는 fields 배열이 필요합니다.");
      title = typeof parsed.title === "string" ? parsed.title.slice(0, 120) : "";
      proposed = rows.slice(0, 40).map(function (row) {
        if (!row || typeof row !== "object" || typeof row.label !== "string") throw new Error("각 항목에 label 문자열이 필요합니다.");
        const id = uid("f");
        const key = typeof row.key === "string" && Object.hasOwn(FIELDS, row.key) ? row.key : guessKey(row.label);
        return { id: id, key: key || "custom_" + templateId + "_" + id, label: row.label.slice(0, 80), required: row.required === true };
      });
    } else {
      lines.forEach(function (raw, index) {
        if (proposed.length >= 40) return;
        let label = raw.replace(/^[#\-\u2022□○\d.)\s]+/, "").trim();
        if (index === 0 && /신청서|검토서|요청서|점검표|양식/.test(label) && !/[:：]/.test(label)) { title = label.slice(0, 120); return; }
        label = label.split(/[:：\t]/)[0].replace(/\(\s*필수\s*\)|\[필수\]|[＊*]/g, "").trim();
        const key = guessKey(label);
        if (!label || label.length > 60 || (!key && label.length > 35) || /안내|유의사항|작성방법|제출기한|^※/.test(label)) return;
        if (proposed.some(function (field) { return normalizeLabel(field.label) === normalizeLabel(label); })) return;
        const id = uid("f");
        proposed.push({ id: id, key: key || "custom_" + templateId + "_" + id, label: label, required: /필수|[＊*]/.test(raw) });
      });
    }
    if (!proposed.length) throw new Error("읽을 수 있는 양식 항목을 찾지 못했습니다. 항목명을 한 줄에 하나씩 붙여 넣어주세요.");
    return { title: title, fields: proposed, recognized: proposed.filter(function (x) { return !x.key.startsWith("custom_"); }).length };
  }

  async function inflateBounded(bytes, expected) {
    if (typeof DecompressionStream === "undefined") throw new Error("이 브라우저는 문서 압축 해제를 지원하지 않습니다. 양식 항목을 텍스트로 붙여 넣어주세요.");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const reader = stream.getReader();
    const chunks = []; let total = 0;
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.length;
      if (total > 8 * 1024 * 1024 || total > expected + 64) { await reader.cancel(); throw new Error("압축 해제 크기 제한을 초과했습니다."); }
      chunks.push(item.value);
    }
    const out = new Uint8Array(total); let offset = 0;
    chunks.forEach(function (chunk) { out.set(chunk, offset); offset += chunk.length; });
    return out;
  }
  async function extractXmlPackage(buffer, extension) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("정상적인 문서 패키지가 아닙니다.");
    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    if (count > 1000 || count === 65535) throw new Error("문서 내부 항목 수 제한을 초과했습니다.");
    const parts = []; let expandedTotal = 0;
    for (let i = 0; i < count; i += 1) {
      if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error("문서 내부 정보가 손상되었습니다.");
      const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
      const compressed = view.getUint32(offset + 20, true), size = view.getUint32(offset + 24, true);
      const nameLen = view.getUint16(offset + 28, true), extraLen = view.getUint16(offset + 30, true), commentLen = view.getUint16(offset + 32, true);
      const local = view.getUint32(offset + 42, true);
      if (offset + 46 + nameLen + extraLen + commentLen > bytes.length) throw new Error("손상된 ZIP 메타데이터입니다.");
      const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLen));
      const wanted = extension === "hwpx" ? /^Contents\/section\d+\.xml$/i.test(name) : name === "word/document.xml";
      if (wanted) {
        if ((flags & 1) || size > 8 * 1024 * 1024 || size / Math.max(compressed, 1) > 250 || parts.length > 30) throw new Error("암호화되었거나 안전 처리 제한을 초과한 문서입니다.");
        if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) throw new Error("문서 내용 위치가 올바르지 않습니다.");
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        if (start + compressed > bytes.length) throw new Error("문서 내용이 잘렸습니다.");
        const raw = bytes.slice(start, start + compressed);
        const expanded = method === 0 ? raw : method === 8 ? await inflateBounded(raw, size) : null;
        if (!expanded) throw new Error("지원하지 않는 문서 압축 방식입니다.");
        expandedTotal += expanded.length;
        if (expandedTotal > 8 * 1024 * 1024) throw new Error("문서 전체 텍스트 처리 한도를 초과했습니다.");
        const xml = new TextDecoder().decode(expanded);
        if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("외부 엔티티가 포함된 XML은 처리하지 않습니다.");
        const parsed = new DOMParser().parseFromString(xml, "application/xml");
        if (parsed.getElementsByTagName("parsererror").length) throw new Error("문서 XML을 읽지 못했습니다.");
        const paragraphs = Array.from(parsed.getElementsByTagNameNS("*", "p")).filter(function (p) { return !p.getElementsByTagNameNS("*", "p").length; });
        parts.push(paragraphs.map(function (p) {
          return Array.from(p.getElementsByTagNameNS("*", "t")).map(function (t) { return t.textContent || ""; }).join("");
        }).join("\n"));
      }
      offset += 46 + nameLen + extraLen + commentLen;
    }
    const text = parts.join("\n").slice(0, 100000);
    if (!text.trim()) throw new Error("문서에서 텍스트를 추출하지 못했습니다. 표 항목명을 붙여 넣어주세요.");
    return text;
  }
  async function extractFile(file) {
    if (!file || !file.size) throw new Error("빈 파일은 등록할 수 없습니다.");
    if (file.size > 5 * 1024 * 1024) throw new Error("5MB 이하의 양식을 등록해주세요.");
    const ext = file.name.split(".").pop().toLowerCase();
    if (["txt", "md", "json"].includes(ext)) {
      const text = await file.text();
      if (text.includes("\u0000")) throw new Error("텍스트 파일 형식이 올바르지 않습니다.");
      if (text.length > 100000) throw new Error("추출 텍스트는 10만 자 이내여야 합니다.");
      return text;
    }
    if (["hwpx", "docx"].includes(ext)) return extractXmlPackage(await file.arrayBuffer(), ext);
    throw new Error("TXT·MD·JSON·HWPX·DOCX만 지원합니다. PDF·HWP·스캔본은 항목명을 붙여 넣어주세요.");
  }
  function createStore(storage) {
    const key = "secureflow_institution_profiles_v2";
    let records = {};
    defaults().forEach(function (p) { records[p.id] = { published: clone(p), draft: clone(p) }; });
    try {
      const saved = storage && JSON.parse(storage.getItem(key) || "null");
      if (saved && typeof saved === "object") {
        Object.keys(records).forEach(function (id) {
          if (saved[id] && !validatePack(saved[id].published).length && saved[id].published.id === id) {
            records[id].published = clone(saved[id].published);
            records[id].draft = saved[id].draft && saved[id].draft.id === id && !validatePack(saved[id].draft, true).length ? clone(saved[id].draft) : clone(saved[id].published);
          }
        });
      }
    } catch (_) { /* Corrupt/unavailable local storage does not prevent using demo presets. */ }
    function persist() {
      try { if (!storage) return false; storage.setItem(key, JSON.stringify(records)); return true; } catch (_) { return false; }
    }
    return {
      ids: function () { return Object.keys(records); },
      published: function (id) { return clone(records[id].published); },
      draft: function (id) { return records[id].draft; },
      dirty: function (id) { return JSON.stringify(records[id].draft) !== JSON.stringify(records[id].published); },
      save: function () { return persist(); },
      publish: function (id) {
        if (!records[id] || records[id].draft.id !== id) return { ok: false, errors: ["기관 설정의 소속 ID를 변경할 수 없습니다."] };
        const errors = validatePack(records[id].draft);
        if (errors.length) return { ok: false, errors: errors };
        const next = clone(records[id].draft);
        next.version = records[id].published.version + 1;
        records[id] = { published: clone(next), draft: clone(next) };
        return { ok: true, version: next.version, persisted: persist() };
      },
      discard: function (id) { records[id].draft = clone(records[id].published); return persist(); }
    };
  }
  return { clone: clone, uid: uid, fields: FIELDS, roles: ROLES, conditions: CONDITIONS, defaults: defaults,
    conditionResult: conditionResult, activeTemplates: activeTemplates, activeStages: activeStages, tasksFor: tasksFor,
    currentStage: currentStage, canAct: canAct, validatePack: validatePack, missingFields: missingFields,
    guessKey: guessKey, parseTemplateText: parseTemplateText, extractFile: extractFile, createStore: createStore };
});
