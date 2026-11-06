import type { Metadata } from 'next';
import { StarterScreen } from '@/features/request';
/** 공개 시연도 각 화면의 목적을 브라우저 제목에 표시한다. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}): Promise<Metadata> {
  const { view = [] } = await params;
  const [section, id] = view;
  const title =
    section === 'business-cases'
      ? id === 'new'
        ? '새 신청'
        : id
          ? '공통 정보 작성'
          : '사업 건'
      : section === 'operations'
        ? id === 'members'
          ? '회원·역할 관리'
          : id === 'models'
            ? 'AI 모델 구성'
            : id === 'configuration'
              ? '업무 기준'
              : id === 'roadmap'
                ? '후속 기능'
                : '담당자·처리 이력'
        : id
          ? '신청 상세'
          : '신청 현황';
  return { title };
}
/** 현재 Next.js의 비동기 라우트 계약으로 시연 화면을 선택한다. */
export default async function StarterPage({ params }: { params: Promise<{ view?: string[] }> }) {
  const { view } = await params;
  return <StarterScreen segments={view} />;
}
