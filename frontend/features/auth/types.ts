import { z } from 'zod';
import { roleSchema } from '@/lib/sharedTypes';

/** 세션의 역할·기관은 서버 응답만 사용하며 클라이언트 선택으로 만들지 않는다. */
export const actorSchema = z.object({
  userId: z.string(),
  institutionId: z.string(),
  username: z.string(),
  displayName: z.string(),
  role: roleSchema,
});
export const sessionSchema = z.object({
  user: actorSchema,
  institutionName: z.string(),
  expiresAt: z.string(),
});
export type Actor = z.infer<typeof actorSchema>;
export type Session = z.infer<typeof sessionSchema>;

export const memberSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  department: z.string(),
  role: roleSchema,
  active: z.boolean(),
  revision: z.number().int().nonnegative(),
});
export type Member = z.infer<typeof memberSchema>;
export interface ChangeMemberRoleInput {
  id: string;
  role: Member['role'];
  expectedRevision: number;
  reason: string;
}
