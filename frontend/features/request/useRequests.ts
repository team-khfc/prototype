'use client';

import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { requestJson } from '@/lib/http';
import {
  businessCaseSchema,
  securityRequestSchema,
  reviewerPoolSchema,
  auditEventSchema,
  caseAnalysisSchema,
} from './types';
import type { AnswerInput, AnalysisInput, CreateCaseInput, RequestCommand } from './types';

/** 사업 건과 신청을 별도 조회하고 인증된 사용자마다 캐시를 격리한다. */
export function useRequestWorkspace() {
  const { user } = useSession();
  const scope = [user.institutionId, user.userId];
  const cases = useQuery({
    queryKey: ['business-cases', ...scope],
    queryFn: ({ signal }) =>
      requestJson('/business-cases', z.array(businessCaseSchema), { signal }),
  });
  const requests = useQuery({
    queryKey: ['security-requests', ...scope],
    queryFn: ({ signal }) =>
      requestJson('/security-requests', z.array(securityRequestSchema), { signal }),
  });
  return { cases, requests };
}
/** 목록에서 진입했더라도 상세의 접근 범위와 최신 revision을 서버에서 다시 확인한다. */
export function useSecurityRequest(id: string) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['security-request', user.institutionId, user.userId, id],
    queryFn: ({ signal }) =>
      requestJson(`/security-requests/${encodeURIComponent(id)}`, securityRequestSchema, {
        signal,
      }),
  });
}
/** 조회 가능한 담당자 풀은 관리자 화면에서만 서버로부터 받는다. */
export function useReviewerPools() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['reviewer-pools', user.institutionId, user.userId],
    queryFn: ({ signal }) =>
      requestJson('/reviewer-pools', z.array(reviewerPoolSchema), { signal }),
    enabled: user.role === 'ADMIN',
  });
}
/** 감사 화면은 원문 답변 없이 서버가 허용한 행위 이력만 표시한다. */
export function useRequestAudit(id?: string) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['request-audit', user.institutionId, user.userId, id],
    queryFn: ({ signal }) =>
      requestJson(
        id ? `/security-requests/${encodeURIComponent(id)}/audit-events` : '/audit-events',
        z.array(auditEventSchema),
        { signal },
      ),
    enabled: Boolean(id) || user.role === 'ADMIN',
  });
}
/** 낙관적 업무 확정 없이 서버 성공 후 연관 목록과 공통 답변을 다시 조회한다. */
export function useWorkspaceMutations() {
  const client = useQueryClient();
  async function refresh() {
    await Promise.all(
      ['business-cases', 'security-requests', 'security-request', 'request-audit'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
  }
  const createCase = useMutation({
    mutationFn: (input: CreateCaseInput) =>
      requestJson('/business-cases', businessCaseSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: refresh,
  });
  const saveCase = useMutation({
    mutationFn: ({
      id,
      expectedRevision,
      answers,
    }: {
      id: string;
      expectedRevision: number;
      answers: AnswerInput[];
    }) =>
      requestJson(`/business-cases/${encodeURIComponent(id)}/answers`, businessCaseSchema, {
        method: 'PATCH',
        body: JSON.stringify({ expectedRevision, answers }),
      }),
    onSuccess: refresh,
  });
  const command = useMutation({
    mutationFn: ({ id, command }: { id: string; command: RequestCommand }) =>
      requestJson(
        `/security-requests/${encodeURIComponent(id)}${command.endpoint}`,
        securityRequestSchema,
        {
          method: command.method ?? 'POST',
          body: JSON.stringify(command.body),
          ...(command.idempotencyKey
            ? { headers: { 'Idempotency-Key': command.idempotencyKey } }
            : {}),
        },
      ),
    onSuccess: refresh,
  });
  const analyse = useMutation({
    mutationFn: (input: AnalysisInput) => {
      const form = new FormData();
      form.set('expectedRevision', String(input.expectedRevision));
      form.set('text', input.text);
      if (input.file) form.set('file', input.file);
      if (input.configurationId) form.set('configurationId', input.configurationId);
      return requestJson(
        `/business-cases/${encodeURIComponent(input.caseId)}/analyses`,
        caseAnalysisSchema,
        { method: 'POST', body: form },
      );
    },
  });
  const applyAnalysis = useMutation({
    mutationFn: ({
      caseId,
      analysisId,
      expectedRevision,
    }: {
      caseId: string;
      analysisId: string;
      expectedRevision: number;
    }) =>
      requestJson(
        `/business-cases/${encodeURIComponent(caseId)}/analyses/${encodeURIComponent(analysisId)}/apply`,
        businessCaseSchema,
        { method: 'POST', body: JSON.stringify({ expectedRevision }) },
      ),
    onSuccess: refresh,
  });
  return { createCase, saveCase, command, analyse, applyAnalysis };
}
