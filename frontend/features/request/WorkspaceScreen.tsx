'use client';

import { Suspense } from 'react';
import { Empty, Loading } from '@/components/ui';
import { BusinessCaseList, RequestList } from './RequestList';
import { BusinessCaseDetail, NewBusinessCase } from './BusinessCasePages';
import { PreviewRequestDetail } from './RequestDetail';
import { OperationsPage } from './OperationsPage';

/** 공개 시연에서도 실제 업무 화면과 동일한 컴포넌트를 라우트별로 사용한다. */
export function StarterScreen({ segments = [] }: { segments?: string[] }) {
  const [section, id] = segments;
  if (!section || (section === 'security-requests' && !id))
    return (
      <Suspense fallback={<Loading />}>
        <RequestList />
      </Suspense>
    );
  if (section === 'security-requests' && id) return <PreviewRequestDetail id={id} />;
  if (section === 'business-cases')
    return id === 'new' ? (
      <NewBusinessCase />
    ) : id ? (
      <BusinessCaseDetail id={id} />
    ) : (
      <BusinessCaseList />
    );
  if (section === 'operations') return <OperationsPage section={id} />;
  return (
    <Empty title="시연 화면을 찾을 수 없습니다" description="왼쪽 메뉴에서 화면을 선택해 주세요." />
  );
}
