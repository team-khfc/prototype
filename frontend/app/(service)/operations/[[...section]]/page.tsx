import { OperationsPage } from '@/features/request';
/** 운영 조회·고정 기준·후속 기능의 구현 범위를 나누어 안내한다. */
export default async function OperationsRoute({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  return <OperationsPage section={section?.[0]} />;
}
