import type { Metadata } from 'next';
import { LiveRequestDetail } from '@/features/request';
export const metadata: Metadata = { title: '신청 상세' };
/** 서버가 허용한 신청 상세와 명령만 제공한다. */
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveRequestDetail id={id} />;
}
