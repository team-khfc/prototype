'use client';

import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activateDraftScope, clearDrafts } from '@/lib/draft';
import { invalidateIdentity, requestJson, resetCsrf } from '@/lib/http';
import { sessionSchema } from './types';

/** 인증 성공 뒤 이전 계정의 요청·캐시를 폐기하고 서버 세션으로만 신원을 세운다. */
export function useLoginMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { username: string; password: string }) => {
      resetCsrf();
      return requestJson('/auth/login', sessionSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(input),
      });
    },
    onSuccess: async (session) => {
      invalidateIdentity();
      await client.cancelQueries();
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      activateDraftScope(`${session.user.institutionId}:${session.user.userId}`);
      client.setQueryData(['session'], session);
    },
  });
}
/** 브라우저 타이머를 늘리지 않고 서버가 확정한 만료 시각을 다시 받는다. */
export function useExtendSessionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => requestJson('/auth/extend', sessionSchema, { method: 'POST' }),
    onSuccess: (session) => client.setQueryData(['session'], session),
  });
}
/** 서버 로그아웃에 성공한 뒤에만 사용자 캐시와 탭 메모리의 임시 입력을 지운다. */
export function useLogoutMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => requestJson('/auth/logout', z.undefined(), { method: 'POST' }),
    onSuccess: () => {
      invalidateIdentity();
      clearDrafts();
      client.clear();
    },
  });
}
