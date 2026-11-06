'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon, ErrorNotice, Loading, Empty } from '@/components/ui';
import { useWorkspace, workspacePath } from './WorkspaceContext';
import {
  AssignedReviewers,
  DeadlineBadge,
  PageHeading,
  StageProgress,
  StatusBadge,
  formatDate,
  nextAction,
} from './RequestComponents';
import { DOCUMENT_LABELS, STAGE_LABELS, STATUS_LABELS, type SecurityRequest } from './types';

/** 최신 시안의 다섯 열을 유지하고 사업 건 안의 신청별 독립 상태를 표시한다. */
export function RequestTable({ requests }: { requests: SecurityRequest[] }) {
  const { mode, actor, cases } = useWorkspace();
  return (
    <div className="sa-table-wrap" role="region" aria-label="신청 목록" tabIndex={0}>
      <table className="sa-table sa-request-table">
        <caption className="sr-only">
          사업명, 담당자 또는 신청자, 단계, 상태, 기한으로 보는 신청 현황
        </caption>
        <colgroup>
          <col style={{ width: '31%' }} />
          <col style={{ width: '23%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">사업명</th>
            <th scope="col">{actor.role === 'APPLICANT' ? '담당자' : '부서·신청자'}</th>
            <th scope="col">단계</th>
            <th scope="col">상태</th>
            <th scope="col">기한</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>
                <small className="sa-request-number">
                  {DOCUMENT_LABELS[request.docType]}{' '}
                  <span>· {request.id.slice(-8).toUpperCase()}</span>
                </small>
                <Link
                  className="sa-row-link"
                  href={workspacePath(mode, `/security-requests/${request.id}`)}
                >
                  {request.caseTitle}
                </Link>
                <small className="sa-muted">신청일 {formatDate(request.createdAt)}</small>
              </td>
              <td>
                {actor.role === 'APPLICANT' ? (
                  <AssignedReviewers request={request} />
                ) : (
                  <>
                    <p>{cases.find((item) => item.id === request.caseId)?.department ?? '—'}</p>
                    <small className="sa-muted">{request.ownerName}</small>
                  </>
                )}
              </td>
              <td>
                <StageProgress stage={request.stage} />
              </td>
              <td>
                <StatusBadge status={request.status} />
                <span
                  className={`sa-next-action${request.allowedActions.some((action) => ['CONSULT', 'ALLOCATE', 'COMPLETE_REVIEW', 'SUBMIT', 'FINAL_CONFIRM', 'FINALIZE'].includes(action)) ? ' sa-my-turn' : ''}`}
                >
                  {nextAction(request)}
                </span>
              </td>
              <td>
                <DeadlineBadge request={request} preview={mode === 'preview'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 검색·단계 필터는 조회 결과만 바꾸고 업무 상태에는 영향을 주지 않는다. */
export function RequestList() {
  const workspace = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const stage = Number(params.get('stage') ?? 0);
  const query = params.get('q') ?? '';
  const requestedStatus = params.get('status') || '';
  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${workspacePath(workspace.mode, '/security-requests')}?${next.toString()}`);
    setPage(1);
  }
  const submittedOnly = params.get('submitted') === '1';
  const visible = workspace.requests.filter(
    (item) =>
      (!stage || item.stage === stage) &&
      (!requestedStatus || item.status === requestedStatus) &&
      (!submittedOnly || ['SUBMITTED', 'FINALIZED'].includes(item.status)) &&
      `${item.caseTitle} ${DOCUMENT_LABELS[item.docType]} ${item.id}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 5));
  const currentPage = Math.min(page, pages);
  const cards = [
    { label: '전체 신청', count: workspace.requests.length, icon: 'file' as const },
    {
      label: '담당자 협의',
      count: workspace.requests.filter((item) => item.stage === 2).length,
      icon: 'building' as const,
    },
    {
      label: '보완 요청',
      count: workspace.requests.filter((item) => item.status === 'SUPPLEMENT_REQUESTED').length,
      icon: 'info' as const,
    },
    {
      label: '제출·확정',
      count: workspace.requests.filter((item) => ['SUBMITTED', 'FINALIZED'].includes(item.status))
        .length,
      icon: 'check' as const,
    },
  ];
  return (
    <>
      <PageHeading
        title={
          submittedOnly
            ? '제출·확정 서류'
            : requestedStatus === 'SUPPLEMENT_REQUESTED'
              ? '보완 요청'
              : '신청 현황'
        }
        description={
          workspace.actor.role === 'APPLICANT'
            ? '사업별 신청과 담당자 협의 진행 상황을 한눈에 확인하세요.'
            : '배정된 신청을 확인하고 담당 분야의 협의를 이어가세요.'
        }
      >
        {workspace.actor.role === 'APPLICANT' && (
          <Link
            className="sa-button sa-primary"
            href={workspacePath(workspace.mode, '/business-cases/new')}
          >
            <Icon name="plus" width={19} height={19} />새 신청
          </Link>
        )}
      </PageHeading>
      <div className="sa-summary-grid">
        {cards.map((card) => (
          <div className="sa-summary" key={card.label}>
            <span>
              <Icon name={card.icon} width={21} height={21} />
              {card.label}
            </span>
            <strong>
              {card.count}
              <small>건</small>
            </strong>
          </div>
        ))}
      </div>
      <section className="sa-card sa-list-card" aria-labelledby="request-list-title">
        <div className="sa-section-heading">
          <h2 id="request-list-title">
            {workspace.actor.role === 'APPLICANT' ? '내 신청 목록' : '기관 신청 목록'}{' '}
            <span>{visible.length}건</span>
          </h2>
          <div className="sa-stage-legend">
            {STAGE_LABELS.map((label, index) => (
              <span key={label}>
                <i className={`sa-stage-${index + 1}`} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="sa-list-toolbar">
          <div className="sa-filter-pills" role="group" aria-label="단계 필터">
            {['전체', ...STAGE_LABELS].map((label, index) => (
              <button
                key={label}
                aria-pressed={stage === index}
                onClick={() => {
                  updateFilter('stage', index ? String(index) : '');
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            className="sa-list-search"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              router.replace(
                `${workspacePath(workspace.mode, '/security-requests')}?q=${encodeURIComponent(String(data.get('query') ?? ''))}`,
              );
              setPage(1);
            }}
          >
            <label className="sr-only" htmlFor="request-query">
              사업명 또는 신청 번호
            </label>
            <input
              key={query}
              id="request-query"
              name="query"
              type="search"
              defaultValue={query}
              placeholder="사업명 또는 신청 번호"
              maxLength={120}
            />
            <button className="sa-button" type="submit" aria-label="신청 검색">
              <Icon name="search" />
            </button>
          </form>
        </div>
        <div className="sa-list-controls">
          <p>
            {query ? (
              <>
                <strong>“{query}”</strong> 검색 결과
              </>
            ) : (
              '각 서류의 단계와 처리 상태는 독립적으로 진행됩니다.'
            )}
          </p>
          <label>
            상태{' '}
            <select
              value={requestedStatus}
              onChange={(event) => {
                updateFilter('status', event.target.value);
              }}
            >
              <option value="">전체 상태</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {workspace.loading ? (
          <Loading />
        ) : workspace.error ? (
          <ErrorNotice error={workspace.error} retry={workspace.refresh} />
        ) : visible.length ? (
          <RequestTable requests={visible.slice((currentPage - 1) * 5, currentPage * 5)} />
        ) : (
          <Empty
            title="조건에 맞는 신청이 없습니다"
            description="검색어나 필터를 바꾸거나 새로운 사업 건을 만들어 주세요."
          />
        )}
        <nav className="sa-pagination" aria-label="신청 목록 페이지">
          <button
            className="sa-icon-button"
            aria-label="이전 페이지"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <Icon name="back" width={18} height={18} />
          </button>
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              aria-current={currentPage === index + 1 ? 'page' : undefined}
              onClick={() => setPage(index + 1)}
            >
              {index + 1}
            </button>
          ))}
          <button
            className="sa-icon-button"
            aria-label="다음 페이지"
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            <Icon name="arrow" width={18} height={18} />
          </button>
        </nav>
      </section>
      <div className="sa-help-line">
        <Icon name="info" width={18} height={18} />
        <p>
          담당자 협의 완료와 서류 확정은 방화벽 실제 적용을 뜻하지 않습니다. 처리 기한이 지나도 신청
          상태는 자동으로 바뀌지 않습니다.
        </p>
      </div>
    </>
  );
}

/** 사업 건 상태를 새로 저장하지 않고 하위 서류의 실제 진행을 나란히 보여준다. */
export function BusinessCaseList() {
  const { mode, actor, cases, loading, error, refresh } = useWorkspace();
  return (
    <>
      <PageHeading
        title="사업 건"
        description="한 번 입력한 공통 정보로 방화벽 신청과 보안성검토를 함께 준비하세요."
      >
        {actor.role === 'APPLICANT' && (
          <Link href={workspacePath(mode, '/business-cases/new')} className="sa-button sa-primary">
            <Icon name="plus" width={18} height={18} />새 사업 건
          </Link>
        )}
      </PageHeading>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorNotice error={error} retry={refresh} />
      ) : cases.length ? (
        <div className="sa-case-grid">
          {cases.map((businessCase) => (
            <article key={businessCase.id} className="sa-card sa-case-card">
              <div className="sa-section-heading">
                <span className="sa-eyebrow">{businessCase.department}</span>
                <span className="sa-meta">공통 정보 v{businessCase.revision}</span>
              </div>
              <h2>
                <Link href={workspacePath(mode, `/business-cases/${businessCase.id}`)}>
                  {businessCase.title}
                  <Icon name="arrow" width={20} height={20} />
                </Link>
              </h2>
              <p>{businessCase.description}</p>
              <ul>
                {businessCase.requests.map((request) => (
                  <li key={request.id}>
                    <Link href={workspacePath(mode, `/security-requests/${request.id}`)}>
                      <span>{DOCUMENT_LABELS[request.docType]}</span>
                      <StatusBadge status={request.status} />
                      <Icon name="arrow" width={17} height={17} />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="sa-case-foot">
                <span>
                  {businessCase.ownerName} · {formatDate(businessCase.createdAt)}
                </span>
                <Link href={workspacePath(mode, `/business-cases/${businessCase.id}`)}>
                  공통 정보 보기
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="등록된 사업 건이 없습니다"
          description="새 사업 건에서 필요한 서류를 선택하고 공통 질문에 한 번만 답해 주세요."
        />
      )}
    </>
  );
}
