'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { AccountControl } from '@/features/auth';
import { Icon } from '@/components/ui';
import { ROLE_LABELS, type Role } from '@/lib/sharedTypes';
import { useWorkspace, workspacePath } from './WorkspaceContext';

/** 최신 시안의 와이드 셸을 사용하되 공개 시연의 역할 선택을 인증과 명확히 구분한다. */
export function ServiceShell({ children }: { children: ReactNode }) {
  const workspace = useWorkspace();
  const path = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [search, setSearch] = useState('');
  const href = (suffix: string) => workspacePath(workspace.mode, suffix);
  const navigation = [
    { path: '/security-requests', label: '신청 현황', icon: 'list' as const },
    { path: '/business-cases', label: '사업 건', icon: 'building' as const },
    {
      path: '/security-requests?status=SUPPLEMENT_REQUESTED',
      label: '보완 요청',
      icon: 'info' as const,
    },
    { path: '/security-requests?submitted=1', label: '제출·확정 서류', icon: 'file' as const },
  ];
  return (
    <div className={`sa-app${largeText ? ' sa-large-text' : ''}`}>
      <a className="sa-skip" href="#sa-main">
        본문 바로가기
      </a>
      <div className="sa-environment">
        <span>
          <Icon name="shield" width={17} height={17} />
          <strong>
            {workspace.mode === 'preview'
              ? '공개 시연 · 합성 데이터'
              : '개발 서버 · 합성 데이터 전용'}
          </strong>
          <span>
            {workspace.mode === 'preview'
              ? '변경 내용은 이 탭의 메모리에만 남습니다.'
              : '서버에 저장된 업무 정보를 표시합니다.'}
          </span>
        </span>
        {workspace.mode === 'preview' ? (
          <Link href="/login">
            실제 계정으로 로그인 <Icon name="arrow" width={16} height={16} />
          </Link>
        ) : (
          <Link href="/starter">
            공개 시연 보기 <Icon name="arrow" width={16} height={16} />
          </Link>
        )}
      </div>
      <header className="sa-header">
        <button
          className="sa-icon-button sa-mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="업무 메뉴"
          aria-expanded={menuOpen}
          aria-controls="sa-sidebar"
        >
          <Icon name="menu" />
        </button>
        <Link href={href('/security-requests')} className="sa-brand">
          <Image
            src="/assets/starter/logo.png"
            alt="보안길잡이 AI"
            width={208}
            height={48}
            priority
            className="sa-logo-light"
          />
          <Image
            src="/assets/starter/logo-dark.png"
            alt="보안길잡이 AI"
            width={208}
            height={49}
            priority
            className="sa-logo-dark"
          />
        </Link>
        <span className="sa-header-org">{workspace.institutionName}</span>
        <form
          className="sa-global-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(`${href('/security-requests')}?q=${encodeURIComponent(search)}`);
          }}
        >
          <Icon name="search" width={19} height={19} />
          <label className="sr-only" htmlFor="sa-global-search">
            신청·사업 검색
          </label>
          <input
            id="sa-global-search"
            type="search"
            placeholder="신청·사업 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={120}
          />
          <button type="submit" aria-label="검색하기">
            <Icon name="arrow" width={17} height={17} />
          </button>
        </form>
        <div className="sa-account">
          {workspace.mode === 'preview' ? (
            <>
              <span className="sa-avatar" aria-hidden="true">
                {workspace.actor.displayName.slice(0, 1)}
              </span>
              <label className="sa-role-label">
                시연 역할
                <select
                  value={workspace.actor.role}
                  onChange={(event) => workspace.changePreviewRole?.(event.target.value as Role)}
                >
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <AccountControl />
          )}
          <button
            className="sa-icon-button sa-font-size"
            aria-label={largeText ? '기본 글자 크기' : '큰 글자 크기'}
            aria-pressed={largeText}
            onClick={() => setLargeText(!largeText)}
          >
            가<span aria-hidden="true">+</span>
          </button>
        </div>
      </header>
      <div className={`sa-shell${collapsed ? ' sa-shell-collapsed' : ''}`}>
        <aside id="sa-sidebar" className={`sa-sidebar${menuOpen ? ' sa-sidebar-open' : ''}`}>
          <button
            className="sa-collapse"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-controls="sa-navigation"
          >
            <Icon name={collapsed ? 'arrow' : 'back'} width={16} height={16} />
            <span>{collapsed ? '메뉴 펼치기' : '메뉴 접기'}</span>
          </button>
          <div id="sa-navigation" className="sa-nav-content">
            <div className="sa-institution">
              <Icon name="building" />
              <strong>{workspace.institutionName}</strong>
            </div>
            <nav aria-label="신청 업무">
              <h2>신청 업무</h2>
              <ul>
                {navigation.map((item) => (
                  <li key={item.path}>
                    <Link
                      href={href(item.path)}
                      onClick={() => setMenuOpen(false)}
                      aria-current={
                        !item.path.includes('?') &&
                        (path === href(item.path) ||
                          (workspace.mode === 'preview' &&
                            path === '/starter' &&
                            item.path === '/security-requests'))
                          ? 'page'
                          : undefined
                      }
                    >
                      <Icon name={item.icon} width={20} height={20} />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="기관 운영">
              <h2>기관 운영</h2>
              <ul>
                <li>
                  <Link
                    href={href('/operations')}
                    onClick={() => setMenuOpen(false)}
                    aria-current={path === href('/operations') ? 'page' : undefined}
                  >
                    <Icon name="settings" width={20} height={20} />
                    담당자·처리 이력
                  </Link>
                </li>
                <li>
                  <Link href={href('/operations/configuration')} onClick={() => setMenuOpen(false)}>
                    <Icon name="book" width={20} height={20} />
                    업무 기준
                  </Link>
                </li>
                <li>
                  <Link href={href('/operations/roadmap')} onClick={() => setMenuOpen(false)}>
                    <Icon name="clock" width={20} height={20} />
                    후속 기능 <span className="sa-nav-label">예정</span>
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="sa-sidebar-help">
              <Icon name="info" />
              <p>
                보안 용어를 몰라도
                <br />
                담당자와 함께 작성해요.
              </p>
              <Link href={href('/operations/configuration')}>
                이용 안내 <Icon name="arrow" width={16} height={16} />
              </Link>
            </div>
            {workspace.resetPreview && (
              <button className="sa-text-button" onClick={workspace.resetPreview}>
                시연 내용 처음으로
              </button>
            )}
          </div>
        </aside>
        <main id="sa-main" className="sa-main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <footer className="sa-footer">
        <strong>보안길잡이 AI</strong>
        <span>Copyright © 2026 Team HF. All rights reserved.</span>
        <span>안전한 서비스를 위한 첫걸음</span>
      </footer>
    </div>
  );
}
