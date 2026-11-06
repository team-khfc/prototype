import { StarterPreviewProvider } from '@/features/request';
/** 공개 시연의 메모리를 하위 화면 이동 중 유지하고 실제 인증 경계와 분리한다. */
export default function StarterLayout({ children }: { children: React.ReactNode }) {
  return <StarterPreviewProvider>{children}</StarterPreviewProvider>;
}
