'use client';
import { useState, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import type { Procedure } from './types';
import type { Role } from '@/lib/sharedTypes';
import {
  documentLabel,
  formatDate,
  localDateKey,
  shortId,
  statusLabel,
  stepPath,
} from '@/lib/format';
import { Heading, Badge, Icon, Empty } from '@/components/ui';

/** 서류 제출·접수와 검토 중·보완 상태의 의미를 구분한다. */
export function ProcedureBadge({ item }: { item: Procedure }) {
  const label = statusLabel(item);
  return (
    <Badge
      tone={
        item.status === 'SUBMITTED' || item.status === 'RECEIVED'
          ? 'green'
          : label === '보완 요청'
            ? 'amber'
            : item.status === 'DRAFT'
              ? 'gray'
              : 'blue'
      }
    >
      {label}
    </Badge>
  );
}
/** 현재 내용 수정본과 일치하는 검토만 완료로 표시한다. */
export function ReviewStatus({ item }: { item: Procedure }) {
  return (
    <div className="role-status">
      {item.reviews.map((review) => (
        <span
          key={review.role}
          className={
            review.status === 'COMPLETE' && review.revision === item.revision
              ? 'finished'
              : undefined
          }
        >
          {review.role === 'SECURITY' ? '정보보안' : 'ICT인프라'} ·{' '}
          {review.status === 'COMPLETE' && review.revision === item.revision
            ? '검토 완료'
            : review.status === 'INVALIDATED'
              ? '재확인 필요'
              : '검토 대기'}
        </span>
      ))}
    </div>
  );
}
/** 현재 계정에 반환된 신청만 집계하고 전체 기관의 건수처럼 표시하지 않는다. */
export function Stats({ items }: { items: Procedure[] }) {
  const entries = [
    {
      label: '사전 협의 중',
      value: items.filter((item) => item.status === 'COLLABORATING').length,
      icon: 'file' as const,
      tone: 'blue',
      note: '담당자와 함께 확인 중',
    },
    {
      label: '보완 요청',
      value: items.filter((item) =>
        item.supplements.some((supplement) => supplement.status !== 'RESOLVED'),
      ).length,
      icon: 'clock' as const,
      tone: 'amber',
      note: '추가 확인이 필요한 신청',
    },
    {
      label: '제출 준비',
      value: items.filter((item) => item.allowedActions.includes('SUBMIT')).length,
      icon: 'check' as const,
      tone: 'green',
      note: '확인 후 제출할 수 있어요',
    },
    {
      label: '제출 완료',
      value: items.filter((item) => ['SUBMITTED', 'RECEIVED'].includes(item.status)).length,
      icon: 'shield' as const,
      tone: 'gray',
      note: '제출 시점의 내용 보관',
    },
  ];
  return (
    <div className="stat-grid">
      {entries.map((entry) => (
        <section className={`stat-card ${entry.tone}`} key={entry.label}>
          <div className="row-between">
            <span>{entry.label}</span>
            <span className={`stat-icon ${entry.tone}`}>
              <Icon name={entry.icon} />
            </span>
          </div>
          <strong>
            {entry.value}
            <small>건</small>
          </strong>
          <p>{entry.note}</p>
        </section>
      ))}
    </div>
  );
}
/** 같은 업무 개요 레이아웃에 허용된 데이터 또는 명시된 합성 시안만 주입한다. */
export function WorkspaceView({
  items,
  institutionName,
  role,
  preview = false,
}: {
  items: Procedure[];
  institutionName: string;
  role: Role;
  preview?: boolean;
}) {
  const href = (item: Procedure) => (preview ? '/design-preview/security' : stepPath(item, role));
  const queue = [...items]
    .filter((item) => !['SUBMITTED', 'RECEIVED'].includes(item.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const events = items
    .flatMap((item) => item.timeline.map((event) => ({ ...event, item })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4);
  return (
    <>
      <div className="workspace-context">
        <span>{institutionName}</span>
        <span>업무 공간</span>
      </div>
      <Heading
        title="업무 한눈에 보기"
        description="진행 중인 보안 협의를 살펴보고, 지금 필요한 일을 확인하세요."
      >
        <Link className="button primary" href={preview ? '/design-preview/requests' : '/requests'}>
          협의 요청함
          <Icon name="arrow" />
        </Link>
      </Heading>
      <div className="workspace-intro">
        <span className="workspace-intro-icon">
          <Icon name="shield" width={28} height={28} />
        </span>
        <div>
          <h2>정보는 함께 확인하고, 판단은 담당자가.</h2>
          <p>사업 정보를 출처와 함께 정리하고, 정보보안·ICT인프라 담당자와 협의합니다.</p>
        </div>
        <Badge tone="blue">{preview ? '합성 시안' : '협업 업무 공간'}</Badge>
      </div>
      <Stats items={items} />
      <div className="overview-columns">
        <section className="sf-panel queue-panel">
          <div className="panel-heading">
            <div>
              <span className="overline">나의 업무</span>
              <h2>먼저 확인할 신청</h2>
            </div>
            <Link className="text-button" href={preview ? '/design-preview/requests' : '/requests'}>
              전체 보기
              <Icon name="arrow" width={16} height={16} />
            </Link>
          </div>
          <p className="queue-description">최신 협의부터 살펴보고 다음 단계를 이어가세요.</p>
          {queue.length ? (
            <ul className="work-queue">
              {queue.map((item) => (
                <li key={item.id}>
                  <div className="queue-top">
                    <div>
                      <ProcedureBadge item={item} />
                      <span className="queue-id">{shortId(item.id)}</span>
                    </div>
                    <span className="queue-due">{formatDate(item.updatedAt)} 수정</span>
                  </div>
                  <Link href={href(item)}>
                    <h3>{item.title}</h3>
                    <Icon name="arrow" />
                  </Link>
                  <p>
                    {item.status === 'DRAFT'
                      ? '사업 자료를 정리하고 필요한 정보를 확인해 주세요.'
                      : item.supplements.some((entry) => entry.status === 'OPEN')
                        ? '담당자가 요청한 내용을 보완해 주세요.'
                        : '담당 분야의 정보를 확인하고 검토를 이어가세요.'}
                  </p>
                  <div className="queue-reviews">
                    <ReviewStatus item={item} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="진행 중인 신청이 없습니다"
              description="새 보안 신청으로 필요한 정보를 함께 정리해 보세요."
            />
          )}
        </section>
        <div className="overview-side">
          <section className="sf-panel journey-panel">
            <span className="overline">진행 안내</span>
            <h2>신청부터 제출까지</h2>
            <ol className="journey-list">
              <li>
                <span>1</span>
                <div>
                  <h3>사업 정보 정리</h3>
                  <small>신청자 · AI 정보 후보</small>
                  <p>사업 설명과 인터뷰 답변을 준비합니다.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>담당자 사전 협의</h3>
                  <small>정보보안 · ICT인프라</small>
                  <p>전문가가 근거와 기술 정보를 확인합니다.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <h3>보완 후 최종 제출</h3>
                  <small>신청자</small>
                  <p>확인한 내용으로 제출본을 확정합니다.</p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <h3>담당자 접수</h3>
                  <small>정보보안 · ICT인프라</small>
                  <p>접수 상태와 실제 처리 결과를 구분합니다.</p>
                </div>
              </li>
            </ol>
          </section>
          <section className="config-summary">
            <Icon name="settings" />
            <div>
              <strong>신청마다 기관 설정을 기록해요</strong>
              <p>생성 시점의 게시 버전과 검토 절차가 유지됩니다.</p>
            </div>
          </section>
        </div>
      </div>
      <section className="sf-panel recent-panel">
        <div className="panel-heading">
          <h2>최근 협의 기록</h2>
          <span className="muted">현재 계정에 허용된 신청</span>
        </div>
        {events.length ? (
          <ul className="recent-events">
            {events.map((event) => (
              <li key={`${event.item.id}-${event.id}`}>
                <span className="event-mark">
                  <Icon name="clock" width={18} height={18} />
                </span>
                <div>
                  <Link href={href(event.item)}>{event.item.title}</Link>
                  <p>{event.description}</p>
                  <small>
                    {event.actorName} · {formatDate(event.at, true)}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="history-empty">아직 협의 기록이 없습니다.</p>
        )}
      </section>
    </>
  );
}

export interface RequestFilters {
  query: string;
  status: string;
  review: string;
  start: string;
  end: string;
  size: number;
  page: number;
  ascending: boolean;
}
export const DEFAULT_REQUEST_FILTERS: RequestFilters = {
  query: '',
  status: 'ALL',
  review: 'ALL',
  start: '',
  end: '',
  size: 6,
  page: 1,
  ascending: false,
};
/** 검색·정렬·페이지는 조회 문맥만 바꾸며 업무 상태는 변경하지 않는다. */
export function RequestsView({
  items,
  role,
  preview = false,
  filters,
  onFiltersChange,
}: {
  items: Procedure[];
  role: Role;
  preview?: boolean;
  filters?: RequestFilters;
  onFiltersChange?: Dispatch<SetStateAction<RequestFilters>>;
}) {
  const [localFilters, setLocalFilters] = useState(DEFAULT_REQUEST_FILTERS);
  const { query, status, review, start, end, size, page, ascending } = filters ?? localFilters;
  const setFilters = onFiltersChange ?? setLocalFilters;
  const setQuery = (query: string) => setFilters((current) => ({ ...current, query }));
  const setStatus = (status: string) => setFilters((current) => ({ ...current, status }));
  const setReview = (review: string) => setFilters((current) => ({ ...current, review }));
  const setStart = (start: string) => setFilters((current) => ({ ...current, start }));
  const setEnd = (end: string) => setFilters((current) => ({ ...current, end }));
  const setSize = (size: number) => setFilters((current) => ({ ...current, size }));
  const setPage = (page: number) => setFilters((current) => ({ ...current, page }));
  const setAscending = (ascending: boolean) => setFilters((current) => ({ ...current, ascending }));
  const filtered = items
    .filter(
      (item) =>
        `${item.title} ${shortId(item.id)} ${item.department} ${item.ownerName}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (status === 'ALL' || item.status === status) &&
        (review === 'ALL' ||
          item.reviews.some((entry) => entry.role === review && entry.status !== 'COMPLETE')) &&
        (!start || localDateKey(item.createdAt) >= start) &&
        (!end || localDateKey(item.createdAt) <= end),
    )
    .sort((a, b) =>
      ascending ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt),
    );
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pageCount);
  return (
    <>
      <Heading
        title="협의 요청함"
        description="신청 현황을 확인하고, 담당자와 필요한 정보를 함께 완성하세요."
      >
        {role === 'APPLICANT' &&
          (preview ? (
            <button className="button primary" disabled>
              <Icon name="plus" />새 보안 신청
            </button>
          ) : (
            <Link className="button primary" href="/requests/new">
              <Icon name="plus" />새 보안 신청
            </Link>
          ))}
      </Heading>
      <Stats items={items} />
      <section className="sf-panel list-panel">
        <div className="list-panel-head">
          <h2>전체 협의 목록</h2>
          <div className="segmented" aria-label="담당 분야 필터">
            {[
              ['ALL', '전체'],
              ['SECURITY', '정보보안 미완료'],
              ['INFRA', 'ICT인프라 미완료'],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={review === value ? 'selected' : ''}
                aria-pressed={review === value}
                onClick={() => {
                  setReview(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-area">
          <div className="filter-grid">
            <div className="filter-field">
              <label htmlFor="request-status">신청 상태</label>
              <select
                id="request-status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">전체 상태</option>
                <option value="DRAFT">작성 중</option>
                <option value="COLLABORATING">사전 협의 중</option>
                <option value="SUBMITTED">제출 완료</option>
                <option value="RECEIVED">접수 완료</option>
              </select>
            </div>
            <div className="filter-field period">
              <label htmlFor="start-date">신청 기간</label>
              <div className="date-range">
                <input
                  aria-label="신청 시작일"
                  id="start-date"
                  type="date"
                  value={start}
                  onChange={(event) => {
                    setStart(event.target.value);
                    setPage(1);
                  }}
                />
                <span>~</span>
                <input
                  aria-label="신청 종료일"
                  type="date"
                  min={start}
                  value={end}
                  onChange={(event) => {
                    setEnd(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <div className="filter-field search-field">
              <label htmlFor="request-search">사업명·신청번호·신청자</label>
              <div className="search-input">
                <Icon name="search" />
                <input
                  id="request-search"
                  placeholder="검색어를 입력해 주세요"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>
          <div className="filter-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setFilters({ ...DEFAULT_REQUEST_FILTERS });
              }}
            >
              검색 초기화
            </button>
          </div>
        </div>
        {(query || status !== 'ALL' || review !== 'ALL' || start || end) && (
          <div className="applied-filters" aria-label="적용된 검색 조건">
            <strong>적용 조건</strong>
            {query && <Badge>검색어: {query}</Badge>}
            {status !== 'ALL' && (
              <Badge>
                상태:{' '}
                {
                  {
                    DRAFT: '작성 중',
                    COLLABORATING: '사전 협의 중',
                    SUBMITTED: '제출 완료',
                    RECEIVED: '접수 완료',
                  }[status]
                }
              </Badge>
            )}
            {review !== 'ALL' && (
              <Badge>{review === 'SECURITY' ? '정보보안' : 'ICT인프라'} 미완료</Badge>
            )}
            {(start || end) && (
              <Badge>
                {start || '전체 시작일'} ~ {end || '전체 종료일'}
              </Badge>
            )}
          </div>
        )}
        <div className="table-toolbar">
          <p role="status">
            전체 <strong>{filtered.length}</strong>건
          </p>
          <button type="button" className="text-button" onClick={() => setAscending(!ascending)}>
            {ascending ? '오래된 수정순' : '최근 수정순'}
            <Icon name="down" width={16} height={16} />
          </button>
        </div>
        <div className="table-scroll">
          <table className="sf-table">
            <caption className="sr-only">
              보안 신청 목록. 사업명, 신청자, 상태, 분야별 검토, 수정일
            </caption>
            <thead>
              <tr>
                <th scope="col">번호</th>
                <th scope="col">사업명 / 신청번호</th>
                <th scope="col">신청자 / 부서</th>
                <th scope="col">상태</th>
                <th scope="col">분야별 검토</th>
                <th scope="col">최근 수정</th>
                <th scope="col">상세</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * size, current * size).map((item, index) => {
                const href = preview ? '/design-preview/security' : stepPath(item, role);
                return (
                  <tr key={item.id}>
                    <td>{(current - 1) * size + index + 1}</td>
                    <td>
                      <Link className="case-title" href={href}>
                        {item.title}
                      </Link>
                      <small>
                        {shortId(item.id)} · {documentLabel(item.documentType)}
                      </small>
                    </td>
                    <td>
                      {item.ownerName}
                      <small>{item.department}</small>
                    </td>
                    <td>
                      <ProcedureBadge item={item} />
                    </td>
                    <td>
                      <ReviewStatus item={item} />
                    </td>
                    <td>
                      {formatDate(item.updatedAt)}
                      <small>수정본 v{item.revision}</small>
                    </td>
                    <td>
                      <Link className="row-link" href={href}>
                        보기
                        <Icon name="arrow" width={16} height={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty
            title="검색 결과가 없습니다"
            description="검색어나 신청 상태, 기간을 바꾸어 다시 확인해 주세요."
          />
        )}
        <div className="pagination">
          <label>
            페이지당{' '}
            <select
              aria-label="페이지당 신청 수"
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={6}>6건</option>
              <option value={12}>12건</option>
            </select>
          </label>
          <nav aria-label="신청 목록 페이지">
            <button
              type="button"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              aria-label="이전 페이지"
            >
              <Icon name="back" width={18} height={18} />
            </button>
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                type="button"
                key={index}
                className={current === index + 1 ? 'selected' : ''}
                aria-current={current === index + 1 ? 'page' : undefined}
                onClick={() => setPage(index + 1)}
              >
                {index + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={current === pageCount}
              onClick={() => setPage(current + 1)}
              aria-label="다음 페이지"
            >
              <Icon name="arrow" width={18} height={18} />
            </button>
          </nav>
        </div>
      </section>
      <p className="list-bottom-note">
        검토 완료는 실제 방화벽 적용이나 서비스 운영 승인을 의미하지 않습니다.
      </p>
    </>
  );
}
