import type { Actor } from '@/features/auth';
import type { Role } from '@/lib/sharedTypes';
import type {
  Answer,
  AnswerInput,
  AuditEvent,
  BusinessCase,
  CreateCaseInput,
  DocumentType,
  RequestCommand,
  ReviewerPool,
  SecurityRequest,
} from './types';

export const DEMO_TIME = '2026-11-07T09:00:00Z';
export const DEMO_ACTORS: Record<Role, Actor> = {
  APPLICANT: {
    userId: 'demo-applicant',
    institutionId: 'demo-institution',
    username: 'preview-applicant',
    displayName: '신청자 가',
    role: 'APPLICANT',
  },
  INFRA: {
    userId: 'demo-infra',
    institutionId: 'demo-institution',
    username: 'preview-infra',
    displayName: '인프라 담당 가',
    role: 'INFRA',
  },
  SECURITY: {
    userId: 'demo-security',
    institutionId: 'demo-institution',
    username: 'preview-security',
    displayName: '보안 담당 가',
    role: 'SECURITY',
  },
  ADMIN: {
    userId: 'demo-admin',
    institutionId: 'demo-institution',
    username: 'preview-admin',
    displayName: '관리자 가',
    role: 'ADMIN',
  },
};
export interface DemoState {
  cases: BusinessCase[];
  requests: SecurityRequest[];
  auditEvents: AuditEvent[];
  sequence: number;
}
export const DEMO_POOLS: ReviewerPool[] = (['INFRA', 'SECURITY'] as const).map((field) => ({
  field,
  defaultReviewerId: DEMO_ACTORS[field].userId,
  reviewers: [
    DEMO_ACTORS[field],
    {
      userId: `demo-${field.toLowerCase()}-alternate`,
      displayName: `${field === 'INFRA' ? '인프라' : '보안'} 담당 나`,
      role: field,
    },
  ],
}));
const commonFields: [string, string, Role, string][] = [
  [
    'purpose',
    '사업 목적',
    'APPLICANT',
    '공개 자료를 한곳에서 검색하고 안내하는 합성 서비스입니다.',
  ],
  ['dataTypes', '처리하는 정보', 'APPLICANT', '공개 정책 자료와 합성 시험 데이터'],
  ['externalTransfer', '외부 전송 여부', 'APPLICANT', '공개 자료 조회 요청만 전송합니다.'],
  ['dataFlow', '자료의 흐름', 'APPLICANT', '이용자 → 합성 안내 서비스 → 공개 자료 API'],
  ['sourceSystem', '출발지 시스템', 'INFRA', '합성 안내 서버'],
  ['sourceIp', '출발지 IP', 'INFRA', '192.0.2.10'],
  ['destinationSystem', '목적지 시스템', 'INFRA', '합성 공개 API'],
  ['destinationIp', '목적지 IP', 'INFRA', '198.51.100.20'],
  ['protocol', '통신 방식', 'INFRA', 'TCP'],
  ['port', '목적지 포트', 'INFRA', '443'],
  ['period', '사용 기간', 'INFRA', '2026-11-11 ~ 2026-12-11'],
];

function makeAnswer(
  key: string,
  label: string,
  ownerRole: Role,
  value: string,
  scope: 'CASE' | 'REQUEST',
): Answer {
  return {
    key,
    label,
    scope,
    ownerRole,
    required: true,
    value,
    source: value ? (ownerRole === 'APPLICANT' ? 'USER_ANSWER' : 'STAFF_INPUT') : null,
    evidence: null,
    confirmed: Boolean(value),
    notApplicable: false,
    confirmation: value
      ? {
          actorId: DEMO_ACTORS[ownerRole].userId,
          actorName: DEMO_ACTORS[ownerRole].displayName,
          role: ownerRole,
          at: DEMO_TIME,
        }
      : null,
  };
}
function makeRequest(
  businessCase: BusinessCase,
  docType: DocumentType,
  suffix: string,
): SecurityRequest {
  const firewall = docType === 'FIREWALL';
  return {
    id: `demo-request-${suffix}`,
    caseId: businessCase.id,
    caseTitle: businessCase.title,
    docType,
    ownerId: businessCase.ownerId,
    ownerName: businessCase.ownerName,
    stage: 1,
    status: 'DRAFT',
    revision: 1,
    caseRevision: businessCase.revision,
    publicationVersion: 1,
    commonAnswers: structuredClone(businessCase.answers),
    answers: [
      makeAnswer(
        firewall ? 'connectionPurpose' : 'serviceScope',
        firewall ? '연결 목적' : '검토 대상 범위',
        'APPLICANT',
        firewall ? '합성 서비스의 공개 API 조회' : '합성 서비스의 구축·운영 범위',
        'REQUEST',
      ),
      makeAnswer(
        firewall ? 'accessControl' : 'securityControls',
        firewall ? '접근 통제 방안' : '보안 대책',
        'SECURITY',
        '',
        'REQUEST',
      ),
    ],
    reviews: (['INFRA', 'SECURITY'] as const).map((field) => ({
      id: `${suffix}-${field}`,
      field,
      status: 'PENDING',
      allocationCompleted: false,
      comment: null,
      completedBy: null,
      completedAt: null,
    })),
    assignments: [],
    supplements: [],
    returns: [],
    deadlines: [],
    submissions: [],
    finalConfirmations: [],
    currentSubmissionId: null,
    changedCommonFields: [],
    highlightedFields: [],
    blockers: [],
    allowedActions: [],
    createdAt: DEMO_TIME,
    updatedAt: DEMO_TIME,
  };
}
function assign(request: SecurityRequest) {
  request.assignments = (['INFRA', 'SECURITY'] as const).map((field) => ({
    id: `${request.id}-${field}`,
    field,
    assigneeId: DEMO_ACTORS[field].userId,
    assigneeName: DEMO_ACTORS[field].displayName,
    active: true,
    reason: '시연용 기본 담당자 배정',
    assignedAt: DEMO_TIME,
  }));
  request.deadlines.push({
    id: `${request.id}-deadline-${request.revision}`,
    field: null,
    kind: 'CONSULTATION',
    dueAt: '2026-11-11T09:00:00Z',
    active: true,
    closedAt: null,
    timing: 'WITHIN',
  });
}
function syncCases(state: DemoState) {
  for (const businessCase of state.cases)
    businessCase.requests = state.requests
      .filter((request) => request.caseId === businessCase.id)
      .map(({ id, caseId, caseTitle, docType, stage, status, revision, updatedAt }) => ({
        id,
        caseId,
        caseTitle,
        docType,
        stage,
        status,
        revision,
        updatedAt,
      }));
  return state;
}
/** 공개 시연에는 실제 기관·사람·내부 주소를 넣지 않고 문서용 예약 주소만 사용한다. */
export function createDemoState(): DemoState {
  const state: DemoState = { cases: [], requests: [], auditEvents: [], sequence: 10 };
  const titles = [
    '공공자료 안내 서비스 구축',
    '정책정보 API 연계',
    '교육지원 포털 개선',
    '공공기록 열람 서비스',
  ];
  titles.forEach((title, index) => {
    const businessCase: BusinessCase = {
      id: `demo-case-${index + 1}`,
      title,
      department: index === 2 ? '합성 교육지원팀' : '합성 디지털사업팀',
      description: '서비스 사용 흐름을 설명하기 위한 합성 사업입니다.',
      institutionId: 'demo-institution',
      ownerId: 'demo-applicant',
      ownerName: '신청자 가',
      revision: 1,
      publicationVersion: 1,
      answers: commonFields.map(([key, label, ownerRole, value]) =>
        makeAnswer(
          key,
          label,
          ownerRole,
          index === 0 && ownerRole === 'INFRA' ? '' : value,
          'CASE',
        ),
      ),
      requests: [],
      createdAt: DEMO_TIME,
      updatedAt: DEMO_TIME,
    };
    state.cases.push(businessCase);
    const request = makeRequest(
      businessCase,
      index === 2 ? 'SECURITY_REVIEW' : 'FIREWALL',
      String(index + 1),
    );
    if (index === 0) {
      request.stage = 2;
      request.status = 'CONSULTING';
      assign(request);
      state.requests.push(makeRequest(businessCase, 'SECURITY_REVIEW', '1-security'));
    }
    if (index === 1 || index === 2) {
      assign(request);
      request.stage = index === 1 ? 3 : 4;
      request.status = index === 1 ? 'FINAL_REVIEW' : 'SUBMITTED';
      request.reviews.forEach((review) => {
        review.status = 'COMPLETE';
        review.allocationCompleted = review.field === 'INFRA';
        review.comment = '합성 입력과 근거 확인';
        review.completedBy = DEMO_ACTORS[review.field].displayName;
        review.completedAt = DEMO_TIME;
      });
      request.answers[1] = makeAnswer(
        request.answers[1].key,
        request.answers[1].label,
        'SECURITY',
        '허용한 대상과 기간에 한하여 접근하고 처리 이력을 확인합니다.',
        'REQUEST',
      );
      if (index === 1) {
        request.answers[0] = {
          ...request.answers[0],
          value: '공개 정책 자료 조회에 한하여 암호화 통신을 사용합니다.',
          source: 'AI_INFERRED',
          confirmed: false,
          confirmation: null,
          evidence: '시연용 근거: 신청자가 작성한 사업 목적·연결 목적을 요약한 합성 문장',
        };
      } else {
        request.currentSubmissionId = 'demo-submission-1';
        request.submissions.push({
          id: 'demo-submission-1',
          number: 1,
          requestRevision: 1,
          caseRevision: 1,
          createdAt: DEMO_TIME,
        });
      }
    }
    if (index === 3) {
      request.highlightedFields = ['connectionPurpose'];
      request.returns = [
        {
          id: 'demo-return-1',
          fromStage: 2,
          targetStage: 1,
          fieldKeys: ['connectionPurpose'],
          reason: '공개 API를 사용하는 업무 목적을 한 문장 더 설명해 주세요.',
          actorName: '보안 담당 가',
          createdAt: DEMO_TIME,
        },
      ];
      assign(request);
    }
    state.requests.push(request);
    state.auditEvents.push({
      id: `demo-audit-${index}`,
      actorName: '신청자 가',
      actorRole: 'APPLICANT',
      targetType: 'SecurityRequest',
      targetId: request.id,
      targetRevision: 1,
      action: '신청 생성',
      reason: '합성 시연 자료',
      fieldKeys: [],
      requestId: `demo-trace-${index}`,
      createdAt: DEMO_TIME,
    });
  });
  return syncCases(state);
}
function terminal(request: SecurityRequest) {
  return ['FINALIZED', 'CLOSED', 'WITHDRAWN'].includes(request.status);
}
function assigned(request: SecurityRequest, actor: Actor) {
  return (
    request.assignments.some(
      (item) => item.active && item.field === actor.role && item.assigneeId === actor.userId,
    ) && request.ownerId !== actor.userId
  );
}
function submissionBlockers(request: SecurityRequest) {
  const blockers: string[] = [];
  if (request.reviews.some((review) => review.status !== 'COMPLETE'))
    blockers.push('두 분야의 담당자 협의를 모두 완료해 주세요.');
  if (
    [...request.commonAnswers, ...request.answers].some(
      (answer) =>
        answer.required && (!answer.value.trim() || !answer.confirmed) && !answer.notApplicable,
    )
  )
    blockers.push('필수 항목과 미확정 값을 사람이 확인해 주세요.');
  if (
    [...request.commonAnswers, ...request.answers].some(
      (answer) => answer.source === 'AI_INFERRED' && !answer.confirmed,
    )
  )
    blockers.push('AI 최종 초안은 미확정입니다. 내용을 확인해 주세요.');
  if (request.supplements.some((item) => item.status !== 'RESOLVED'))
    blockers.push('미해결 보완 요청을 먼저 처리해 주세요.');
  return blockers;
}
/** 시연 버튼만 역할별로 구성하며 실제 권한의 근거로 사용하지 않는다. */
export function demoRequestForActor(request: SecurityRequest, actor: Actor): SecurityRequest {
  const actions = ['DOWNLOAD'];
  if (terminal(request)) return { ...request, allowedActions: actions, blockers: [] };
  const owner = request.ownerId === actor.userId && actor.role === 'APPLICANT';
  const isAssigned = assigned(request, actor);
  const allocated = request.reviews.some(
    (review) => review.field === 'INFRA' && review.allocationCompleted,
  );
  if (actor.role === 'ADMIN') actions.push('REASSIGN');
  if (owner) {
    actions.push('WITHDRAW');
    if (request.stage < 4) actions.push('EDIT_CASE', 'EDIT_ANSWERS', 'ANSWER_SUPPLEMENT');
    if (request.stage === 1) actions.push('CONSULT');
    if (request.stage === 3) actions.push('SUBMIT', 'RETURN');
  }
  if (isAssigned) {
    if (request.stage < 4) actions.push('EDIT_CASE', 'EDIT_ANSWERS');
    if (request.stage === 3) {
      actions.push('CLOSE');
      if (actor.role === 'INFRA' || allocated)
        actions.push('REQUEST_SUPPLEMENT', 'RESOLVE_SUPPLEMENT');
    }
    if (request.stage === 2) {
      actions.push('RETURN', 'CLOSE');
      if (actor.role === 'INFRA' || allocated)
        actions.push(
          'EDIT_CASE',
          'EDIT_ANSWERS',
          'REQUEST_SUPPLEMENT',
          'RESOLVE_SUPPLEMENT',
          'COMPLETE_REVIEW',
        );
      if (actor.role === 'INFRA' && !allocated) actions.push('ALLOCATE');
    }
    if (request.stage === 4) {
      actions.push('RETURN', 'CLOSE');
      const confirmations = request.finalConfirmations.filter(
        (item) => item.submissionId === request.currentSubmissionId,
      );
      if (
        !confirmations.some((item) => item.field === actor.role) &&
        (actor.role === 'INFRA' || confirmations.some((item) => item.field === 'INFRA'))
      )
        actions.push('FINAL_CONFIRM');
      if (actor.role === 'SECURITY' && confirmations.length === 2) actions.push('FINALIZE');
    }
  }
  return {
    ...request,
    allowedActions: actions,
    blockers: request.stage === 3 ? submissionBlockers(request) : [],
  };
}
function requireCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function updateAnswers(current: Answer[], inputs: AnswerInput[], actor: Actor): Answer[] {
  const allowedKeys = new Set(current.map((answer) => answer.key));
  requireCondition(
    inputs.every((input) => allowedKeys.has(input.key)),
    '등록되지 않은 질문입니다.',
  );
  return current.map((answer) => {
    const input = inputs.find((item) => item.key === answer.key);
    if (!input) return answer;
    const staffConfirmation =
      ['INFRA', 'SECURITY'].includes(actor.role) &&
      answer.source === 'AI_INFERRED' &&
      input.value === answer.value &&
      input.confirmed;
    requireCondition(
      answer.ownerRole === actor.role || staffConfirmation,
      '이 항목은 표시된 담당 분야에서 작성합니다.',
    );
    requireCondition(
      !(input.confirmed || input.notApplicable) || Boolean(input.value.trim()),
      '확인 또는 해당 없음의 이유를 입력해 주세요.',
    );
    const preservesAi = answer.source === 'AI_INFERRED' && input.value === answer.value;
    return {
      ...answer,
      ...input,
      source: staffConfirmation
        ? 'STAFF_CONFIRMED'
        : preservesAi
          ? 'AI_INFERRED'
          : actor.role === 'APPLICANT'
            ? 'USER_ANSWER'
            : 'STAFF_INPUT',
      evidence: preservesAi ? answer.evidence : null,
      confirmation: input.confirmed
        ? { actorId: actor.userId, actorName: actor.displayName, role: actor.role, at: DEMO_TIME }
        : null,
    };
  });
}
/** 공통 답변 변경은 미제출 신청에만 반영하며 제출본의 값과 상태는 보존한다. */
export function saveDemoCase(
  state: DemoState,
  actor: Actor,
  caseId: string,
  expectedRevision: number,
  answers: AnswerInput[],
): DemoState {
  const next = structuredClone(state);
  const businessCase = next.cases.find((item) => item.id === caseId);
  requireCondition(businessCase !== undefined, '사업 건을 찾을 수 없습니다.');
  requireCondition(
    businessCase.revision === expectedRevision,
    '다른 변경이 먼저 저장되었습니다. 최신 내용을 확인해 주세요.',
  );
  requireCondition(
    (actor.role === 'APPLICANT' && businessCase.ownerId === actor.userId) ||
      next.requests.some(
        (item) =>
          item.caseId === caseId && item.stage < 4 && !terminal(item) && assigned(item, actor),
      ),
    '공통 정보를 편집할 권한이 없습니다.',
  );
  requireCondition(
    next.requests.some((item) => item.caseId === caseId && item.stage < 4 && !terminal(item)),
    '모든 신청이 제출되었거나 종료되어 공통 정보를 수정할 수 없습니다.',
  );
  const contentChanged = answers
    .filter((input) => {
      const previous = businessCase.answers.find((answer) => answer.key === input.key);
      return (
        previous &&
        (previous.value !== input.value || previous.notApplicable !== input.notApplicable)
      );
    })
    .map((input) => input.key);
  const allocationChanged = businessCase.answers.some(
    (answer) => answer.ownerRole === 'INFRA' && contentChanged.includes(answer.key),
  );
  businessCase.answers = updateAnswers(businessCase.answers, answers, actor);
  businessCase.revision += 1;
  for (const request of next.requests.filter(
    (item) => item.caseId === caseId && item.stage < 4 && !terminal(item),
  )) {
    request.commonAnswers = structuredClone(businessCase.answers);
    request.caseRevision = businessCase.revision;
    if (contentChanged.length) request.revision += 1;
    if (contentChanged.length && request.stage > 1) {
      request.changedCommonFields = [
        ...new Set([...request.changedCommonFields, ...contentChanged]),
      ];
      request.reviews.forEach((review) => {
        if (review.status === 'COMPLETE') review.status = 'RECHECK';
        if (allocationChanged && review.field === 'INFRA') review.allocationCompleted = false;
      });
    }
  }
  return syncCases(next);
}
/** 공개 미리보기의 상태 전이는 탭 메모리에서만 재현하고 서버 저장을 가장하지 않는다. */
export function applyDemoCommand(
  state: DemoState,
  actor: Actor,
  id: string,
  command: RequestCommand,
): DemoState {
  const next = structuredClone(state);
  const request = next.requests.find((item) => item.id === id);
  requireCondition(request !== undefined, '신청을 찾을 수 없습니다.');
  requireCondition(
    request.revision === command.body.expectedRevision,
    '다른 변경이 먼저 저장되었습니다. 최신 내용을 확인해 주세요.',
  );
  const { endpoint, body } = command;
  const action =
    endpoint === '/answers'
      ? 'EDIT_ANSWERS'
      : endpoint === '/consult'
        ? 'CONSULT'
        : endpoint === '/allocation'
          ? 'ALLOCATE'
          : endpoint === '/reviews/complete'
            ? 'COMPLETE_REVIEW'
            : endpoint === '/returns'
              ? 'RETURN'
              : endpoint === '/submit'
                ? 'SUBMIT'
                : endpoint === '/final-confirmations'
                  ? 'FINAL_CONFIRM'
                  : endpoint === '/finalize'
                    ? 'FINALIZE'
                    : endpoint === '/close'
                      ? 'CLOSE'
                      : endpoint === '/withdraw'
                        ? 'WITHDRAW'
                        : endpoint.startsWith('/assignments/')
                          ? 'REASSIGN'
                          : endpoint.endsWith('/answer')
                            ? 'ANSWER_SUPPLEMENT'
                            : endpoint.endsWith('/resolve')
                              ? 'RESOLVE_SUPPLEMENT'
                              : 'REQUEST_SUPPLEMENT';
  requireCondition(
    demoRequestForActor(request, actor).allowedActions.includes(action),
    '현재 단계 또는 담당 역할에서는 이 동작을 할 수 없습니다.',
  );
  if (['RETURN', 'CLOSE', 'WITHDRAW', 'REQUEST_SUPPLEMENT', 'REASSIGN'].includes(action))
    requireCondition(Boolean(body.reason?.trim()), '사유를 입력해 주세요.');
  if (action === 'EDIT_ANSWERS')
    request.answers = updateAnswers(request.answers, body.answers ?? [], actor);
  if (action === 'CONSULT') {
    requireCondition(
      [...request.commonAnswers, ...request.answers]
        .filter((item) => item.ownerRole === 'APPLICANT' && item.required)
        .every((item) => (item.value.trim() && item.confirmed) || item.notApplicable),
      '신청자가 작성하는 필수 항목을 먼저 확인해 주세요.',
    );
    request.stage = 2;
    request.status = 'CONSULTING';
    assign(request);
  }
  if (action === 'ALLOCATE') {
    requireCondition(
      request.commonAnswers
        .filter((item) => item.ownerRole === 'INFRA')
        .every((item) => (item.value.trim() && item.confirmed) || item.notApplicable),
      '할당 정보를 먼저 저장하고 확인해 주세요.',
    );
    const review = request.reviews.find((item) => item.field === 'INFRA');
    if (review) {
      review.allocationCompleted = true;
      review.status = 'ALLOCATED';
    }
  }
  if (action === 'COMPLETE_REVIEW') {
    requireCondition(Boolean(body.comment?.trim()), '검토 의견을 입력해 주세요.');
    requireCondition(
      request.reviews.some((item) => item.field === 'INFRA' && item.allocationCompleted),
      'ICT인프라의 할당 완료가 먼저 필요합니다.',
    );
    requireCondition(
      [...request.commonAnswers, ...request.answers]
        .filter((item) => item.ownerRole === actor.role && item.required)
        .every((item) => (item.value.trim() && item.confirmed) || item.notApplicable),
      '담당 분야의 필수 항목을 먼저 확인해 주세요.',
    );
    requireCondition(
      !request.supplements.some((item) => item.field === actor.role && item.status !== 'RESOLVED'),
      '담당 분야의 보완 요청을 먼저 해결해 주세요.',
    );
    const review = request.reviews.find((item) => item.field === actor.role);
    if (review) {
      review.status = 'COMPLETE';
      review.comment = body.comment ?? '';
      review.completedAt = DEMO_TIME;
      review.completedBy = actor.displayName;
    }
    if (request.reviews.every((item) => item.status === 'COMPLETE')) {
      request.stage = 3;
      request.status = 'FINAL_REVIEW';
      request.changedCommonFields = [];
      request.highlightedFields = [];
      request.deadlines
        .filter((item) => item.active && item.kind === 'CONSULTATION')
        .forEach((item) => {
          item.active = false;
          item.closedAt = DEMO_TIME;
          item.timing = 'CLOSED';
        });
    }
  }
  if (action === 'RETURN') {
    const target = body.targetStage;
    requireCondition(Boolean(body.fieldKeys?.length), '보완할 항목을 하나 이상 선택해 주세요.');
    requireCondition(
      (request.stage === 2 && target === 1) ||
        (request.stage === 3 && (target === 1 || target === 2)) ||
        (request.stage === 4 && target === 3),
      '허용되지 않은 차수 반환입니다.',
    );
    request.returns.push({
      id: `demo-return-${++next.sequence}`,
      fromStage: request.stage,
      targetStage: target!,
      fieldKeys: body.fieldKeys!,
      reason: body.reason!,
      actorName: actor.displayName,
      createdAt: DEMO_TIME,
    });
    request.stage = target as 1 | 2 | 3;
    request.status = target === 1 ? 'DRAFT' : target === 2 ? 'CONSULTING' : 'FINAL_REVIEW';
    request.highlightedFields = [...new Set([...request.highlightedFields, ...body.fieldKeys!])];
    request.currentSubmissionId = null;
    request.deadlines.forEach((item) => {
      item.active = false;
      item.closedAt = DEMO_TIME;
      item.timing = 'CLOSED';
    });
    if (target !== 3)
      request.reviews.forEach((review) => {
        if (review.status === 'COMPLETE') review.status = 'RECHECK';
      });
  }
  if (action === 'REQUEST_SUPPLEMENT') {
    requireCondition(Boolean(body.fieldKeys?.length), '보완할 항목을 선택해 주세요.');
    requireCondition(
      actor.role === 'INFRA' || actor.role === 'SECURITY',
      '담당 분야를 확인해 주세요.',
    );
    request.supplements.push({
      id: `demo-supplement-${++next.sequence}`,
      field: actor.role,
      fieldKeys: body.fieldKeys!,
      reason: body.reason!,
      answer: null,
      status: 'OPEN',
      requestedBy: actor.displayName,
      createdAt: DEMO_TIME,
      resolvedAt: null,
    });
    request.status = 'SUPPLEMENT_REQUESTED';
    request.highlightedFields = [...new Set([...request.highlightedFields, ...body.fieldKeys!])];
  }
  if (action === 'ANSWER_SUPPLEMENT' || action === 'RESOLVE_SUPPLEMENT') {
    const supplement = request.supplements.find((item) => endpoint.includes(`/${item.id}/`));
    requireCondition(supplement !== undefined, '보완 요청을 찾을 수 없습니다.');
    if (action === 'ANSWER_SUPPLEMENT') {
      requireCondition(Boolean(body.answer?.trim()), '보완 답변을 입력해 주세요.');
      supplement.answer = body.answer!;
      supplement.status = 'ANSWERED';
    } else {
      requireCondition(
        supplement.field === actor.role && supplement.status === 'ANSWERED',
        '답변을 받은 담당 분야에서 확인해 주세요.',
      );
      supplement.status = 'RESOLVED';
      supplement.resolvedAt = DEMO_TIME;
    }
    if (!request.supplements.some((item) => item.status === 'OPEN'))
      request.status = request.stage === 2 ? 'CONSULTING' : 'FINAL_REVIEW';
  }
  if (action === 'SUBMIT') {
    const blockers = submissionBlockers(request);
    requireCondition(blockers.length === 0, blockers.join(' '));
    const submission = {
      id: `demo-submission-${++next.sequence}`,
      number: request.submissions.length + 1,
      requestRevision: request.revision,
      caseRevision: request.caseRevision,
      createdAt: DEMO_TIME,
    };
    request.submissions.push(submission);
    request.currentSubmissionId = submission.id;
    request.stage = 4;
    request.status = 'SUBMITTED';
  }
  if (action === 'FINAL_CONFIRM') {
    requireCondition(
      actor.role === 'INFRA' || actor.role === 'SECURITY',
      '배정된 담당자만 확인할 수 있습니다.',
    );
    request.finalConfirmations.push({
      id: `demo-confirm-${++next.sequence}`,
      submissionId: request.currentSubmissionId!,
      field: actor.role,
      actorName: actor.displayName,
      confirmedAt: DEMO_TIME,
    });
  }
  if (action === 'FINALIZE') request.status = 'FINALIZED';
  if (action === 'CLOSE') request.status = 'CLOSED';
  if (action === 'WITHDRAW') request.status = 'WITHDRAWN';
  if (terminal(request))
    request.deadlines.forEach((item) => {
      item.active = false;
      item.closedAt = DEMO_TIME;
      item.timing = 'CLOSED';
    });
  if (action === 'REASSIGN') {
    const field = endpoint.endsWith('/INFRA') ? 'INFRA' : 'SECURITY';
    const reviewer = DEMO_POOLS.find((pool) => pool.field === field)?.reviewers.find(
      (item) => item.userId === body.assigneeId,
    );
    requireCondition(
      reviewer !== undefined && reviewer.userId !== request.ownerId,
      '유효한 다른 담당자를 선택해 주세요.',
    );
    request.assignments
      .filter((item) => item.field === field && item.active)
      .forEach((item) => {
        item.active = false;
      });
    request.assignments.push({
      id: `demo-assignment-${++next.sequence}`,
      field,
      assigneeId: reviewer.userId,
      assigneeName: reviewer.displayName,
      active: true,
      reason: body.reason!,
      assignedAt: DEMO_TIME,
    });
  }
  request.revision += 1;
  next.auditEvents.unshift({
    id: `demo-audit-${++next.sequence}`,
    actorName: actor.displayName,
    actorRole: actor.role,
    targetType: 'SecurityRequest',
    targetId: request.id,
    targetRevision: request.revision,
    action,
    reason: body.reason ?? null,
    fieldKeys: body.fieldKeys ?? [],
    requestId: `demo-trace-${next.sequence}`,
    createdAt: DEMO_TIME,
  });
  return syncCases(next);
}
/** 하나의 사업 건에서 서류 유형별 신청을 만들고 질문의 공통 범위는 한 번만 생성한다. */
export function createDemoCase(
  state: DemoState,
  actor: Actor,
  input: CreateCaseInput,
): { state: DemoState; id: string } {
  requireCondition(actor.role === 'APPLICANT', '일반 사용자 시연 역할에서 신청할 수 있습니다.');
  requireCondition(
    Boolean(input.title.trim()) && Boolean(input.department.trim()),
    '사업명과 부서를 입력해 주세요.',
  );
  requireCondition(
    input.docTypes.length > 0 && new Set(input.docTypes).size === input.docTypes.length,
    '서류 유형을 중복 없이 선택해 주세요.',
  );
  const next = structuredClone(state);
  const businessCase: BusinessCase = {
    id: `demo-case-${++next.sequence}`,
    ...input,
    institutionId: actor.institutionId,
    ownerId: actor.userId,
    ownerName: actor.displayName,
    revision: 1,
    publicationVersion: 1,
    answers: commonFields.map(([key, label, role]) => makeAnswer(key, label, role, '', 'CASE')),
    requests: [],
    createdAt: DEMO_TIME,
    updatedAt: DEMO_TIME,
  };
  next.cases.unshift(businessCase);
  for (const type of input.docTypes) {
    const request = makeRequest(businessCase, type, String(++next.sequence));
    request.answers.forEach((answer) => {
      answer.value = '';
      answer.confirmed = false;
      answer.source = null;
      answer.confirmation = null;
    });
    next.requests.unshift(request);
  }
  return { state: syncCases(next), id: businessCase.id };
}
