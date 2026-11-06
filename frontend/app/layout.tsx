import type { Metadata } from 'next';
import { Providers } from './Providers';
import '@/public/assets/vendor/krds/css/token/krds_tokens.css';
import '@/public/assets/css/tokens.css';
import '@/public/assets/css/styles.css';
import '@/public/assets/css/workspace.css';
import '@/styles/application.css';
import '@/styles/starter.css';

export const metadata: Metadata = {
  title: '보안길잡이 | 안전한 서비스를 위한 첫걸음',
  description: '공공기관 현업과 정보보안·ICT인프라 담당자의 지식 중계 플랫폼',
};
/** 지정 원본 CSS와 폰트를 그대로 번들에 포함해 외부 CDN 없이 같은 디자인을 제공한다. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
