import type { Metadata } from 'next';
import { BusinessCaseList } from '@/features/request';
export const metadata: Metadata = { title: '사업 건' };
/** 사업 건 목록을 신규 업무 경계 안에서 제공한다. */
export default function CasesPage() {
  return <BusinessCaseList />;
}
