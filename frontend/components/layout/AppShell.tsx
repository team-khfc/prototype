'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountControl, useSession } from '@/features/auth';
import type { Role } from '@/lib/sharedTypes';
import { Icon, Modal, type IconName } from '@/components/ui';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}
/** 지정 시안의 같은 업무 셸을 실제 화면과 읽기전용 시안에서 재사용한다. preview는 권한 검사가 아니다. */
export function AppShell({
  children,
  institutionName,
  role,
  preview = false,
}: {
  children: ReactNode;
  institutionName: string;
  role: Role;
  preview?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [large, setLarge] = useState(false);
  const nav: NavItem[] = preview
    ? [
        { href: '/design-preview/workspace', label: '업무 한눈에 보기', icon: 'home' },
        { href: '/design-preview/requests', label: '협의 요청함', icon: 'list' },
        { href: '/design-preview/security', label: '정보보안 검토', icon: 'shield' },
        { href: '/design-preview/infra', label: 'ICT인프라 검토', icon: 'server' },
        { href: '/design-preview/analysis', label: '자료·AI 제안', icon: 'sparkle' },
        { href: '/design-preview/admin', label: '기관 설정', icon: 'settings' },
      ]
    : role === 'ADMIN'
      ? [
          { href: '/workspace', label: '업무 한눈에 보기', icon: 'home' },
          { href: '/admin/questions', label: '기관 설정', icon: 'settings' },
          { href: '/admin/context', label: '기관 컨텍스트', icon: 'lock' },
          { href: '/knowledge', label: '보안 지식 안내', icon: 'book' },
        ]
      : [
          { href: '/workspace', label: '업무 한눈에 보기', icon: 'home' },
          { href: '/requests', label: '협의 요청함', icon: 'list' },
          { href: '/documents', label: '문서함', icon: 'file' },
          { href: '/knowledge', label: '보안 지식 안내', icon: 'book' },
          ...(role !== 'APPLICANT'
            ? [{ href: '/institution/context', label: '기관 컨텍스트', icon: 'lock' as IconName }]
            : []),
        ];
  return (
    <div className={large ? 'large-text' : ''}>
      <a className="skip-link" href="#main-content">
        본문 바로가기
      </a>
      <div className={`demo-strip ${preview ? 'preview-strip' : ''}`}>
        <div>
          <Icon name={preview ? 'lock' : 'info'} width={16} height={16} />
          <span>
            {preview
              ? '이전 개발 예제 · 읽기전용 합성 시안 · 저장 및 업무 API 연결 없음'
              : '이전 개발 예제 · 기존 절차 API 연결 · 신규 업무는 개발 시작점을 이용해 주세요'}
          </span>
        </div>
        <Link href={preview ? '/starter' : '/security-requests'}>
          최신 개발 시작점
          <Icon name="arrow" width={16} height={16} />
        </Link>
      </div>
      <header className="app-header">
        <div className="header-inner">
          <button
            className="icon-button mobile-nav"
            type="button"
            aria-label="주요 메뉴 열기"
            aria-controls="side-nav"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Icon name="menu" />
          </button>
          <Link className="brand" href={preview ? '/design-preview/workspace' : '/workspace'}>
            <span className="brand-mark">
              <Icon name="shield" width={28} height={28} />
            </span>
            <strong>
              보안길잡이 <em>AI</em>
            </strong>
          </Link>
          <div className="header-divider" />
          <span className="header-description">안전한 서비스를 위한 첫걸음</span>
          <div className="header-tools">
            <button
              className="text-button screen-setting"
              type="button"
              onClick={() => setSettings(true)}
            >
              화면 설정
            </button>
            {preview ? (
              <>
                <span className="role-picker">디자인 검토</span>
                <span className="user-avatar">시</span>
              </>
            ) : (
              <AccountControl />
            )}
          </div>
        </div>
      </header>
      <div className="app-shell">
        <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} id="side-nav">
          <div className="institution">
            <Icon name="building" />
            <div>
              <strong>{institutionName}</strong>
              <small>{preview ? '합성 기관 · 읽기전용' : '기관 업무 공간'}</small>
            </div>
          </div>
          <div className="nav-label">
            {role === 'ADMIN' && !preview ? '기관 운영' : '협의 업무'}
          </div>
          <nav aria-label="주요 메뉴">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (!preview && item.href === '/requests' && pathname.startsWith('/requests/')) ||
                (!preview &&
                  item.href === '/admin/questions' &&
                  pathname.startsWith('/admin/') &&
                  pathname !== '/admin/context');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? 'active' : undefined}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-help">
            <span className="help-symbol">
              <Icon name="shield" />
            </span>
            <h3>보안 협의, 함께 해결해요.</h3>
            <p>
              준비부터 제출까지
              <br />
              필요한 정보를 차근차근.
            </p>
            <Link
              href={preview ? '/design-preview/analysis' : '/knowledge'}
              className="text-button"
            >
              작성 안내
              <Icon name="arrow" width={16} height={16} />
            </Link>
          </div>
          <div className="sidebar-bottom">
            <Icon name="lock" width={16} height={16} />
            <span>기관별로 분리된 업무 공간</span>
          </div>
        </aside>
        <div className="main-column">
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <footer className="app-footer">
            <div>
              <strong>보안길잡이</strong>
              <span>현업과 전문가를 잇는 보안 협의</span>
            </div>
            <small>AI는 제안하고, 사람이 확인합니다.</small>
          </footer>
        </div>
      </div>
      <Modal open={settings} title="화면 설정" onClose={() => setSettings(false)}>
        <p>이 화면의 글자 크기를 조정합니다. 입력한 업무 내용은 변경되지 않습니다.</p>
        <label className="check-label">
          <input
            type="checkbox"
            checked={large}
            onChange={(event) => setLarge(event.target.checked)}
          />
          글자 크게 보기
        </label>
        <div className="dialog-actions">
          <button className="button primary" type="button" onClick={() => setSettings(false)}>
            확인
          </button>
        </div>
      </Modal>
    </div>
  );
}
/** 기관·역할 표시는 서버가 인증한 세션에서만 가져온다. */
export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const session = useSession();
  return (
    <AppShell institutionName={session.institutionName} role={session.user.role}>
      {children}
    </AppShell>
  );
}
