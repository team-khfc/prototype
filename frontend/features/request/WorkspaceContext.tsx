'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Actor } from '@/features/auth';
import type { LlmOption } from '@/features/llm';
import type { Role } from '@/lib/sharedTypes';
import type {
  AnswerInput,
  AnalysisInput,
  AuditEvent,
  BusinessCase,
  CaseAnalysis,
  CreateCaseInput,
  RequestCommand,
  ReviewerPool,
  SecurityRequest,
} from './types';

export interface WorkspaceContextValue {
  mode: 'preview' | 'live';
  actor: Actor;
  institutionName: string;
  cases: BusinessCase[];
  requests: SecurityRequest[];
  pools: ReviewerPool[];
  modelOptions: LlmOption[];
  modelsLoading?: boolean;
  modelsError?: unknown;
  auditEvents: AuditEvent[];
  pending: boolean;
  error: unknown;
  loading: boolean;
  operationsError?: unknown;
  operationsLoading?: boolean;
  changePreviewRole?: (role: Role) => void;
  resetPreview?: () => void;
  refresh: () => void;
  createCase: (input: CreateCaseInput) => Promise<string>;
  saveCase: (id: string, expectedRevision: number, answers: AnswerInput[]) => Promise<void>;
  command: (id: string, command: RequestCommand) => Promise<void>;
  analyse: (input: AnalysisInput) => Promise<CaseAnalysis>;
  applyAnalysis: (analysis: CaseAnalysis, expectedRevision: number) => Promise<void>;
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
/** 시연과 실서버의 데이터 경계만 교체하고 같은 화면을 검토할 수 있도록 한다. */
export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: ReactNode;
}) {
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}
/** 세션 데이터와 공개 시연 데이터를 섞지 않고 명시된 경계에서만 읽는다.
 * @throws Error 업무 경계 없이 화면을 사용했을 때 */
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('업무 화면 경계가 필요합니다.');
  return context;
}
/** 모드별 링크가 공개 미리보기에서 인증 경로로 잘못 이동하지 않게 한다. */
export function workspacePath(mode: 'preview' | 'live', path: string) {
  return `${mode === 'preview' ? '/starter' : ''}${path}`;
}
