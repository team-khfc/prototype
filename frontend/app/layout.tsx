import type {Metadata} from 'next';
import './globals.css';
import './workspace.css';
export const metadata:Metadata={title:'보안길잡이 AI | KRDS 업무 프로토타입',description:'design.md v3.0 기반의 신청·보안 협의·기관 설정 프로토타입. 합성 데이터 시연.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><head><link rel="stylesheet" href="/vendor/krds/css/token/krds_tokens.css"/></head><body>{children}</body></html>}
