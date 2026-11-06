import { AuthBoundary } from '@/features/auth';
import { LiveWorkspaceProvider } from '@/features/request';
/** 신규 업무 경로는 실제 서버 세션과 신규 API에만 연결한다. */
export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthBoundary>
      <LiveWorkspaceProvider>{children}</LiveWorkspaceProvider>
    </AuthBoundary>
  );
}
