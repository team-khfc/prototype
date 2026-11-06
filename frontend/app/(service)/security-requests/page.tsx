import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import { RequestList } from '@/features/request';
export const metadata: Metadata = { title: '신청 현황' };
/** URL 검색 조건을 읽는 목록만 Suspense 경계로 감싼다. */
export default function RequestsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RequestList />
    </Suspense>
  );
}
