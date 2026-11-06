import type { Metadata } from 'next';
import { NewBusinessCase } from '@/features/request';
export const metadata: Metadata = { title: '새 신청' };
/** 한 사업에 복수 서류를 만드는 시작 화면이다. */
export default function NewCasePage() {
  return <NewBusinessCase />;
}
