import type { Metadata } from 'next';
import { OperationsPage } from '@/features/request';
/** 운영 화면의 현재 업무 목적을 제목에 연결한다. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}): Promise<Metadata> {
  const { section } = await params;
  const titles: Record<string, string> = {
    members: '회원·역할 관리',
    models: 'AI 모델 구성',
    configuration: '업무 기준',
    roadmap: '후속 기능',
  };
  return { title: titles[section?.[0] ?? ''] ?? '담당자·처리 이력' };
}
/** 운영 조회·고정 기준·후속 기능의 구현 범위를 나누어 안내한다. */
export default async function OperationsRoute({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  return <OperationsPage section={section?.[0]} />;
}
