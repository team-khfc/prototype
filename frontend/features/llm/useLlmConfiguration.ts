'use client';

import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { requestJson } from '@/lib/http';
import {
  llmConfigurationSchema,
  llmOptionSchema,
  type RegisterLlmConfigurationInput,
} from './types';

/** 일반 사용자도 서버가 허용한 선택지의 공급자·모델명만 조회한다. */
export function useLlmOptions() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['llm-options', user.institutionId, user.userId],
    queryFn: ({ signal }) => requestJson('/llm-options', z.array(llmOptionSchema), { signal }),
  });
}
/** 관리자용 연결 구성은 같은 기관·계정의 캐시 안에서만 보관한다. */
export function useLlmConfigurations() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['llm-configurations', user.institutionId, user.userId],
    queryFn: ({ signal }) =>
      requestJson('/llm-configurations', z.array(llmConfigurationSchema), { signal }),
    enabled: user.role === 'ADMIN',
  });
}
/** 등록 성공 뒤 실제 서버 목록을 다시 확인하며 실패를 모의 성공으로 대체하지 않는다. */
export function useRegisterLlmConfiguration() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterLlmConfigurationInput) =>
      requestJson('/llm-configurations', llmConfigurationSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await Promise.all(
        ['llm-configurations', 'llm-options', 'request-audit'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
}
