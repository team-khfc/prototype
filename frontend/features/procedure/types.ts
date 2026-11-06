import { z } from 'zod';
import { policySchema, roleSchema } from '@/lib/sharedTypes';

/** 출처·확인과 현재 수정본을 함께 검증하여 AI 후보를 확정 사실로 수용하지 않는다. */
export const sourceSchema = z.object({
  kind: z.enum(['USER_ANSWER', 'AI_INFERENCE', 'SPECIALIST_INPUT', 'SPECIALIST_CONFIRMATION']),
  evidence: z.string(),
  actorName: z.string(),
  at: z.string(),
});
export const confirmationSchema = z.object({
  actorName: z.string(),
  role: roleSchema,
  at: z.string(),
});
export const answerSchema = z.object({
  key: z.string(),
  label: z.string(),
  reason: z.string(),
  ownerRole: roleSchema,
  requiredAt: z.enum(['CONSULT', 'SUBMIT', 'OPTIONAL']),
  value: z.string(),
  status: z.enum(['EMPTY', 'PROPOSED', 'CONFIRMED', 'NOT_APPLICABLE']),
  source: sourceSchema.nullable(),
  confirmation: confirmationSchema.nullable(),
});
export type Answer = z.infer<typeof answerSchema>;
export const networkInputSchema = z.object({
  id: z.string().optional(),
  sourceName: z.string(),
  sourceIp: z.string(),
  destinationName: z.string(),
  destinationIp: z.string(),
  port: z.string(),
  protocol: z.string(),
  direction: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  purpose: z.string(),
});
export type NetworkInput = z.infer<typeof networkInputSchema>;
export const networkSchema = networkInputSchema.extend({
  id: z.string(),
  source: sourceSchema.nullable(),
  confirmation: confirmationSchema.nullable(),
});
export const procedureSchema = z.object({
  id: z.string(),
  title: z.string(),
  documentType: z.enum(['FIREWALL', 'SECURITY_REVIEW']),
  department: z.string(),
  description: z.string(),
  ownerName: z.string(),
  status: z.enum(['DRAFT', 'COLLABORATING', 'SUBMITTED', 'RECEIVED']),
  revision: z.number(),
  policyVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  answers: z.array(answerSchema),
  rules: z.array(networkSchema),
  reviews: z.array(
    z.object({
      role: roleSchema,
      status: z.enum(['PENDING', 'COMPLETE', 'INVALIDATED']),
      revision: z.number().nullable(),
      comment: z.string(),
      actorName: z.string().nullable(),
      at: z.string().nullable(),
    }),
  ),
  supplements: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      answer: z.string(),
      requestedByRole: roleSchema,
      requestedBy: z.string(),
      status: z.enum(['OPEN', 'ANSWERED', 'RESOLVED']),
      createdAt: z.string(),
      resolvedAt: z.string().nullable(),
    }),
  ),
  timeline: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      description: z.string(),
      actorName: z.string(),
      at: z.string(),
    }),
  ),
  blockers: z.array(z.string()),
  allowedActions: z.array(z.string()),
  policy: policySchema,
});
export type Procedure = z.infer<typeof procedureSchema>;
export const analysisSchema = z.object({
  id: z.string(),
  procedureId: z.string(),
  revision: z.number(),
  status: z.enum(['RUNNING', 'SUCCEEDED', 'FAILED', 'STALE']),
  mode: z.enum(['EXAMPLE', 'LIVE']),
  provider: z.string(),
  model: z.string(),
  createdAt: z.string(),
  error: z.string().nullable(),
  suggestions: z.array(
    z.object({ key: z.string(), label: z.string(), value: z.string(), evidence: z.string() }),
  ),
  references: z.array(
    z.object({ title: z.string(), version: z.string(), section: z.string(), url: z.string() }),
  ),
});
export type Analysis = z.infer<typeof analysisSchema>;
