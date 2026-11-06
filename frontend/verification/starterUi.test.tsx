// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { activateDraftScope, clearDrafts } from '@/lib/draft';
import { EXAMPLE_MODEL_OPTION } from '@/features/llm';
import {
  AnswerEditor,
  CaseAnalysisPanel,
  RequestDetail,
  WorkspaceProvider,
  createDemoState,
  DEMO_ACTORS,
  type WorkspaceContextValue,
  type CaseAnalysis,
} from '@/features/request';

afterEach(() => {
  cleanup();
  clearDrafts();
});

test('AI 초안의 근거를 표시하고 사용자가 확인한 값만 저장 요청한다', async () => {
  const answer = createDemoState().requests.find((item) => item.id === 'demo-request-2')!
    .answers[0];
  const save = vi.fn(async () => undefined);
  const user = userEvent.setup();
  render(<AnswerEditor answers={[answer]} actorRole="APPLICANT" revision={7} save={save} />);
  expect(screen.getByText('· 미확정')).toBeTruthy();
  expect(screen.getByText(/시연용 근거:/)).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '입력 내용 저장' }).disabled).toBe(
    true,
  );
  await user.click(screen.getByRole('checkbox', { name: 'AI 제안을 읽고 내용 확인' }));
  await user.click(screen.getByRole('button', { name: '입력 내용 저장' }));
  expect(save).toHaveBeenCalledWith(7, [
    { key: answer.key, value: answer.value, confirmed: true, notApplicable: false },
  ]);
});

test('공통 질문을 편집하는 중 새 revision이 와도 미저장 입력을 덮어쓰지 않는다', async () => {
  const answer = createDemoState().cases[0].answers[0];
  const save = vi.fn(async () => undefined);
  const user = userEvent.setup();
  const { rerender } = render(
    <AnswerEditor answers={[answer]} actorRole="APPLICANT" revision={1} save={save} />,
  );
  const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: /사업 목적/ });
  await user.clear(input);
  await user.type(input, '아직 저장하지 않은 합성 설명');
  rerender(
    <AnswerEditor
      answers={[{ ...answer, value: '다른 사용자가 저장한 설명' }]}
      actorRole="APPLICANT"
      revision={2}
      save={save}
    />,
  );
  expect(input.value).toBe('아직 저장하지 않은 합성 설명');
  expect(screen.getByText(/다른 변경이 먼저 저장되었습니다/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '최신 값 불러오기' }));
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /사업 목적/ }).value).toBe(
    '다른 사용자가 저장한 설명',
  );
  expect(save).not.toHaveBeenCalled();
});

test('파일은 선택만으로 전송하지 않고 분석 후 적용 요청도 별도로 받는다', async () => {
  const state = createDemoState();
  const businessCase = state.cases[0];
  businessCase.answers[0].confirmed = false;
  businessCase.answers[0].confirmation = null;
  const result: CaseAnalysis = {
    id: 'analysis-one',
    caseId: businessCase.id,
    revision: businessCase.revision,
    status: 'SUCCEEDED',
    mode: 'EXAMPLE',
    provider: '합성',
    model: '예시',
    error: null,
    suggestions: [{ key: 'purpose', value: '합성 예시 목적', evidence: '합성 자료 직접 발췌' }],
    createdAt: '2026-11-07T09:00:00Z',
  };
  const analyse = vi.fn(async () => result);
  const applyAnalysis = vi.fn(async () => undefined);
  const value: WorkspaceContextValue = {
    mode: 'preview',
    actor: DEMO_ACTORS.APPLICANT,
    institutionName: '합성 기관',
    cases: state.cases,
    requests: state.requests,
    pools: [],
    modelOptions: [EXAMPLE_MODEL_OPTION],
    auditEvents: [],
    pending: false,
    error: undefined,
    loading: false,
    refresh: () => undefined,
    createCase: async () => '',
    saveCase: async () => undefined,
    command: async () => undefined,
    analyse,
    applyAnalysis,
  };
  render(
    <WorkspaceProvider value={value}>
      <CaseAnalysisPanel businessCase={businessCase} />
    </WorkspaceProvider>,
  );
  const user = userEvent.setup();
  const file = new File(['합성 사업 설명'], 'synthetic.md', { type: 'text/markdown' });
  await user.upload(screen.getByLabelText('분석할 합성 자료 선택'), file);
  expect(analyse).not.toHaveBeenCalled();
  expect(screen.getByText(/synthetic.md · 전송 대기/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '자료 분석 요청' }));
  await waitFor(() => expect(analyse).toHaveBeenCalledOnce());
  expect(applyAnalysis).not.toHaveBeenCalled();
  expect(screen.getByText('예시 추출 결과 · 실제 AI 호출 아님')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '초안에 미확정으로 반영' }));
  expect(applyAnalysis).toHaveBeenCalledWith(result, businessCase.revision);
});

test('담당자는 신청자 AI 제안의 값을 바꾸지 않고 확인할 수 있다', async () => {
  const answer = createDemoState().requests.find((item) => item.id === 'demo-request-2')!
    .answers[0];
  const save = vi.fn(async () => undefined);
  const user = userEvent.setup();
  render(<AnswerEditor answers={[answer]} actorRole="INFRA" revision={4} save={save} />);
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /연결 목적/ }).readOnly).toBe(
    true,
  );
  await user.click(screen.getByRole('checkbox', { name: 'AI 제안을 읽고 내용 확인' }));
  await user.click(screen.getByRole('button', { name: '입력 내용 저장' }));
  expect(save).toHaveBeenCalledWith(4, [
    { key: answer.key, value: answer.value, confirmed: true, notApplicable: false },
  ]);
});

test('재인증으로 폼이 다시 열려도 탭 메모리의 미저장 입력과 기준 revision을 복원한다', async () => {
  const answer = createDemoState().cases[0].answers[0];
  const memory = { scope: 'synthetic-institution:applicant', key: 'starter-case:synthetic' };
  activateDraftScope(memory.scope);
  const save = vi.fn(async () => undefined);
  const user = userEvent.setup();
  const view = render(
    <AnswerEditor
      answers={[answer]}
      actorRole="APPLICANT"
      revision={1}
      save={save}
      memory={memory}
    />,
  );
  await user.clear(screen.getByRole('textbox', { name: /사업 목적/ }));
  await user.type(screen.getByRole('textbox', { name: /사업 목적/ }), '복구할 합성 입력');
  view.unmount();
  render(
    <AnswerEditor
      answers={[{ ...answer, value: '서버에서 바뀐 값' }]}
      actorRole="APPLICANT"
      revision={2}
      save={save}
      memory={memory}
    />,
  );
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /사업 목적/ }).value).toBe(
    '복구할 합성 입력',
  );
  expect(screen.getByText(/다른 변경이 먼저 저장되었습니다/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '입력 내용 저장' }));
  expect(save).toHaveBeenCalledWith(1, [
    { key: answer.key, value: '복구할 합성 입력', confirmed: false, notApplicable: false },
  ]);
});

test('종료된 미제출 신청의 공통값 변경을 재작성 지시가 아닌 보존 안내로 표시한다', () => {
  const state = createDemoState();
  const request = state.requests.find((item) => item.id === 'demo-request-2')!;
  request.status = 'CLOSED';
  request.allowedActions = ['DOWNLOAD'];
  request.changedCommonFields = ['purpose'];
  const value: WorkspaceContextValue = {
    mode: 'preview',
    actor: DEMO_ACTORS.APPLICANT,
    institutionName: '합성 기관',
    cases: state.cases,
    requests: state.requests,
    pools: [],
    modelOptions: [EXAMPLE_MODEL_OPTION],
    auditEvents: [],
    pending: false,
    error: undefined,
    loading: false,
    refresh: () => undefined,
    createCase: async () => '',
    saveCase: async () => undefined,
    command: async () => undefined,
    analyse: async () => {
      throw new Error('이 테스트에서 분석하지 않습니다.');
    },
    applyAnalysis: async () => undefined,
  };
  render(
    <WorkspaceProvider value={value}>
      <RequestDetail request={request} />
    </WorkspaceProvider>,
  );
  expect(screen.getByText(/종료 당시 초안\(미제출\).*보존됩니다/)).toBeTruthy();
  expect(screen.getByText(/종결\(반려\) 당시 초안 · 미제출입니다/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '서류 제출' })).toBeNull();
  expect(screen.queryByRole('button', { name: '입력 내용 저장' })).toBeNull();
  expect(screen.queryByText('보완 필요')).toBeNull();
});

test('실서버 분석에서 선택한 모델 식별자를 요청에 포함한다', async () => {
  const state = createDemoState();
  const businessCase = state.cases[0];
  const analyse = vi.fn(async () => {
    throw new Error('합성 모델 연결 실패');
  });
  const value: WorkspaceContextValue = {
    mode: 'live',
    actor: DEMO_ACTORS.APPLICANT,
    institutionName: '합성 기관',
    cases: state.cases,
    requests: state.requests,
    pools: [],
    auditEvents: [],
    modelOptions: [
      EXAMPLE_MODEL_OPTION,
      {
        id: 'synthetic-configuration',
        purpose: 'INTERVIEW',
        provider: 'GEMMA',
        model: 'synthetic-gemma',
        mode: 'LIVE',
      },
    ],
    pending: false,
    loading: false,
    error: undefined,
    refresh: () => undefined,
    createCase: async () => '',
    saveCase: async () => undefined,
    command: async () => undefined,
    analyse,
    applyAnalysis: async () => undefined,
  };
  render(
    <WorkspaceProvider value={value}>
      <CaseAnalysisPanel businessCase={businessCase} />
    </WorkspaceProvider>,
  );
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('분석 모델'), 'synthetic-configuration');
  await user.type(
    screen.getByRole('textbox', { name: /자료 없이 설명으로 시작/ }),
    '합성 서비스 설명',
  );
  await user.click(screen.getByRole('button', { name: '자료 분석 요청' }));
  expect(analyse).toHaveBeenCalledWith({
    caseId: businessCase.id,
    expectedRevision: businessCase.revision,
    text: '합성 서비스 설명',
    file: undefined,
    configurationId: 'synthetic-configuration',
  });
  expect(screen.getByRole('alert').textContent).toContain('합성 모델 연결 실패');
  expect(screen.queryByText('예시 추출 결과 · 실제 AI 호출 아님')).toBeNull();
  expect(screen.queryByRole('button', { name: '초안에 미확정으로 반영' })).toBeNull();
});

test('모델 목록 조회 실패 시 임의의 예시 모델로 바꾸어 분석하지 않는다', async () => {
  const state = createDemoState();
  const analyse = vi.fn();
  const value: WorkspaceContextValue = {
    mode: 'live',
    actor: DEMO_ACTORS.APPLICANT,
    institutionName: '합성 기관',
    cases: state.cases,
    requests: state.requests,
    pools: [],
    auditEvents: [],
    modelOptions: [],
    modelsError: new Error('모델 목록 조회 실패'),
    pending: false,
    loading: false,
    error: undefined,
    refresh: () => undefined,
    createCase: async () => '',
    saveCase: async () => undefined,
    command: async () => undefined,
    analyse,
    applyAnalysis: async () => undefined,
  };
  render(
    <WorkspaceProvider value={value}>
      <CaseAnalysisPanel businessCase={state.cases[0]} />
    </WorkspaceProvider>,
  );
  const user = userEvent.setup();
  await user.type(
    screen.getByRole('textbox', { name: /자료 없이 설명으로 시작/ }),
    '합성 서비스 설명',
  );
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '자료 분석 요청' }).disabled).toBe(
    true,
  );
  expect(screen.getByRole('alert').textContent).toContain('모델 목록 조회 실패');
  expect(analyse).not.toHaveBeenCalled();
});

test('새 분석이 실패하면 이전 후보의 적용 버튼을 남기지 않는다', async () => {
  const state = createDemoState();
  state.cases[0].answers[0].confirmed = false;
  state.cases[0].answers[0].confirmation = null;
  const businessCase = state.cases[0];
  const result: CaseAnalysis = {
    id: 'synthetic-analysis',
    caseId: businessCase.id,
    revision: businessCase.revision,
    status: 'SUCCEEDED',
    mode: 'EXAMPLE',
    provider: 'EXAMPLE',
    model: 'labelled-lines-v1',
    error: null,
    suggestions: [
      { key: 'purpose', value: '이전 합성 목적', evidence: '이전 합성 자료 직접 발췌' },
    ],
    createdAt: '2026-11-07T09:00:00Z',
  };
  const analyse = vi
    .fn<WorkspaceContextValue['analyse']>()
    .mockResolvedValueOnce(result)
    .mockRejectedValueOnce(new Error('두 번째 분석 실패'));
  const value: WorkspaceContextValue = {
    mode: 'preview',
    actor: DEMO_ACTORS.APPLICANT,
    institutionName: '합성 기관',
    cases: state.cases,
    requests: state.requests,
    pools: [],
    auditEvents: [],
    modelOptions: [EXAMPLE_MODEL_OPTION],
    pending: false,
    loading: false,
    error: undefined,
    refresh: () => undefined,
    createCase: async () => '',
    saveCase: async () => undefined,
    command: async () => undefined,
    analyse,
    applyAnalysis: async () => undefined,
  };
  render(
    <WorkspaceProvider value={value}>
      <CaseAnalysisPanel businessCase={businessCase} />
    </WorkspaceProvider>,
  );
  const user = userEvent.setup();
  await user.type(
    screen.getByRole('textbox', { name: /자료 없이 설명으로 시작/ }),
    '합성 서비스 설명',
  );
  await user.click(screen.getByRole('button', { name: '자료 분석 요청' }));
  expect(screen.getByRole('button', { name: '초안에 미확정으로 반영' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '자료 분석 요청' }));
  expect(screen.getByRole('alert').textContent).toContain('두 번째 분석 실패');
  expect(screen.queryByRole('button', { name: '초안에 미확정으로 반영' })).toBeNull();
  expect(screen.queryByText('이전 합성 목적')).toBeNull();
});
