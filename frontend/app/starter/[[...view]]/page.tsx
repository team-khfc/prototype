import { StarterScreen } from '@/features/request';
/** 현재 Next.js의 비동기 라우트 계약으로 시연 화면을 선택한다. */
export default async function StarterPage({ params }: { params: Promise<{ view?: string[] }> }) {
  const { view } = await params;
  return <StarterScreen segments={view} />;
}
