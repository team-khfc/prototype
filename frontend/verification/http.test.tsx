import assert from 'node:assert/strict';
import { test } from 'vitest';
import { z } from 'zod';
import { ApiError, invalidateIdentity, requestJson } from '../lib/http';
import { activateDraftScope, clearDrafts, readDraft, writeDraft } from '../lib/draft';

test('변경 요청은 서버가 발급한 CSRF 헤더를 포함한다', async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  invalidateIdentity();
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify(
        String(input).endsWith('/auth/csrf')
          ? { token: 'synthetic-csrf-token', headerName: 'X-CSRF-TOKEN' }
          : { saved: true },
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  try {
    const response = await requestJson('/security-requests', z.object({ saved: z.boolean() }), {
      method: 'POST',
      body: JSON.stringify({ title: '합성 신청' }),
    });
    assert.equal(response.saved, true);
    assert.equal(calls[0].url, '/api/auth/csrf');
    assert.equal(calls[1].url, '/api/security-requests');
    assert.equal(new Headers(calls[1].init?.headers).get('X-CSRF-TOKEN'), 'synthetic-csrf-token');
    assert.equal(calls[1].init?.credentials, 'same-origin');
    assert.equal(calls[1].init?.cache, 'no-store');
  } finally {
    globalThis.fetch = original;
    invalidateIdentity();
  }
});

test('계정 변경 이전에 시작한 응답은 뒤늦게 도착해도 폐기한다', async () => {
  const original = globalThis.fetch;
  let complete: ((response: Response) => void) | undefined;
  invalidateIdentity();
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      complete = resolve;
    });
  try {
    const pending = requestJson('/security-requests', z.array(z.string()));
    invalidateIdentity();
    assert.ok(complete);
    complete(new Response(JSON.stringify(['previous user value'])));
    await assert.rejects(
      pending,
      (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
    );
  } finally {
    globalThis.fetch = original;
    invalidateIdentity();
  }
});

test('충돌 오류에는 최신 수정본과 문의 식별자가 보존된다', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        detail: '최신 수정본을 확인해 주세요.',
        code: 'REVISION_CONFLICT',
        requestId: 'synthetic-request',
        latestRevision: 9,
      }),
      { status: 409 },
    );
  try {
    await assert.rejects(
      requestJson('/security-requests/example', z.object({})),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 409 &&
        error.latestRevision === 9 &&
        error.requestId === 'synthetic-request',
    );
  } finally {
    globalThis.fetch = original;
    invalidateIdentity();
  }
});

test('계약과 다른 서버 응답은 성공으로 수용하지 않는다', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ saved: 'not a boolean' }));
  try {
    await assert.rejects(
      requestJson('/example', z.object({ saved: z.boolean() })),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_RESPONSE',
    );
  } finally {
    globalThis.fetch = original;
    invalidateIdentity();
  }
});

test('같은 계정 재인증에서는 초안을 유지하고 다른 신원에서는 지운다', () => {
  clearDrafts();
  activateDraftScope('tenant-a:user-a');
  writeDraft('tenant-a:user-a', 'answer', { value: '저장 전 합성 입력', revision: 2 });
  activateDraftScope('tenant-a:user-a');
  assert.deepEqual(readDraft('tenant-a:user-a', 'answer', null), {
    value: '저장 전 합성 입력',
    revision: 2,
  });
  activateDraftScope('tenant-b:user-b');
  assert.equal(readDraft('tenant-a:user-a', 'answer', null), null);
  clearDrafts();
});

test('CSRF 조회 중 계정이 바뀌면 이전 계정의 변경 요청을 전송하지 않는다', async () => {
  const original = globalThis.fetch;
  let complete: ((response: Response) => void) | undefined;
  const urls: string[] = [];
  invalidateIdentity();
  globalThis.fetch = (input) => {
    urls.push(String(input));
    return new Promise<Response>((resolve) => {
      complete = resolve;
    });
  };
  try {
    const pending = requestJson('/security-requests/example/submit', z.object({}), {
      method: 'POST',
      body: '{}',
    });
    invalidateIdentity();
    assert.ok(complete);
    complete(
      new Response(JSON.stringify({ token: 'synthetic-token', headerName: 'X-CSRF-TOKEN' })),
    );
    await assert.rejects(
      pending,
      (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
    );
    assert.deepEqual(urls, ['/api/auth/csrf']);
  } finally {
    globalThis.fetch = original;
    invalidateIdentity();
  }
});

test('응답 본문을 읽는 중 신원이 바뀌면 이전 사용자 데이터를 반환하지 않는다', async () => {
  const original = globalThis.fetch;
  let complete: ((data: unknown) => void) | undefined;
  invalidateIdentity();
  globalThis.fetch = async () => {
    const response = new Response('{}');
    response.json = () =>
      new Promise<unknown>((resolve) => {
        complete = resolve;
      });
    return response;
  };
  try {
    const pending = requestJson('/business-cases', z.array(z.string()));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.ok(complete);
    invalidateIdentity();
    complete(['이전 사용자 자료']);
    await assert.rejects(
      pending,
      (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
    );
  } finally {
    globalThis.fetch = original;
    invalidateIdentity();
  }
});
