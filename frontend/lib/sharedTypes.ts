import { z } from 'zod';

/** 인증·신청·역할 관리가 같은 역할 코드를 사용하도록 최소 공유 계약만 둔다. */
export const roleSchema = z.enum(['APPLICANT', 'SECURITY', 'INFRA', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;
export const ROLE_LABELS: Record<Role, string> = {
  APPLICANT: '일반 사용자',
  SECURITY: '정보보안',
  INFRA: 'ICT인프라',
  ADMIN: '기관 관리자',
};
