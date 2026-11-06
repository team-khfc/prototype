'use client';

import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '@/lib/http';
import { useSession } from './Authentication';
import { memberSchema, type ChangeMemberRoleInput } from './types';

/** 회원 목록은 인증된 관리자 본인의 기관·사용자 캐시에서만 조회한다. */
export function useMembers() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['members', user.institutionId, user.userId],
    queryFn: ({ signal }) => requestJson('/members', z.array(memberSchema), { signal }),
    enabled: user.role === 'ADMIN',
  });
}
/** 사유와 기준 revision을 보내고 성공한 뒤 서버가 확정한 역할·세션을 다시 받는다. */
export function useChangeMemberRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ChangeMemberRoleInput) =>
      requestJson(`/members/${encodeURIComponent(id)}/role`, memberSchema, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await Promise.all(
        ['members', 'session', 'reviewer-pools', 'request-audit'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
}
