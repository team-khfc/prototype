'use client';

import { useState, type ReactNode } from 'react';
import { useSession } from '@/features/auth';
import type { Role } from '@/lib/sharedTypes';
import { WorkspaceProvider } from './WorkspaceContext';
import { ServiceShell } from './ServiceShell';
import {
  applyDemoCommand,
  createDemoCase,
  createDemoState,
  demoRequestForActor,
  saveDemoCase,
  DEMO_ACTORS,
  DEMO_POOLS,
  DEMO_TIME,
} from './demo';
import {
  useRequestAudit,
  useRequestWorkspace,
  useReviewerPools,
  useWorkspaceMutations,
} from './useRequests';
import type { CaseAnalysis } from './types';

/** 합성 시연 상태는 React 메모리 안에만 두고 새로고침하면 초기 자료로 복원한다. */
export function StarterPreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(createDemoState);
  const [role, setRole] = useState<Role>('APPLICANT');
  const [pending, setPending] = useState(false);
  const [analyses, setAnalyses] = useState<CaseAnalysis[]>([]);
  const actor = DEMO_ACTORS[role];
  const visibleRequests = state.requests.filter(
    (request) =>
      role === 'ADMIN' ||
      (role === 'APPLICANT'
        ? request.ownerId === actor.userId
        : request.assignments.some(
            (assignment) => assignment.active && assignment.assigneeId === actor.userId,
          )),
  );
  const visibleCases = state.cases.filter(
    (businessCase) =>
      role === 'ADMIN' ||
      (role === 'APPLICANT'
        ? businessCase.ownerId === actor.userId
        : visibleRequests.some((request) => request.caseId === businessCase.id)),
  );
  return (
    <WorkspaceProvider
      value={{
        mode: 'preview',
        actor,
        institutionName: '합성 공공기관',
        cases: visibleCases,
        requests: visibleRequests.map((request) => demoRequestForActor(request, actor)),
        pools: DEMO_POOLS,
        auditEvents: state.auditEvents,
        pending,
        error: undefined,
        loading: false,
        changePreviewRole: setRole,
        resetPreview: () => {
          setState(createDemoState());
          setAnalyses([]);
        },
        refresh: () => undefined,
        createCase: async (input) => {
          const created = createDemoCase(state, actor, input);
          setState(created.state);
          return created.id;
        },
        saveCase: async (id, revision, answers) => {
          setState(saveDemoCase(state, actor, id, revision, answers));
        },
        command: async (id, command) => {
          setPending(true);
          try {
            setState(applyDemoCommand(state, actor, id, command));
          } finally {
            setPending(false);
          }
        },
        analyse: async (input) => {
          const text = input.text.trim() || (input.file ? await input.file.text() : '');
          if (!text) throw new Error('분석할 합성 설명이나 TXT·MD 파일을 준비해 주세요.');
          const analysis: CaseAnalysis = {
            id: `demo-analysis-${analyses.length + 1}`,
            caseId: input.caseId,
            revision: input.expectedRevision,
            status: 'SUCCEEDED',
            mode: 'EXAMPLE',
            provider: '합성 시연',
            model: '예시 추출기',
            error: null,
            suggestions: [
              {
                key: 'purpose',
                value: text.slice(0, 1000),
                evidence: `시연용 직접 발췌: ${text.slice(0, 200)}`,
              },
            ],
            createdAt: DEMO_TIME,
          };
          setAnalyses([...analyses, analysis]);
          return analysis;
        },
        applyAnalysis: async (analysis, revision) => {
          if (analysis.status !== 'SUCCEEDED' || analysis.revision !== revision)
            throw new Error('분석 후 입력이 바뀌었습니다. 최신 내용으로 다시 분석해 주세요.');
          const businessCase = state.cases.find((item) => item.id === analysis.caseId);
          if (!businessCase || businessCase.revision !== revision)
            throw new Error('최신 사업 건을 다시 확인해 주세요.');
          const applicable = analysis.suggestions.filter((suggestion) =>
            businessCase.answers.some(
              (answer) => answer.key === suggestion.key && !answer.confirmed,
            ),
          );
          if (!applicable.length)
            throw new Error('이미 사람이 확인한 값은 AI 후보로 덮어쓰지 않습니다.');
          const next = saveDemoCase(
            state,
            actor,
            businessCase.id,
            revision,
            applicable.map((item) => ({
              key: item.key,
              value: item.value,
              confirmed: false,
              notApplicable: false,
            })),
          );
          const updated = next.cases.find((item) => item.id === businessCase.id)!;
          for (const suggestion of applicable) {
            const answer = updated.answers.find((item) => item.key === suggestion.key);
            if (answer) {
              answer.source = 'AI_INFERRED';
              answer.evidence = suggestion.evidence;
              answer.confirmed = false;
              answer.confirmation = null;
            }
          }
          next.requests
            .filter(
              (item) =>
                item.caseId === businessCase.id &&
                item.stage < 4 &&
                !['FINALIZED', 'CLOSED', 'WITHDRAWN'].includes(item.status),
            )
            .forEach((item) => {
              item.commonAnswers = structuredClone(updated.answers);
            });
          setState(next);
        },
      }}
    >
      <ServiceShell>{children}</ServiceShell>
    </WorkspaceProvider>
  );
}

/** 실서버 화면은 실제 세션·CSRF·응답 검증을 거치며 fixture로 실패를 대체하지 않는다. */
export function LiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const queries = useRequestWorkspace();
  const pools = useReviewerPools();
  const audit = useRequestAudit();
  const mutations = useWorkspaceMutations();
  return (
    <WorkspaceProvider
      value={{
        mode: 'live',
        actor: session.user,
        institutionName: session.institutionName,
        cases: queries.cases.data ?? [],
        requests: queries.requests.data ?? [],
        pools: pools.data ?? [],
        auditEvents: audit.data ?? [],
        loading: queries.cases.isPending || queries.requests.isPending,
        error: queries.cases.error ?? queries.requests.error,
        operationsError: pools.error ?? audit.error,
        operationsLoading: session.user.role === 'ADMIN' && (pools.isPending || audit.isPending),
        pending: Object.values(mutations).some((mutation) => mutation.isPending),
        refresh: () => {
          void queries.cases.refetch();
          void queries.requests.refetch();
        },
        createCase: async (input) => (await mutations.createCase.mutateAsync(input)).id,
        saveCase: async (id, expectedRevision, answers) => {
          await mutations.saveCase.mutateAsync({ id, expectedRevision, answers });
        },
        command: async (id, command) => {
          await mutations.command.mutateAsync({ id, command });
        },
        analyse: (input) => mutations.analyse.mutateAsync(input),
        applyAnalysis: async (analysis, expectedRevision) => {
          await mutations.applyAnalysis.mutateAsync({
            caseId: analysis.caseId,
            analysisId: analysis.id,
            expectedRevision,
          });
        },
      }}
    >
      <ServiceShell>{children}</ServiceShell>
    </WorkspaceProvider>
  );
}
