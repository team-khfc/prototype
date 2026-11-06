import { BusinessCaseDetail } from '@/features/request';
/** 공통 답변 작성 화면은 사업 건 식별자로 조회한다. */
export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BusinessCaseDetail id={id} />;
}
