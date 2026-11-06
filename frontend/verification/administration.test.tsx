// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberRoleForm, type Member } from '@/features/auth';
import { LlmConfigurationForm } from '@/features/llm';
import { ApiError } from '@/lib/http';

const member: Member = {
  id: 'synthetic-member',
  username: 'synthetic.member',
  displayName: '합성 회원',
  department: '합성 사업팀',
  role: 'APPLICANT',
  active: true,
  revision: 7,
};
afterEach(cleanup);

test('회원 역할 변경은 사유가 없거나 기존 역할과 같으면 전송하지 않는다', async () => {
  const save = vi.fn(async () => undefined);
  render(<MemberRoleForm member={member} pending={false} save={save} cancel={() => undefined} />);
  const user = userEvent.setup();
  const submit = screen.getByRole<HTMLButtonElement>('button', { name: '역할 변경' });
  expect(submit.disabled).toBe(true);
  await user.selectOptions(screen.getByLabelText(/변경할 역할/), 'INFRA');
  expect(submit.disabled).toBe(true);
  await user.type(screen.getByLabelText(/변경 사유/), '   ');
  expect(submit.disabled).toBe(true);
  await user.click(submit);
  expect(save).not.toHaveBeenCalled();
});

test('역할 변경은 회원 식별자·기준 수정본·역할·사유를 전달하고 서버 성공을 표시한다', async () => {
  const save = vi.fn(async () => undefined);
  render(<MemberRoleForm member={member} pending={false} save={save} cancel={() => undefined} />);
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText(/변경할 역할/), 'SECURITY');
  await user.type(screen.getByLabelText(/변경 사유/), '합성 보안 담당자 지정');
  await user.click(screen.getByRole('button', { name: '역할 변경' }));
  expect(save).toHaveBeenCalledWith({
    id: member.id,
    expectedRevision: 7,
    role: 'SECURITY',
    reason: '합성 보안 담당자 지정',
  });
  expect(screen.getByRole('status').textContent).toContain('서버에서 역할 변경을 완료했습니다');
});

test('역할 수정본 충돌은 현재 입력을 보존하고 성공으로 바꾸지 않는다', async () => {
  const save = vi.fn(async () => {
    throw new ApiError(409, '최신 역할은 v8입니다.', 'REVISION_CONFLICT', 'synthetic-trace', 8);
  });
  render(<MemberRoleForm member={member} pending={false} save={save} cancel={() => undefined} />);
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText(/변경할 역할/), 'INFRA');
  await user.type(screen.getByLabelText(/변경 사유/), '합성 인프라 담당자 지정');
  await user.click(screen.getByRole('button', { name: '역할 변경' }));
  expect(screen.getByRole('alert').textContent).toContain('다른 변경이 먼저 저장되었습니다');
  expect(screen.getByRole('alert').textContent).toContain('synthetic-trace');
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /변경 사유/ }).value).toBe(
    '합성 인프라 담당자 지정',
  );
  expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('INFRA');
  expect(screen.queryByRole('status')).toBeNull();
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 7 }));
});

test('모델 공급자를 바꾸면 비밀값 대신 해당 환경변수 참조를 사용한다', async () => {
  const register = vi.fn(async () => undefined);
  render(<LlmConfigurationForm pending={false} register={register} />);
  const user = userEvent.setup();
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: '환경변수 키 참조' }).value).toBe(
    'SA_OPENAI_API_KEY',
  );
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: '환경변수 키 참조' }).readOnly).toBe(
    true,
  );
  await user.selectOptions(screen.getByRole('combobox', { name: /공급자/ }), 'GEMMA');
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: '환경변수 키 참조' }).value).toBe(
    'SA_GEMMA_API_KEY',
  );
  expect(screen.queryByLabelText('API 키')).toBeNull();
  expect(register).not.toHaveBeenCalled();
});

test('모델 연결 등록은 용도와 사유를 포함하며 저장을 실제 AI 실행으로 표시하지 않는다', async () => {
  const register = vi.fn(async () => undefined);
  render(<LlmConfigurationForm pending={false} register={register} />);
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: /모델명/ }), 'synthetic-model');
  await user.type(
    screen.getByRole('textbox', { name: /연결 주소/ }),
    'https://example.invalid/v1/chat/completions',
  );
  await user.selectOptions(screen.getByRole('combobox', { name: /용도/ }), 'SUMMARY');
  await user.type(screen.getByRole('textbox', { name: /등록 사유/ }), '합성 모델 연결 테스트');
  await user.click(screen.getByRole('button', { name: '모델 연결 등록' }));
  expect(register).toHaveBeenCalledWith({
    connection: {
      provider: 'OPENAI',
      endpoint: 'https://example.invalid/v1/chat/completions',
      model: 'synthetic-model',
      keyReference: 'SA_OPENAI_API_KEY',
      temperature: 0.2,
      maxTokens: 2048,
      timeoutSeconds: 30,
    },
    purpose: 'SUMMARY',
    reason: '합성 모델 연결 테스트',
  });
  expect(screen.getByRole('status').textContent).toContain('서버에 모델 연결을 등록했습니다');
  expect(screen.getByText('구성 저장은 실제 모델 호출 성공을 의미하지 않습니다.')).toBeTruthy();
});

test('허용되지 않은 모델 구성의 서버 거절은 입력과 사유를 유지한다', async () => {
  const register = vi.fn(async () => {
    throw new ApiError(422, '서버 허용 목록에 없는 구성입니다.', 'INVALID_CONFIGURATION');
  });
  render(<LlmConfigurationForm pending={false} register={register} />);
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: /모델명/ }), 'synthetic-model');
  await user.type(
    screen.getByRole('textbox', { name: /연결 주소/ }),
    'https://example.invalid/v1/chat/completions',
  );
  await user.type(screen.getByRole('textbox', { name: /등록 사유/ }), '합성 구성 등록');
  await user.click(screen.getByRole('button', { name: '모델 연결 등록' }));
  expect(screen.getByRole('alert').textContent).toContain('서버 허용 목록에 없는 구성입니다');
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: /모델명/ }).value).toBe(
    'synthetic-model',
  );
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /등록 사유/ }).value).toBe(
    '합성 구성 등록',
  );
  expect(screen.queryByRole('status')).toBeNull();
});
