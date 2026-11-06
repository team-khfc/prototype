import { z } from 'zod';

export const modelPurposeSchema = z.enum(['INTERVIEW', 'SUMMARY', 'DOCUMENT']);
export const modelConnectionSchema = z.object({
  provider: z.enum(['EXAMPLE', 'OPENAI', 'GEMMA']),
  endpoint: z.string(),
  model: z.string(),
  keyReference: z.string(),
  temperature: z.number(),
  maxTokens: z.number().int(),
  timeoutSeconds: z.number().int(),
});
export const llmConfigurationSchema = z.object({
  id: z.string(),
  purpose: modelPurposeSchema,
  connection: modelConnectionSchema,
  createdAt: z.string(),
});
/** 신청자용 선택지는 연결 주소나 키 참조를 포함하지 않는 별도 응답이다. */
export const llmOptionSchema = z.object({
  id: z.string().nullable(),
  purpose: modelPurposeSchema,
  provider: z.string(),
  model: z.string(),
  mode: z.enum(['EXAMPLE', 'LIVE']),
});
export type LlmConfiguration = z.infer<typeof llmConfigurationSchema>;
export type LlmOption = z.infer<typeof llmOptionSchema>;
export interface RegisterLlmConfigurationInput {
  connection: Omit<z.infer<typeof modelConnectionSchema>, 'provider'> & {
    provider: 'OPENAI' | 'GEMMA';
  };
  purpose: z.infer<typeof modelPurposeSchema>;
  reason: string;
}
export const MODEL_PURPOSE_LABELS = {
  INTERVIEW: '인터뷰',
  SUMMARY: '요약',
  DOCUMENT: '서류 작성',
} as const;
export const EXAMPLE_MODEL_OPTION: LlmOption = {
  id: null,
  purpose: 'INTERVIEW',
  provider: 'EXAMPLE',
  model: 'labelled-lines-v1',
  mode: 'EXAMPLE',
};
