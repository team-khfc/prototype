"use strict";

// Run with: node tests/config-engine.test.cjs
// Or: node --test --test-isolation=none tests/config-engine.test.cjs
// Pure Node tests: no browser, network, actual agency data, or engine mutation.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const E = require("../docs/config-engine.js");

const STORAGE_KEY = "secureflow_institution_profiles_v2";

function project(overrides) {
  return Object.assign({
    name: "합성 데이터 분석 프로젝트",
    department: "테스트 부서",
    description: "외부 공개 통계 API를 호출하는 모의 프로젝트입니다.",
    hosting: "internal",
    external: "yes",
    personal: "no",
    sourceIp: "192.0.2.12",
    destIp: "198.51.100.24",
    protocol: "TCP",
    port: "443",
    purpose: "테스트 API 조회",
    usePeriod: "모의 운영 기간",
    accessControl: "시연용 역할 기반 접근 통제",
    logging: "시연용 로그 관리",
    securityMeasures: "시연용 보안 통제",
    ownerName: "모의 책임자"
  }, overrides || {});
}

function agency(id) {
  return E.defaults().find(function (pack) { return pack.id === id; });
}

function approve(records, taskId) {
  records[taskId] = { status: "approved", note: "모의 검토 완료" };
}

function memoryStorage(initial) {
  const data = new Map(Object.entries(initial || {}));
  return {
    getItem: function (key) { return data.has(key) ? data.get(key) : null; },
    setItem: function (key, value) { data.set(key, String(value)); }
  };
}

function savedRecords() {
  const records = {};
  E.defaults().forEach(function (pack) {
    records[pack.id] = { published: E.clone(pack), draft: E.clone(pack) };
  });
  return records;
}

function textFile(name, text, size) {
  return {
    name: name,
    size: size == null ? Buffer.byteLength(text, "utf8") : size,
    text: async function () { return text; },
    arrayBuffer: async function () {
      const bytes = new TextEncoder().encode(text);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

test("A/B presets are separately valid and actually differ in forms and workflow", function () {
  const packs = E.defaults();
  assert.deepEqual(packs.map(function (p) { return p.id; }), ["agency_a", "agency_b"]);
  packs.forEach(function (p) { assert.deepEqual(E.validatePack(p), []); });
  const a = packs[0], b = packs[1];
  assert.equal(a.templates[0].layout, "table");
  assert.equal(b.templates[0].layout, "sections");
  assert.notEqual(a.templates[0].title, b.templates[0].title);
  assert.ok(a.templates[0].fields.some(function (f) { return f.key === "usePeriod"; }));
  assert.ok(b.templates[0].fields.some(function (f) { return f.key === "ownerName"; }));
  assert.deepEqual(a.workflow.map(function (s) { return s.roles; }), [["infra"], ["security"]]);
  assert.deepEqual(b.workflow.map(function (s) { return s.roles; }), [["security", "infra"], ["privacy"], ["manager"]]);
});

test("A sequential review locks later stages and locks everything before a request", function () {
  const a = agency("agency_a"), p = project(), records = {};
  assert.equal(E.currentStage(a, p, records), 0);
  assert.equal(E.canAct("stage_infra__infra", a, p, records, false), false);
  assert.equal(E.canAct("stage_infra__infra", a, p, records, true), true);
  assert.equal(E.canAct("stage_security__security", a, p, records, true), false);
  assert.equal(E.canAct("missing_task", a, p, records, true), false);
  approve(records, "stage_infra__infra");
  assert.equal(E.currentStage(a, p, records), 1);
  assert.equal(E.canAct("stage_security__security", a, p, records, true), true);
  approve(records, "stage_security__security");
  assert.equal(E.currentStage(a, p, records), -1);
  assert.equal(E.canAct("stage_security__security", a, p, records, true), false);
});

test("a change request in an earlier sequential stage blocks later work again", function () {
  const a = agency("agency_a"), p = project(), records = {};
  approve(records, "stage_infra__infra");
  approve(records, "stage_security__security");
  records.stage_infra__infra.status = "changes";
  assert.equal(E.currentStage(a, p, records), 0);
  assert.equal(E.canAct("stage_security__security", a, p, records, true), false);
});

test("B parallel review requires every role before its next stage", function () {
  const b = agency("agency_b"), p = project({ personal: "no" }), records = {};
  assert.deepEqual(E.activeStages(b, p).map(function (s) { return s.id; }), ["stage_parallel", "stage_manager"]);
  assert.equal(E.canAct("stage_parallel__security", b, p, records, true), true);
  assert.equal(E.canAct("stage_parallel__infra", b, p, records, true), true);
  assert.equal(E.canAct("stage_manager__manager", b, p, records, true), false);
  approve(records, "stage_parallel__security");
  assert.equal(E.canAct("stage_manager__manager", b, p, records, true), false);
  approve(records, "stage_parallel__infra");
  assert.equal(E.currentStage(b, p, records), 1);
  assert.equal(E.canAct("stage_manager__manager", b, p, records, true), true);
});

test("B inserts privacy review when personal data is included", function () {
  const b = agency("agency_b"), p = project({ personal: "yes" }), records = {};
  approve(records, "stage_parallel__security");
  approve(records, "stage_parallel__infra");
  assert.deepEqual(E.activeStages(b, p).map(function (s) { return s.id; }), ["stage_parallel", "stage_privacy", "stage_manager"]);
  assert.equal(E.canAct("stage_privacy__privacy", b, p, records, true), true);
  assert.equal(E.canAct("stage_manager__manager", b, p, records, true), false);
  approve(records, "stage_privacy__privacy");
  assert.equal(E.canAct("stage_manager__manager", b, p, records, true), true);
});

test("reordering stages changes the executable sequence, not just labels", function () {
  const a = agency("agency_a"), p = project(), records = {};
  a.workflow.reverse();
  assert.equal(E.canAct("stage_security__security", a, p, records, true), true);
  assert.equal(E.canAct("stage_infra__infra", a, p, records, true), false);
});

test("conditional evaluation is conservative for unknown values", function () {
  assert.equal(E.conditionResult("always", project()), "include");
  assert.equal(E.conditionResult("personal_yes", project({ personal: "yes" })), "include");
  assert.equal(E.conditionResult("personal_yes", project({ personal: "no" })), "skip");
  assert.equal(E.conditionResult("personal_yes", project({ personal: "unknown" })), "pending");
  assert.equal(E.conditionResult("external_yes", project({ external: "" })), "pending");
  assert.equal(E.conditionResult("cloud", project({ hosting: "cloud" })), "include");
  assert.equal(E.conditionResult("cloud", project({ hosting: "internal" })), "skip");
  assert.equal(E.conditionResult("unexpected_condition", project()), "pending");
});

test("a pending conditional stage remains visible instead of being skipped", function () {
  const b = agency("agency_b"), p = project({ personal: "unknown" });
  const stages = E.activeStages(b, p);
  assert.equal(stages.length, 3);
  assert.equal(stages[1].id, "stage_privacy");
  assert.equal(stages[1].pendingCondition, true);
  assert.ok(E.tasksFor(b, p).some(function (t) { return t.id === "stage_privacy__privacy"; }));
  assert.equal(b.workflow[1].pendingCondition, undefined, "derived view must not mutate its configuration");
});

test("a pending condition cannot be approved until the prerequisite is resolved", function () {
  const b = agency("agency_b"), p = project({ personal: "unknown" }), records = {};
  approve(records, "stage_parallel__security");
  approve(records, "stage_parallel__infra");
  assert.equal(E.canAct("stage_privacy__privacy", b, p, records, true), false);
});

test("stale approval records cannot let a pending condition advance", function () {
  const b = agency("agency_b"), p = project({ personal: "unknown" }), records = {};
  approve(records, "stage_parallel__security");
  approve(records, "stage_parallel__infra");
  approve(records, "stage_privacy__privacy");
  assert.equal(E.currentStage(b, p, records), 1);
  assert.equal(E.canAct("stage_manager__manager", b, p, records, true), false);
});

test("draft edits and draft persistence do not change the published version", function () {
  const storage = memoryStorage(), store = E.createStore(storage);
  store.draft("agency_a").name = "변경 중인 A기관";
  store.draft("agency_a").templates[0].title = "아직 게시하지 않은 서식";
  store.draft("agency_a").templates[0].confirmed = false;
  assert.equal(store.dirty("agency_a"), true);
  assert.equal(store.published("agency_a").name, "공공기관 A");
  assert.equal(store.save(), true);
  const restored = E.createStore(storage);
  assert.equal(restored.draft("agency_a").name, "변경 중인 A기관");
  assert.equal(restored.draft("agency_a").templates[0].confirmed, false);
  assert.equal(restored.published("agency_a").version, 1);
  assert.equal(restored.published("agency_a").name, "공공기관 A");
});

test("publish creates a new snapshot without mutating earlier snapshots or another agency", function () {
  const store = E.createStore(memoryStorage());
  const oldA = store.published("agency_a");
  const oldB = store.published("agency_b");
  store.draft("agency_a").name = "게시된 A기관 이름";
  store.draft("agency_a").workflow.reverse();
  const result = store.publish("agency_a");
  assert.equal(result.ok, true);
  assert.equal(result.version, 2);
  assert.equal(store.dirty("agency_a"), false);
  assert.equal(store.published("agency_a").name, "게시된 A기관 이름");
  assert.equal(oldA.version, 1);
  assert.equal(oldA.name, "공공기관 A");
  assert.equal(oldA.workflow[0].roles[0], "infra");
  assert.deepEqual(store.published("agency_b"), oldB);
  const leaked = store.published("agency_a");
  leaked.templates[0].fields[0].label = "caller mutation";
  assert.notEqual(store.published("agency_a").templates[0].fields[0].label, "caller mutation");
});

test("unconfirmed field mappings block publish and keep the existing published snapshot", function () {
  const store = E.createStore(memoryStorage()), before = store.published("agency_a");
  store.draft("agency_a").templates[0].confirmed = false;
  const result = store.publish("agency_a");
  assert.equal(result.ok, false);
  assert.ok(result.errors.length);
  assert.deepEqual(store.published("agency_a"), before);
});

test("discard restores the published snapshot rather than keeping mutable draft references", function () {
  const store = E.createStore(memoryStorage());
  const oldDraft = store.draft("agency_a");
  oldDraft.name = "폐기할 초안";
  assert.equal(store.discard("agency_a"), true);
  assert.equal(store.dirty("agency_a"), false);
  assert.equal(store.draft("agency_a").name, "공공기관 A");
  oldDraft.name = "또 변경";
  assert.equal(store.draft("agency_a").name, "공공기관 A");
});

test("blocked local storage leaves presets and in-memory publishing usable", function () {
  const blocked = { getItem: function () { throw new Error("blocked"); }, setItem: function () { throw new Error("blocked"); } };
  const store = E.createStore(blocked);
  assert.deepEqual(store.ids(), ["agency_a", "agency_b"]);
  assert.equal(store.save(), false);
  store.draft("agency_a").name = "메모리 내 변경";
  const result = store.publish("agency_a");
  assert.equal(result.ok, true);
  assert.equal(result.persisted, false);
  assert.equal(store.published("agency_a").version, 2);
});

test("required custom fields are detected, filled independently, and respect template conditions", function () {
  const a = agency("agency_a"), p = project();
  a.templates.push({
    id: "additional", kind: "custom", title: "추가 검토 양식", condition: "personal_yes",
    layout: "table", confirmed: true, fileName: "모의 양식",
    fields: [
      { id: "custom_field_one", key: "custom_review_owner", label: "개인정보 처리 책임자", required: true },
      { id: "custom_field_two", key: "custom_review_note", label: "선택 의견", required: false }
    ]
  });
  assert.deepEqual(E.validatePack(a), []);
  assert.deepEqual(E.missingFields(a, p, {}), []);
  p.personal = "yes";
  let missing = E.missingFields(a, p, {});
  assert.equal(missing.length, 1);
  assert.equal(missing[0].key, "custom_review_owner");
  assert.equal(missing[0].template, "추가 검토 양식");
  assert.deepEqual(E.missingFields(a, p, { custom_review_owner: "모의 담당 역할" }), []);
  assert.equal(E.missingFields(a, p, { custom_review_owner: "   " }).length, 1);
  assert.equal(E.missingFields(a, p, { custom_review_owner: "unknown" }).length, 1);
  assert.equal(E.missingFields(a, p, { custom_review_owner: "미정" }).length, 1);
});

test("pending template conditions keep required fields visible for follow-up", function () {
  const a = agency("agency_a");
  a.templates[0].condition = "external_yes";
  const p = project({ external: "unknown", destIp: "" });
  assert.equal(E.activeTemplates(a, p).length, 2);
  assert.ok(E.missingFields(a, p, {}).some(function (f) { return f.key === "destIp"; }));
});

test("known aliases map to canonical keys", function () {
  assert.equal(E.guessKey("신청 부서"), "department");
  assert.equal(E.guessKey("프로젝트명"), "name");
  assert.equal(E.guessKey("송신지 IP"), "sourceIp");
  assert.equal(E.guessKey("수신지 IP"), "destIp");
  assert.equal(E.guessKey("포트 번호"), "port");
  assert.equal(E.guessKey("계약 검토 접수코드"), null);
});

test("text template parsing recognizes title, required markers, aliases, and custom fields", function () {
  const parsed = E.parseTemplateText("방화벽 신청서\n* 사업명\n* 요청 부서\n출발지 IP:\n목적지 IP:\n담당 연락처 (필수)\n사용 기간\n사용 기간\n※ 유의사항", "firewall");
  assert.equal(parsed.title, "방화벽 신청서");
  assert.equal(parsed.fields.length, 6);
  assert.equal(parsed.recognized, 5);
  assert.equal(parsed.fields[0].key, "name");
  assert.equal(parsed.fields[0].required, true);
  assert.equal(parsed.fields[1].key, "department");
  const custom = parsed.fields.find(function (f) { return f.label === "담당 연락처"; });
  assert.match(custom.key, /^custom_firewall_[a-z0-9_]+$/);
  assert.equal(custom.required, true);
  assert.equal(parsed.fields.filter(function (f) { return f.label === "사용 기간"; }).length, 1);
});

test("JSON template parsing preserves field order and requires boolean true for required", function () {
  const text = JSON.stringify({ title: "기관 검토서", fields: [
    { label: "독자 항목", required: true },
    { label: "시스템명", key: "name", required: false },
    { label: "목적지 포트", key: "port", required: "true" }
  ] });
  const parsed = E.parseTemplateText(text, "security");
  assert.equal(parsed.title, "기관 검토서");
  assert.deepEqual(parsed.fields.map(function (f) { return f.label; }), ["독자 항목", "시스템명", "목적지 포트"]);
  assert.equal(parsed.fields[0].required, true);
  assert.equal(parsed.fields[2].required, false);
  assert.equal(parsed.fields[1].key, "name");
  assert.equal(parsed.fields[2].key, "port");
});

test("JSON parser ignores dangerous keys and never accepts prototype keys as mappings", function () {
  const parsed = E.parseTemplateText('{"title":"검토서","__proto__":{"polluted":true},"fields":[{"label":"기관 전용 1","key":"__proto__","required":true},{"label":"기관 전용 2","key":"constructor"},{"label":"기관 전용 3","key":"toString"}]}', "security");
  parsed.fields.forEach(function (field) {
    assert.match(field.key, /^custom_security_/);
    assert.notEqual(field.key, "__proto__");
    assert.notEqual(field.key, "constructor");
  });
  assert.equal(({}).polluted, undefined);
  assert.equal(Object.hasOwn(E.fields, "__proto__"), false);
});

test("text and JSON extraction reject unusable content and enforce bounded input", function () {
  assert.throws(function () { E.parseTemplateText("", "firewall"); }, /비어/);
  assert.throws(function () { E.parseTemplateText(" ".repeat(10), "firewall"); }, /비어/);
  assert.throws(function () { E.parseTemplateText("x".repeat(100001), "firewall"); }, /10만/);
  assert.throws(function () { E.parseTemplateText('{"fields":', "firewall"); }, /JSON/);
  assert.throws(function () { E.parseTemplateText('{"fields":{}}', "firewall"); }, /fields 배열/);
  assert.throws(function () { E.parseTemplateText('{"fields":[null]}', "firewall"); }, /label/);
  assert.throws(function () { E.parseTemplateText('{"fields":[{"label":123}]}', "firewall"); }, /label/);
  assert.throws(function () { E.parseTemplateText('{"fields":[]}', "firewall"); }, /항목/);
  const bounded = E.parseTemplateText(JSON.stringify({ fields: Array.from({ length: 45 }, function (_, i) { return { label: "기관 항목 " + i }; }) }), "security");
  assert.equal(bounded.fields.length, 40);
});

test("extractFile reads supported text formats without interpreting their content", async function () {
  for (const ext of ["txt", "md", "json"]) {
    const source = ext === "json" ? '{"fields":[{"label":"사업명","required":true}]}' : "방화벽 신청서\n* 사업명\n목적지 IP";
    const extracted = await E.extractFile(textFile("sample." + ext, source));
    assert.equal(extracted, source);
    assert.ok(E.parseTemplateText(extracted, "firewall").fields.length);
  }
});

test("extractFile rejects empty, oversized, NUL-containing, and unsupported uploads", async function () {
  await assert.rejects(E.extractFile(textFile("empty.txt", "", 0)), /빈 파일/);
  await assert.rejects(E.extractFile(textFile("large.txt", "x", 5 * 1024 * 1024 + 1)), /5MB/);
  await assert.rejects(E.extractFile(textFile("binary.txt", "bad\u0000data")), /텍스트 파일/);
  await assert.rejects(E.extractFile(textFile("huge.txt", "x".repeat(100001))), /10만/);
  await assert.rejects(E.extractFile(textFile("unsupported.pdf", "not a PDF")), /TXT.*HWPX.*DOCX/);
  await assert.rejects(E.extractFile(textFile("legacy.hwp", "fake")), /지원/);
});

test("invalid HWPX/DOCX archive input fails safely before XML parsing", async function () {
  await assert.rejects(E.extractFile(textFile("bad.hwpx", "not zip")), /문서 패키지/);
  await assert.rejects(E.extractFile(textFile("bad.docx", "not zip")), /문서 패키지/);
});

test("configuration validation rejects duplicate ids, invalid mappings, and duplicate roles", function () {
  const duplicateTemplate = agency("agency_a");
  duplicateTemplate.templates[1].id = duplicateTemplate.templates[0].id;
  assert.ok(E.validatePack(duplicateTemplate).some(function (s) { return /식별자/.test(s); }));
  const invalidMapping = agency("agency_a");
  invalidMapping.templates[0].fields[0].key = "__proto__";
  assert.ok(E.validatePack(invalidMapping).some(function (s) { return /연결 항목/.test(s); }));
  const duplicateRole = agency("agency_a");
  duplicateRole.workflow[0].roles = ["infra", "infra"];
  assert.ok(E.validatePack(duplicateRole).some(function (s) { return /역할이 중복/.test(s); }));
  const invalidRole = agency("agency_a");
  invalidRole.workflow[0].roles = ["__proto__"];
  assert.ok(E.validatePack(invalidRole).length);
  const duplicateStage = agency("agency_a");
  duplicateStage.workflow[1].id = duplicateStage.workflow[0].id;
  assert.ok(E.validatePack(duplicateStage).some(function (s) { return /단계 ID/.test(s); }));
});

test("configuration validation rejects unsupported conditions/layout and no always-on stage", function () {
  const pack = agency("agency_a");
  pack.templates[0].condition = "__proto__";
  pack.templates[0].layout = "script";
  pack.workflow.forEach(function (s) { s.condition = "personal_yes"; });
  const errors = E.validatePack(pack);
  assert.ok(errors.some(function (s) { return /양식 적용 조건/.test(s); }));
  assert.ok(errors.some(function (s) { return /레이아웃/.test(s); }));
  assert.ok(errors.some(function (s) { return /조건과 관계없이/.test(s); }));
});

const structuralCorruption = [
  ["null template", function (p) { p.templates[0] = null; }],
  ["null field", function (p) { p.templates[0].fields[0] = null; }],
  ["null workflow stage", function (p) { p.workflow[0] = null; }],
  ["null roles", function (p) { p.workflow[0].roles = null; }],
  ["object roles", function (p) { p.workflow[0].roles = {}; }],
  ["missing roles", function (p) { delete p.workflow[0].roles; }]
];
structuralCorruption.forEach(function (entry) {
  test("damaged configuration returns validation errors instead of crashing: " + entry[0], function () {
    const pack = agency("agency_a");
    entry[1](pack);
    let errors;
    assert.doesNotThrow(function () { errors = E.validatePack(pack); });
    assert.ok(Array.isArray(errors) && errors.length > 0);
  });
});

test("corrupt storage JSON falls back to valid presets", function () {
  const storage = memoryStorage({ [STORAGE_KEY]: "{invalid json" });
  const store = E.createStore(storage);
  assert.equal(store.published("agency_a").version, 1);
  assert.deepEqual(E.validatePack(store.published("agency_a")), []);
  assert.deepEqual(E.validatePack(store.published("agency_b")), []);
});

test("structurally corrupt stored drafts fall back to a safe editable snapshot", function () {
  const saved = savedRecords();
  saved.agency_a.draft = { id: "agency_a", name: "손상된 초안", templates: [null], workflow: [null] };
  const store = E.createStore(memoryStorage({ [STORAGE_KEY]: JSON.stringify(saved) }));
  const draft = store.draft("agency_a");
  assert.ok(draft.templates[0] && Array.isArray(draft.templates[0].fields), "null template must not reach the administrator renderer");
  assert.ok(draft.workflow[0] && Array.isArray(draft.workflow[0].roles), "null stage must not reach the administrator renderer");
});

test("incomplete but structurally sound drafts are restored for continued editing", function () {
  const storage = memoryStorage(), store = E.createStore(storage);
  const draft = store.draft("agency_a");
  draft.templates[0].title = "";
  draft.templates[0].fields = [];
  draft.templates[0].confirmed = false;
  draft.workflow[0].title = "";
  draft.workflow[0].roles = [];
  assert.deepEqual(E.validatePack(draft, true), []);
  assert.ok(E.validatePack(draft).length > 0);
  assert.equal(store.save(), true);
  const restored = E.createStore(storage);
  assert.deepEqual(restored.draft("agency_a").templates[0].fields, []);
  assert.deepEqual(restored.draft("agency_a").workflow[0].roles, []);
  assert.equal(restored.draft("agency_a").templates[0].confirmed, false);
  assert.equal(restored.published("agency_a").templates[0].confirmed, true);
  assert.equal(restored.publish("agency_a").ok, false);
});

test("an empty draft workflow can be saved but cannot become a published workflow", function () {
  const storage = memoryStorage(), store = E.createStore(storage);
  store.draft("agency_a").workflow = [];
  assert.deepEqual(E.validatePack(store.draft("agency_a"), true), []);
  assert.equal(store.save(), true);
  const restored = E.createStore(storage);
  assert.deepEqual(restored.draft("agency_a").workflow, []);
  assert.equal(restored.publish("agency_a").ok, false);
  assert.equal(restored.published("agency_a").workflow.length, 2);
});

test("corrupt stored version metadata cannot turn numeric versioning into string concatenation", function () {
  const saved = savedRecords();
  saved.agency_a.published.version = "1";
  saved.agency_a.draft.version = "1";
  const store = E.createStore(memoryStorage({ [STORAGE_KEY]: JSON.stringify(saved) }));
  const initial = store.published("agency_a").version;
  assert.equal(Number.isInteger(initial) && initial > 0, true);
  assert.equal(store.publish("agency_a").version, initial + 1);
});

test("publishing a tampered draft cannot change its owning agency id", function () {
  const store = E.createStore(memoryStorage());
  store.draft("agency_a").id = "agency_b";
  const result = store.publish("agency_a");
  assert.equal(result.ok, false, "agency identity mismatch should be rejected");
  assert.equal(store.published("agency_a").id, "agency_a");
  assert.equal(store.published("agency_b").id, "agency_b");
});

test("non-string mapping keys are rejected before a restored setting can reach startsWith", function () {
  for (const key of [["name"], ["custom_extra"], {}, null, 123, undefined]) {
    const pack = agency("agency_a");
    pack.templates[0].fields[0].key = key;
    assert.ok(E.validatePack(pack).length > 0, "published validation must reject " + JSON.stringify(key));
    assert.ok(E.validatePack(pack, true).length > 0, "draft restoration must reject non-string keys");
  }
  const saved = savedRecords();
  saved.agency_a.published.templates[0].fields[0].key = ["name"];
  saved.agency_a.draft.templates[0].fields[0].key = ["name"];
  const restored = E.createStore(memoryStorage({ [STORAGE_KEY]: JSON.stringify(saved) }));
  assert.equal(typeof restored.published("agency_a").templates[0].fields[0].key, "string");
  assert.doesNotThrow(function () { E.missingFields(restored.published("agency_a"), project(), {}); });
  assert.deepEqual(E.missingFields(restored.published("agency_a"), project(), {}), []);
});

test("template, field, and stage ids require bounded strings rather than coercible JSON values", function () {
  const targets = [
    function (p) { return p.templates[0]; },
    function (p) { return p.templates[0].fields[0]; },
    function (p) { return p.workflow[0]; }
  ];
  for (const target of targets) {
    for (const id of [["valid_id"], {}, null, 123, undefined, "", "a".repeat(71)]) {
      const pack = agency("agency_a");
      target(pack).id = id;
      assert.ok(E.validatePack(pack).length > 0, "published id must be a bounded string: " + JSON.stringify(id));
      assert.ok(E.validatePack(pack, true).length > 0, "draft id must be a bounded string");
    }
  }
});

test("mapping confirmation accepts only booleans and still allows an unconfirmed draft", function () {
  for (const confirmed of ["true", "false", "", 1, 0, null, undefined, {}, []]) {
    const pack = agency("agency_a");
    pack.templates[0].confirmed = confirmed;
    assert.ok(E.validatePack(pack).length > 0, "truthy non-booleans must not count as confirmation");
    assert.ok(E.validatePack(pack, true).length > 0, "draft restoration must preserve confirmation types");
  }
  const draft = agency("agency_a");
  draft.templates[0].confirmed = false;
  assert.deepEqual(E.validatePack(draft, true), []);
  assert.ok(E.validatePack(draft).length > 0);
  draft.templates[0].confirmed = true;
  assert.deepEqual(E.validatePack(draft), []);
});

test("administrator text changes do not replace the DOM on blur while structural changes rerender", async function () {
  const store = E.createStore(memoryStorage());
  const checkbox = { checked: true }, status = { textContent: "" };
  const browserWindow = {};
  const documentStub = {
    getElementById: function (id) {
      return id === "template-confirmed" ? checkbox : id === "draft-status" ? status : null;
    }
  };
  const source = fs.readFileSync(require.resolve("../docs/admin-ui.js"), "utf8");
  vm.runInNewContext(source, { window: browserWindow, document: documentStub });
  let renders = 0;
  const admin = browserWindow.SecureFlowAdmin({
    engine: E, store: store, esc: String, icon: function () { return ""; },
    toast: function () {}, onPublish: function () {}, render: function () { renders += 1; }
  });
  const draft = store.draft("agency_a"), template = draft.templates[0], field = template.fields[0], stage = draft.workflow[0];
  const textInputs = [
    { tagName: "INPUT", dataset: { adminField: field.id, prop: "label" }, value: "변경한 사업 항목명" },
    { tagName: "INPUT", dataset: { adminTemplate: "title" }, value: "변경한 양식 제목" },
    { tagName: "INPUT", dataset: { adminOrg: "name" }, value: "변경한 기관명" },
    { tagName: "INPUT", dataset: { adminStage: stage.id, prop: "title" }, value: "변경한 검토 단계" }
  ];
  for (const target of textInputs) {
    admin.input(target);
    await admin.change(target);
    assert.equal(renders, 0, "blur must not remove the target of the user's next click");
  }
  assert.equal(field.label, textInputs[0].value);
  assert.equal(template.title, textInputs[1].value);
  assert.equal(draft.name, textInputs[2].value);
  assert.equal(stage.title, textInputs[3].value);
  assert.equal(template.confirmed, false);
  assert.equal(checkbox.checked, false, "confirmation UI must be invalidated without a full rerender");
  assert.equal(status.textContent, "미게시 변경사항 있음");
  await admin.change({ tagName: "SELECT", dataset: { adminTemplate: "layout" }, value: "sections" });
  assert.equal(template.layout, "sections");
  assert.equal(renders, 1, "structural selection changes should still refresh their dependent UI");
});
