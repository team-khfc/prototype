import { LiveRequestDetail } from '@/features/request';
/** 서버가 허용한 신청 상세와 명령만 제공한다. */
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveRequestDetail id={id} />;
}
