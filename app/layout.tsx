import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '보안길잡이 AI | 보안 협의 워크스페이스', description: '기관별 보안 서류와 검토 절차를 함께 완성하는 협업 공간. 합성 데이터로 동작하는 디자인 검토용 프로토타입.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
