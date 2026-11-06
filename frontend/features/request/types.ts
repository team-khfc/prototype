import { z } from 'zod';
import { roleSchema } from '@/lib/sharedTypes';

export const documentTypeSchema = z.enum(['FIREWALL', 'SECURITY_REVIEW']);
export const requestStatusSchema = z.enum([
  'DRAFT',
  'CONSULTING',
  'SUPPLEMENT_REQUESTED',
  'FINAL_REVIEW',
  'SUBMITTED',
  'FINALIZED',
  'CLOSED',
  'WITHDRAWN',
]);
export const reviewFieldSchema = z.enum(['INFRA', 'SECURITY']);
export const answerSchema = z.object({
  key: z.string(),
  label: z.string(),
  scope: z.enum(['CASE', 'REQUEST']),
  ownerRole: roleSchema,
  required: z.boolean(),
  value: z.string(),
  source: z.enum(['USER_ANSWER', 'AI_INFERRED', 'STAFF_INPUT', 'STAFF_CONFIRMED']).nullable(),
  evidence: z.string().nullable(),
  confirmed: z.boolean(),
  notApplicable: z.boolean(),
  confirmation: z
    .object({ actorId: z.string(), actorName: z.string(), role: roleSchema, at: z.string() })
    .nullable(),
});
const summaryShape = {
  id: z.string(),
  caseId: z.string(),
  caseTitle: z.string(),
  docType: documentTypeSchema,
  stage: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  status: requestStatusSchema,
  revision: z.number(),
  updatedAt: z.string(),
};
export const requestSummarySchema = z.object(summaryShape);
export const businessCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  department: z.string(),
  description: z.string(),
  institutionId: z.string(),
  ownerId: z.string(),
  ownerName: z.string(),
  revision: z.number(),
  publicationVersion: z.number(),
  answers: z.array(answerSchema),
  requests: z.array(requestSummarySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const securityRequestSchema = z.object({
  ...summaryShape,
  ownerId: z.string(),
  ownerName: z.string(),
  caseRevision: z.number(),
  publicationVersion: z.number(),
  commonAnswers: z.array(answerSchema),
  answers: z.array(answerSchema),
  reviews: z.array(
    z.object({
      id: z.string(),
      field: reviewFieldSchema,
      status: z.enum([
        'PENDING',
        'ALLOCATED',
        'IN_REVIEW',
        'SUPPLEMENT_REQUESTED',
        'COMPLETE',
        'RECHECK',
      ]),
      allocationCompleted: z.boolean(),
      comment: z.string().nullable(),
      completedBy: z.string().nullable(),
      completedAt: z.string().nullable(),
    }),
  ),
  assignments: z.array(
    z.object({
      id: z.string(),
      field: reviewFieldSchema,
      assigneeId: z.string(),
      assigneeName: z.string(),
      active: z.boolean(),
      reason: z.string().nullable(),
      assignedAt: z.string(),
    }),
  ),
  supplements: z.array(
    z.object({
      id: z.string(),
      field: reviewFieldSchema,
      fieldKeys: z.array(z.string()),
      reason: z.string(),
      answer: z.string().nullable(),
      status: z.enum(['OPEN', 'ANSWERED', 'RESOLVED']),
      requestedBy: z.string(),
      createdAt: z.string(),
      resolvedAt: z.string().nullable(),
    }),
  ),
  returns: z.array(
    z.object({
      id: z.string(),
      fromStage: z.number(),
      targetStage: z.number(),
      fieldKeys: z.array(z.string()),
      reason: z.string(),
      actorName: z.string(),
      createdAt: z.string(),
    }),
  ),
  deadlines: z.array(
    z.object({
      id: z.string(),
      field: reviewFieldSchema.nullable(),
      kind: z.enum(['CONSULTATION', 'SUPPLEMENT', 'FINALIZATION']),
      dueAt: z.string(),
      active: z.boolean(),
      closedAt: z.string().nullable(),
      timing: z.enum(['WITHIN', 'DUE_SOON', 'OVERDUE', 'CLOSED']),
    }),
  ),
  submissions: z.array(
    z.object({
      id: z.string(),
      number: z.number(),
      requestRevision: z.number(),
      caseRevision: z.number(),
      createdAt: z.string(),
    }),
  ),
  finalConfirmations: z.array(
    z.object({
      id: z.string(),
      submissionId: z.string(),
      field: reviewFieldSchema,
      actorName: z.string(),
      confirmedAt: z.string(),
    }),
  ),
  currentSubmissionId: z.string().nullable(),
  changedCommonFields: z.array(z.string()),
  highlightedFields: z.array(z.string()),
  blockers: z.array(z.string()),
  allowedActions: z.array(z.string()),
  createdAt: z.string(),
});
export const reviewerPoolSchema = z.object({
  field: reviewFieldSchema,
  reviewers: z.array(z.object({ userId: z.string(), displayName: z.string(), role: roleSchema })),
  defaultReviewerId: z.string().nullable(),
});
export const auditEventSchema = z.object({
  id: z.string(),
  actorName: z.string(),
  actorRole: roleSchema,
  targetType: z.string(),
  targetId: z.string(),
  targetRevision: z.number(),
  action: z.string(),
  reason: z.string().nullable(),
  fieldKeys: z.array(z.string()),
  requestId: z.string(),
  createdAt: z.string(),
});
export type BusinessCase = z.infer<typeof businessCaseSchema>;
export type SecurityRequest = z.infer<typeof securityRequestSchema>;
export type Answer = z.infer<typeof answerSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type ReviewField = z.infer<typeof reviewFieldSchema>;
export type ReviewerPool = z.infer<typeof reviewerPoolSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export interface CreateCaseInput {
  title: string;
  department: string;
  description: string;
  docTypes: DocumentType[];
}
export interface AnswerInput {
  key: string;
  value: string;
  confirmed: boolean;
  notApplicable: boolean;
}
export const caseAnalysisSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  revision: z.number(),
  status: z.enum(['RUNNING', 'SUCCEEDED', 'FAILED', 'STALE']),
  mode: z.enum(['EXAMPLE', 'LIVE']),
  provider: z.string(),
  model: z.string(),
  error: z.string().nullable(),
  suggestions: z.array(z.object({ key: z.string(), value: z.string(), evidence: z.string() })),
  createdAt: z.string(),
});
export type CaseAnalysis = z.infer<typeof caseAnalysisSchema>;
export interface AnalysisInput {
  caseId: string;
  expectedRevision: number;
  text: string;
  file?: File;
}
export interface RequestCommand {
  endpoint: string;
  body: {
    expectedRevision: number;
    comment?: string;
    reason?: string;
    fieldKeys?: string[];
    targetStage?: number;
    answer?: string;
    answers?: AnswerInput[];
    assigneeId?: string;
  };
  method?: 'POST' | 'PATCH';
  idempotencyKey?: string;
}
export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  FIREWALL: '방화벽 신청',
  SECURITY_REVIEW: '보안성검토',
};
export const STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: '작성 중',
  CONSULTING: '협의 중',
  SUPPLEMENT_REQUESTED: '보완 요청',
  FINAL_REVIEW: '최종 검토 중',
  SUBMITTED: '제출됨',
  FINALIZED: '확정',
  CLOSED: '종결(반려)',
  WITHDRAWN: '철회',
};
export const STAGE_LABELS = ['작성', '담당자 협의', '사용자 최종 검토', '확정·관리'] as const;
export const FIELD_LABELS: Record<ReviewField, string> = {
  INFRA: 'ICT인프라',
  SECURITY: '정보보안',
};
