import type { Metadata } from 'next';
import { Providers } from './Providers';
import '@/public/assets/vendor/krds/css/token/krds_tokens.css';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/workspace.css';

export const metadata: Metadata = {
  title: { default: '보안길잡이 AI', template: '%s | 보안길잡이 AI' },
  description: '공공기관 현업과 정보보안·ICT인프라 담당자의 지식 중계 플랫폼',
};
/** 현재 화면과 공통 토큰·폰트만 번들에 포함해 외부 CDN 없이 제공한다. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
