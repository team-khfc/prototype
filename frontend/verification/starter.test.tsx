import { expect, test } from 'vitest';
import {
  applyDemoCommand,
  createDemoCase,
  createDemoState,
  demoRequestForActor,
  saveDemoCase,
  DEMO_ACTORS,
  businessCaseSchema,
  securityRequestSchema,
  type DemoState,
} from '@/features/request';
import { validateSignupPassword } from '@/features/auth';

function request(state: DemoState, id = 'demo-request-1') {
  const found = state.requests.find((item) => item.id === id);
  if (!found) throw new Error('테스트 신청 누락');
  return found;
}

test('새 시연 자료는 사업 건·신청 API 계약과 네 종류 출처를 충족한다', () => {
  const state = createDemoState();
  state.cases.forEach((item) => expect(businessCaseSchema.safeParse(item).success).toBe(true));
  state.requests.forEach((item) =>
    expect(securityRequestSchema.safeParse(item).success).toBe(true),
  );
  expect(state.cases[0].requests).toHaveLength(2);
  expect(state.cases[0].answers.filter((item) => item.key === 'purpose')).toHaveLength(1);
});

test('한 사업에 두 서류를 만들고 유형 중복은 거부한다', () => {
  const state = createDemoState();
  const input = {
    title: '합성 신규 사업',
    department: '합성 업무팀',
    description: '',
    docTypes: ['FIREWALL', 'SECURITY_REVIEW'] as const,
  };
  const created = createDemoCase(state, DEMO_ACTORS.APPLICANT, {
    ...input,
    docTypes: [...input.docTypes],
  });
  expect(created.state.requests.filter((item) => item.caseId === created.id)).toHaveLength(2);
  expect(() =>
    createDemoCase(state, DEMO_ACTORS.APPLICANT, { ...input, docTypes: ['FIREWALL', 'FIREWALL'] }),
  ).toThrow('중복');
  expect(state.cases).toHaveLength(4);
});

test('반환은 사유와 항목을 요구하고 값과 형제 신청 상태를 보존한다', () => {
  const state = createDemoState();
  const original = request(state);
  const sibling = request(state, 'demo-request-1-security');
  expect(() =>
    applyDemoCommand(state, DEMO_ACTORS.INFRA, original.id, {
      endpoint: '/returns',
      body: { expectedRevision: 1, targetStage: 1, fieldKeys: ['purpose'], reason: '' },
    }),
  ).toThrow('사유');
  const next = applyDemoCommand(state, DEMO_ACTORS.INFRA, original.id, {
    endpoint: '/returns',
    body: { expectedRevision: 1, targetStage: 1, fieldKeys: ['purpose'], reason: '합성 목적 보완' },
  });
  expect(request(next).stage).toBe(1);
  expect(request(next).commonAnswers).toEqual(original.commonAnswers);
  expect(request(next).highlightedFields).toEqual(['purpose']);
  expect(request(next, sibling.id)).toEqual(sibling);
  expect(request(next).deadlines.every((item) => !item.active)).toBe(true);
});

test('정보보안은 할당 전에 검토를 마칠 수 없으며 할당만으로 협의가 완료되지 않는다', () => {
  let state = createDemoState();
  expect(() =>
    applyDemoCommand(state, DEMO_ACTORS.SECURITY, 'demo-request-1', {
      endpoint: '/reviews/complete',
      body: { expectedRevision: 1 },
    }),
  ).toThrow();
  const source = state.cases[1].answers.filter((item) => item.ownerRole === 'INFRA');
  state = saveDemoCase(
    state,
    DEMO_ACTORS.INFRA,
    'demo-case-1',
    1,
    source.map((item) => ({
      key: item.key,
      value: item.value,
      confirmed: true,
      notApplicable: false,
    })),
  );
  state = applyDemoCommand(state, DEMO_ACTORS.INFRA, 'demo-request-1', {
    endpoint: '/allocation',
    body: { expectedRevision: request(state).revision },
  });
  expect(request(state).stage).toBe(2);
  expect(request(state).reviews.find((item) => item.field === 'INFRA')?.status).toBe('ALLOCATED');
  expect(request(state).reviews.every((item) => item.status === 'COMPLETE')).toBe(false);
  expect(demoRequestForActor(request(state), DEMO_ACTORS.SECURITY).allowedActions).toContain(
    'COMPLETE_REVIEW',
  );
});

test('공통 정보 변경은 미제출 신청만 갱신하고 제출된 다른 서류를 보존한다', () => {
  const state = createDemoState();
  const sibling = request(state, 'demo-request-1-security');
  sibling.stage = 4;
  sibling.status = 'SUBMITTED';
  const frozen = structuredClone(sibling);
  const next = saveDemoCase(state, DEMO_ACTORS.APPLICANT, 'demo-case-1', 1, [
    { key: 'purpose', value: '변경한 합성 목적', confirmed: true, notApplicable: false },
  ]);
  expect(request(next).commonAnswers.find((item) => item.key === 'purpose')?.value).toBe(
    '변경한 합성 목적',
  );
  expect(request(next).changedCommonFields).toContain('purpose');
  expect(request(next, sibling.id)).toEqual(frozen);
});

test('AI 최종 초안은 사람 확인 전 제출을 차단하고 확인 후에도 출처를 보존한다', () => {
  let state = createDemoState();
  const original = request(state, 'demo-request-2');
  expect(() =>
    applyDemoCommand(state, DEMO_ACTORS.APPLICANT, original.id, {
      endpoint: '/submit',
      body: { expectedRevision: original.revision },
    }),
  ).toThrow('미확정');
  const answer = original.answers[0];
  state = applyDemoCommand(state, DEMO_ACTORS.APPLICANT, original.id, {
    endpoint: '/answers',
    method: 'PATCH',
    body: {
      expectedRevision: original.revision,
      answers: [{ key: answer.key, value: answer.value, confirmed: true, notApplicable: false }],
    },
  });
  expect(request(state, original.id).answers[0].source).toBe('AI_INFERRED');
  expect(request(state, original.id).answers[0].confirmation?.role).toBe('APPLICANT');
  state = applyDemoCommand(state, DEMO_ACTORS.APPLICANT, original.id, {
    endpoint: '/submit',
    body: { expectedRevision: request(state, original.id).revision },
  });
  expect(request(state, original.id).status).toBe('SUBMITTED');
  expect(request(state, original.id).submissions).toHaveLength(1);
});

test('같은 제출본에서 INFRA 다음 SECURITY가 확인하고 SECURITY만 확정한다', () => {
  let state = createDemoState();
  const id = 'demo-request-3';
  expect(() =>
    applyDemoCommand(state, DEMO_ACTORS.SECURITY, id, {
      endpoint: '/final-confirmations',
      body: { expectedRevision: request(state, id).revision },
    }),
  ).toThrow();
  state = applyDemoCommand(state, DEMO_ACTORS.INFRA, id, {
    endpoint: '/final-confirmations',
    body: { expectedRevision: request(state, id).revision },
  });
  state = applyDemoCommand(state, DEMO_ACTORS.SECURITY, id, {
    endpoint: '/final-confirmations',
    body: { expectedRevision: request(state, id).revision },
  });
  expect(() =>
    applyDemoCommand(state, DEMO_ACTORS.INFRA, id, {
      endpoint: '/finalize',
      body: { expectedRevision: request(state, id).revision },
    }),
  ).toThrow();
  state = applyDemoCommand(state, DEMO_ACTORS.SECURITY, id, {
    endpoint: '/finalize',
    body: { expectedRevision: request(state, id).revision },
  });
  expect(request(state, id).status).toBe('FINALIZED');
  expect(demoRequestForActor(request(state, id), DEMO_ACTORS.SECURITY).allowedActions).toEqual([
    'DOWNLOAD',
  ]);
});

test('새 제출본에는 이전 제출본의 확인 기록을 재사용하지 않는다', () => {
  let state = createDemoState();
  const id = 'demo-request-3';
  state = applyDemoCommand(state, DEMO_ACTORS.INFRA, id, {
    endpoint: '/final-confirmations',
    body: { expectedRevision: 1 },
  });
  state = applyDemoCommand(state, DEMO_ACTORS.SECURITY, id, {
    endpoint: '/returns',
    body: {
      expectedRevision: request(state, id).revision,
      targetStage: 3,
      fieldKeys: ['serviceScope'],
      reason: '합성 제출본 재확인',
    },
  });
  state = applyDemoCommand(state, DEMO_ACTORS.APPLICANT, id, {
    endpoint: '/submit',
    body: { expectedRevision: request(state, id).revision },
  });
  expect(request(state, id).submissions).toHaveLength(2);
  expect(
    demoRequestForActor(request(state, id), DEMO_ACTORS.SECURITY).allowedActions,
  ).not.toContain('FINAL_CONFIRM');
  expect(demoRequestForActor(request(state, id), DEMO_ACTORS.INFRA).allowedActions).toContain(
    'FINAL_CONFIRM',
  );
});

test('재배정 후 이전 담당자는 해당 신청을 검토할 수 없고 배정 이력은 남는다', () => {
  const state = createDemoState();
  const next = applyDemoCommand(state, DEMO_ACTORS.ADMIN, 'demo-request-1', {
    endpoint: '/assignments/INFRA',
    method: 'PATCH',
    body: { expectedRevision: 1, assigneeId: 'demo-infra-alternate', reason: '합성 휴가 대체' },
  });
  expect(demoRequestForActor(request(next), DEMO_ACTORS.INFRA).allowedActions).not.toContain(
    'ALLOCATE',
  );
  expect(request(next).assignments.filter((item) => item.field === 'INFRA')).toHaveLength(2);
  expect(
    request(next).assignments.filter((item) => item.field === 'INFRA' && item.active),
  ).toHaveLength(1);
});

test('낡은 수정본으로 저장하면 기존 작성 내용을 유지한 채 거절한다', () => {
  const state = createDemoState();
  const before = structuredClone(state);
  expect(() =>
    applyDemoCommand(state, DEMO_ACTORS.INFRA, 'demo-request-1', {
      endpoint: '/allocation',
      body: { expectedRevision: 0 },
    }),
  ).toThrow('다른 변경');
  expect(state).toEqual(before);
});

test('가입 비밀번호는 문자 종류와 bcrypt 바이트 한도를 검사한다', () => {
  expect(validateSignupPassword('A-safe-example-2048')).toBeNull();
  expect(validateSignupPassword('onlylowercase1234')).toContain('대문자');
  expect(validateSignupPassword(`Aa1234567890${'가'.repeat(24)}`)).toContain('72바이트');
});

test('AI 값의 사람 확인만 바뀌면 완료된 협의를 무효화하지 않는다', () => {
  const state = createDemoState();
  const businessCase = state.cases.find((item) => item.id === 'demo-case-2')!;
  const value = businessCase.answers[0];
  value.source = 'AI_INFERRED';
  value.confirmed = false;
  value.confirmation = null;
  value.evidence = '합성 설명 근거';
  request(state, 'demo-request-2').commonAnswers = structuredClone(businessCase.answers);
  const next = saveDemoCase(state, DEMO_ACTORS.APPLICANT, businessCase.id, businessCase.revision, [
    { key: value.key, value: value.value, confirmed: true, notApplicable: false },
  ]);
  expect(
    request(next, 'demo-request-2').reviews.every((review) => review.status === 'COMPLETE'),
  ).toBe(true);
  expect(request(next, 'demo-request-2').changedCommonFields).toEqual([]);
  expect(request(next, 'demo-request-2').commonAnswers[0].source).toBe('AI_INFERRED');
});

test('배정 담당자의 AI 값 확인은 담당자 확인 출처와 원래 근거를 남긴다', () => {
  const state = createDemoState();
  const value = state.cases[0].answers[0];
  value.source = 'AI_INFERRED';
  value.confirmed = false;
  value.confirmation = null;
  value.evidence = '합성 자료 발췌';
  const next = saveDemoCase(state, DEMO_ACTORS.INFRA, state.cases[0].id, 1, [
    { key: value.key, value: value.value, confirmed: true, notApplicable: false },
  ]);
  expect(next.cases[0].answers[0].source).toBe('STAFF_CONFIRMED');
  expect(next.cases[0].answers[0].evidence).toBe('합성 자료 발췌');
  expect(next.cases[0].answers[0].ownerRole).toBe('APPLICANT');
});
