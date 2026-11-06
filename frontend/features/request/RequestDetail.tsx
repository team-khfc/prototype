'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Empty, ErrorNotice, Icon, Loading, Modal } from '@/components/ui';
import { useWorkspace, workspacePath } from './WorkspaceContext';
import { useRequestAudit, useSecurityRequest } from './useRequests';
import { AnswerEditor } from './AnswerEditor';
import {
  AnswerReadout,
  AssignedReviewers,
  DeadlineBadge,
  PageHeading,
  StageProgress,
  StatusBadge,
  formatDate,
} from './RequestComponents';
import {
  DOCUMENT_LABELS,
  FIELD_LABELS,
  STAGE_LABELS,
  type AuditEvent,
  type RequestCommand,
  type SecurityRequest,
} from './types';

const auditLabels: Record<string, string> = {
  CASE_CREATED: '사업 건 생성',
  REQUEST_CREATED: '신청 생성',
  COMMON_ANSWERS_CHANGED: '공통 답변 변경',
  COMMON_INFORMATION_RECHECK: '공통 정보 재검토 표시',
  AI_ANSWERS_PROPOSED: 'AI 미확정 후보 반영',
  ANSWERS_CHANGED: '서류 답변 변경',
  CONSULTATION_REQUESTED: '담당자 협의 요청',
  ALLOCATION_COMPLETED: 'ICT인프라 할당 완료',
  REVIEW_COMPLETED: '담당 분야 협의 완료',
  SUPPLEMENT_REQUESTED: '보완 요청',
  SUPPLEMENT_ANSWERED: '보완 답변 등록',
  SUPPLEMENT_RESOLVED: '보완 해결 확인',
  STAGE_RETURNED: '이전 단계로 반환',
  REQUEST_SUBMITTED: '서류 제출',
  SUBMISSION_CREATED: '불변 제출본 생성',
  FINAL_CONFIRMED: '제출본 최종 확인',
  REQUEST_FINALIZED: '서류 최종 확정',
  REQUEST_CLOSED: '신청 종결',
  REQUEST_WITHDRAWN: '신청 철회',
  ASSIGNMENT_CHANGED: '담당자 재배정',
  REVIEWER_REASSIGNED: '담당자 재배정',
  DOCUMENT_DOWNLOADED: '서류 내려받기',
  CONSULT: '담당자 협의 요청',
  ALLOCATE: 'ICT인프라 할당 완료',
  COMPLETE_REVIEW: '담당 분야 협의 완료',
  REQUEST_SUPPLEMENT: '보완 요청',
  ANSWER_SUPPLEMENT: '보완 답변 등록',
  RESOLVE_SUPPLEMENT: '보완 해결 확인',
  RETURN: '이전 단계로 반환',
  SUBMIT: '서류 제출',
  FINAL_CONFIRM: '제출본 최종 확인',
  FINALIZE: '서류 최종 확정',
  CLOSE: '신청 종결',
  WITHDRAW: '신청 철회',
  REASSIGN: '담당자 재배정',
  EDIT_ANSWERS: '서류 답변 변경',
};

/** 실제 상세 조회의 권한·revision을 다시 검증하고 공유 상세 컴포넌트로 전달한다. */
export function LiveRequestDetail({ id }: { id: string }) {
  const query = useSecurityRequest(id);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  return <RequestDetail request={query.data} />;
}

/** 공개 시연 상세에서도 신청 단위로 독립된 데이터만 편집한다. */
export function PreviewRequestDetail({ id }: { id: string }) {
  const { requests } = useWorkspace();
  const request = requests.find((item) => item.id === id);
  return request ? (
    <RequestDetail request={request} />
  ) : (
    <Empty
      title="신청을 찾을 수 없습니다"
      description="신청 현황에서 합성 신청을 다시 선택해 주세요."
    />
  );
}

/** 감사 이력은 값 원문 없이 행위·주체·사유를 읽기 전용으로 표시한다. */
export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return events.length ? (
    <ol className="sa-timeline">
      {events.map((event) => (
        <li key={event.id}>
          <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
          <div>
            <strong>{auditLabels[event.action] ?? event.action}</strong>
            <span>
              {event.actorName} · 수정본 {event.targetRevision}
            </span>
            {event.reason && <p>{event.reason}</p>}
            {event.fieldKeys.length > 0 && <small>대상 항목: {event.fieldKeys.join(', ')}</small>}
          </div>
        </li>
      ))}
    </ol>
  ) : (
    <p className="sa-muted">조회 가능한 처리 이력이 없습니다.</p>
  );
}
function LiveAudit({ id }: { id: string }) {
  const query = useRequestAudit(id);
  return query.isPending ? (
    <Loading label="처리 이력을 확인하고 있습니다." />
  ) : query.error ? (
    <ErrorNotice error={query.error} retry={() => void query.refetch()} />
  ) : (
    <AuditTimeline events={query.data ?? []} />
  );
}

function SupplementPanel({ request }: { request: SecurityRequest }) {
  const workspace = useWorkspace();
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  return (
    <section className="sa-card">
      <h2>
        보완 요청{' '}
        <span className="sa-count">
          {request.supplements.filter((item) => item.status !== 'RESOLVED').length}
        </span>
      </h2>
      <ErrorNotice error={error} />
      {request.supplements.length === 0 ? (
        <p className="sa-muted">현재 보완 요청이 없습니다.</p>
      ) : (
        request.supplements.map((item) => (
          <article className="sa-supplement" key={item.id}>
            <div className="sa-section-heading">
              <strong>
                {FIELD_LABELS[item.field]} · {item.requestedBy}
              </strong>
              <span
                className={`sa-badge ${item.status === 'RESOLVED' ? 'sa-success' : 'sa-warning'}`}
              >
                {item.status === 'RESOLVED'
                  ? '해결됨'
                  : item.status === 'ANSWERED'
                    ? '답변 확인 대기'
                    : '답변 필요'}
              </span>
            </div>
            <p>{item.reason}</p>
            <ul className="sa-field-links">
              {item.fieldKeys.map((key) => {
                const answer = [...request.commonAnswers, ...request.answers].find(
                  (entry) => entry.key === key,
                );
                return (
                  <li key={key}>
                    <a href={`#answer-${answer?.scope.toLowerCase() ?? 'request'}-${key}`}>
                      {answer?.label ?? key}
                    </a>
                  </li>
                );
              })}
            </ul>
            {item.answer && (
              <blockquote>
                <strong>신청자 답변</strong>
                <p>{item.answer}</p>
              </blockquote>
            )}
            {item.status !== 'RESOLVED' && request.allowedActions.includes('ANSWER_SUPPLEMENT') && (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setPending(true);
                  setError(undefined);
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  try {
                    await workspace.command(request.id, {
                      endpoint: `/supplements/${item.id}/answer`,
                      body: {
                        expectedRevision: request.revision,
                        answer: String(data.get('answer')),
                      },
                    });
                    form.reset();
                  } catch (failure) {
                    setError(failure);
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <label className="sa-field">
                  보완 답변
                  <textarea
                    name="answer"
                    rows={3}
                    required
                    maxLength={4000}
                    disabled={pending}
                    defaultValue={item.answer ?? ''}
                  />
                </label>
                <button className="sa-button sa-secondary" disabled={pending}>
                  보완 답변 보내기
                </button>
              </form>
            )}
            {item.status === 'ANSWERED' &&
              item.field === workspace.actor.role &&
              request.allowedActions.includes('RESOLVE_SUPPLEMENT') && (
                <button
                  className="sa-button sa-secondary"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    setError(undefined);
                    try {
                      await workspace.command(request.id, {
                        endpoint: `/supplements/${item.id}/resolve`,
                        body: { expectedRevision: request.revision },
                      });
                    } catch (failure) {
                      setError(failure);
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  답변 확인 · 보완 해결
                </button>
              )}
          </article>
        ))
      )}
    </section>
  );
}

type Action =
  | 'CONSULT'
  | 'ALLOCATE'
  | 'COMPLETE_REVIEW'
  | 'REQUEST_SUPPLEMENT'
  | 'RETURN'
  | 'SUBMIT'
  | 'FINAL_CONFIRM'
  | 'FINALIZE'
  | 'CLOSE'
  | 'WITHDRAW'
  | 'REASSIGN';
const actionLabels: Record<Action, string> = {
  CONSULT: '담당자 협의 요청',
  ALLOCATE: '서버·IP·포트 할당 완료',
  COMPLETE_REVIEW: '담당 분야 협의 완료',
  REQUEST_SUPPLEMENT: '보완 요청',
  RETURN: '이전 단계로 반환',
  SUBMIT: '서류 제출',
  FINAL_CONFIRM: '현재 제출본 최종 확인',
  FINALIZE: '서류 최종 확정',
  CLOSE: '종결(반려)',
  WITHDRAW: '신청 철회',
  REASSIGN: '담당자 재배정',
};
const endpoints: Record<Action, string> = {
  CONSULT: '/consult',
  ALLOCATE: '/allocation',
  COMPLETE_REVIEW: '/reviews/complete',
  REQUEST_SUPPLEMENT: '/supplements',
  RETURN: '/returns',
  SUBMIT: '/submit',
  FINAL_CONFIRM: '/final-confirmations',
  FINALIZE: '/finalize',
  CLOSE: '/close',
  WITHDRAW: '/withdraw',
  REASSIGN: '/assignments',
};

function ReviewActions({ request }: { request: SecurityRequest }) {
  const workspace = useWorkspace();
  const [action, setAction] = useState<{ type: Action; revision: number; key: string }>();
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [reassignField, setReassignField] = useState<'INFRA' | 'SECURITY'>('INFRA');
  const allocationDone = request.reviews.some(
    (review) => review.field === 'INFRA' && review.allocationCompleted,
  );
  const confirmations = request.finalConfirmations.filter(
    (item) => item.submissionId === request.currentSubmissionId,
  );
  const available = (
    [
      'CONSULT',
      'ALLOCATE',
      'COMPLETE_REVIEW',
      'REQUEST_SUPPLEMENT',
      'SUBMIT',
      'FINAL_CONFIRM',
      'FINALIZE',
      'RETURN',
      'REASSIGN',
      'CLOSE',
      'WITHDRAW',
    ] as Action[]
  ).filter((item) => request.allowedActions.includes(item));
  const primary = available.find(
    (item) => !['REQUEST_SUPPLEMENT', 'RETURN', 'REASSIGN', 'CLOSE', 'WITHDRAW'].includes(item),
  );
  return (
    <>
      <section className="sa-card sa-review-panel">
        <div className="sa-section-heading">
          <h2>담당자 협의</h2>
          <StatusBadge status={request.status} />
        </div>
        <AssignedReviewers request={request} />
        <div className="sa-review-stages">
          <div className={allocationDone ? 'sa-complete' : ''}>
            <span>1</span>
            <div>
              <strong>ICT인프라 할당</strong>
              <p>{allocationDone ? '할당 완료 · 협의와 별개' : '서버·IP·포트 확인 후 할당'}</p>
            </div>
            {allocationDone && <Icon name="check" width={18} height={18} />}
          </div>
          {request.reviews.map((review) => (
            <div key={review.id} className={review.status === 'COMPLETE' ? 'sa-complete' : ''}>
              <span>{review.field === 'INFRA' ? '2' : '3'}</span>
              <div>
                <strong>{FIELD_LABELS[review.field]} 협의</strong>
                <p>
                  {review.status === 'COMPLETE'
                    ? '협의 완료'
                    : review.status === 'RECHECK'
                      ? '변경된 항목 재검토 필요'
                      : review.field === 'SECURITY' && !allocationDone
                        ? '인프라 할당 후 검토 가능'
                        : '담당자 검토 필요'}
                </p>
              </div>
              {review.status === 'COMPLETE' && <Icon name="check" width={18} height={18} />}
            </div>
          ))}
        </div>
        {request.stage === 4 && (
          <div className="sa-final-checklist">
            <h3>현재 제출본 최종 확인</h3>
            {(['INFRA', 'SECURITY'] as const).map((field, index) => (
              <p key={field}>
                <Icon
                  name={confirmations.some((item) => item.field === field) ? 'check' : 'clock'}
                  width={17}
                  height={17}
                />
                <span>
                  {index + 1}. {FIELD_LABELS[field]}
                </span>
                <strong>
                  {confirmations.some((item) => item.field === field) ? '확인 완료' : '확인 대기'}
                </strong>
              </p>
            ))}
            <small>
              같은 제출본에서 인프라 → 보안 확인 후, 배정된 정보보안 담당자가 확정합니다.
            </small>
          </div>
        )}
        {request.blockers.length > 0 && (
          <div className="sa-blockers">
            <strong>진행 전 확인해 주세요</strong>
            <ul>
              {request.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="sa-review-actions">
          {available.map((type) => (
            <button
              className={`sa-button ${type === primary ? 'sa-primary' : ['CLOSE', 'WITHDRAW'].includes(type) ? 'sa-danger-button' : ''}`}
              key={type}
              disabled={
                pending ||
                workspace.pending ||
                (type === 'SUBMIT' && request.blockers.length > 0) ||
                (type === 'COMPLETE_REVIEW' && !allocationDone)
              }
              onClick={() => {
                setError(undefined);
                setAction({ type, revision: request.revision, key: crypto.randomUUID() });
              }}
            >
              {actionLabels[type]}
            </button>
          ))}
        </div>
        {available.length === 0 && (
          <p className="sa-muted">
            현재 역할에서 처리할 동작이 없습니다. 저장된 내용과 이력을 확인할 수 있습니다.
          </p>
        )}
        {message && (
          <p className="sa-action-feedback" role="status">
            {message}
          </p>
        )}
        <p className="sa-panel-footnote">
          {workspace.mode === 'preview'
            ? '시연 동작은 메모리에서만 재현됩니다.'
            : '권한·단계·수정본은 서버에서 다시 확인합니다.'}
        </p>
      </section>
      <Modal
        open={Boolean(action)}
        locked={pending}
        title={action ? actionLabels[action.type] : '업무 처리'}
        onClose={() => {
          if (!pending) setAction(undefined);
        }}
      >
        {action && (
          <form
            className="sa-action-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError(undefined);
              const data = new FormData(event.currentTarget);
              const body: RequestCommand['body'] = { expectedRevision: action.revision };
              if (data.has('reason')) body.reason = String(data.get('reason'));
              if (data.has('comment')) body.comment = String(data.get('comment'));
              if (['RETURN', 'REQUEST_SUPPLEMENT'].includes(action.type))
                body.fieldKeys = data.getAll('fieldKeys').map(String);
              if (action.type === 'RETURN') body.targetStage = Number(data.get('targetStage'));
              if (action.type === 'REASSIGN') body.assigneeId = String(data.get('assigneeId'));
              const endpoint =
                action.type === 'REASSIGN'
                  ? `${endpoints[action.type]}/${reassignField}`
                  : endpoints[action.type];
              try {
                await workspace.command(request.id, {
                  endpoint,
                  body,
                  method: action.type === 'REASSIGN' ? 'PATCH' : 'POST',
                  ...(action.type === 'SUBMIT' ? { idempotencyKey: action.key } : {}),
                });
                setAction(undefined);
                setMessage(
                  `${actionLabels[action.type]} 동작을 ${workspace.mode === 'preview' ? '시연에 반영' : '서버에서 확인'}했습니다.`,
                );
              } catch (failure) {
                setError(failure);
              } finally {
                setPending(false);
              }
            }}
          >
            <ErrorNotice error={error} />
            {action.revision !== request.revision && (
              <div className="sa-callout sa-warning">
                <p>화면을 연 뒤 다른 변경이 저장되었습니다. 취소한 뒤 최신 내용을 확인해 주세요.</p>
              </div>
            )}
            {action.type === 'ALLOCATE' && (
              <p>
                기존 할당 값을 보존하고 할당 완료로 표시합니다. 이 동작만으로 담당자 협의는 완료되지
                않습니다.
              </p>
            )}
            {action.type === 'CONSULT' && (
              <p>
                이 신청에 분야별 담당자를 배정하고 협의를 시작합니다. 같은 사업의 다른 서류는 현재
                단계를 유지합니다.
              </p>
            )}
            {action.type === 'COMPLETE_REVIEW' && (
              <label className="sa-field">
                검토 의견
                <textarea
                  name="comment"
                  rows={3}
                  required
                  maxLength={1000}
                  placeholder="검토한 내용과 확인 사항을 적어 주세요."
                />
              </label>
            )}
            {action.type === 'RETURN' && (
              <>
                <p>기존 값과 이력을 유지하고 선택한 항목을 보완 필요로 표시합니다.</p>
                <label className="sa-field">
                  반환할 단계
                  <select
                    name="targetStage"
                    defaultValue={request.stage === 4 ? '3' : request.stage === 3 ? '2' : '1'}
                  >
                    {(request.stage === 4 ? [3] : request.stage === 3 ? [2, 1] : [1]).map(
                      (stage) => (
                        <option key={stage} value={stage}>
                          {stage}단계 · {STAGE_LABELS[stage - 1]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </>
            )}
            {['RETURN', 'REQUEST_SUPPLEMENT'].includes(action.type) && (
              <fieldset className="sa-return-fields">
                <legend>
                  보완할 항목 <span className="sa-required">1개 이상</span>
                </legend>
                {[...request.commonAnswers, ...request.answers].map((answer) => (
                  <label key={answer.key}>
                    <input type="checkbox" name="fieldKeys" value={answer.key} />
                    {answer.label}
                    <small>{answer.scope === 'CASE' ? '공통' : '이 서류'}</small>
                  </label>
                ))}
              </fieldset>
            )}
            {action.type === 'REASSIGN' && (
              <>
                <label className="sa-field">
                  담당 분야
                  <select
                    value={reassignField}
                    onChange={(event) =>
                      setReassignField(event.target.value as 'INFRA' | 'SECURITY')
                    }
                  >
                    <option value="INFRA">ICT인프라</option>
                    <option value="SECURITY">정보보안</option>
                  </select>
                </label>
                <label className="sa-field">
                  새 담당자
                  <select name="assigneeId" required key={reassignField}>
                    <option value="">선택해 주세요</option>
                    {workspace.pools
                      .find((pool) => pool.field === reassignField)
                      ?.reviewers.filter((reviewer) => reviewer.userId !== request.ownerId)
                      .map((reviewer) => (
                        <option key={reviewer.userId} value={reviewer.userId}>
                          {reviewer.displayName}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
            {['RETURN', 'REQUEST_SUPPLEMENT', 'CLOSE', 'WITHDRAW', 'REASSIGN'].includes(
              action.type,
            ) && (
              <label className="sa-field">
                사유 <span className="sa-required">필수</span>
                <textarea name="reason" rows={3} required maxLength={1000} />
              </label>
            )}
            {['SUBMIT', 'FINAL_CONFIRM', 'FINALIZE'].includes(action.type) && (
              <>
                <div className="sa-callout">
                  <Icon name="info" />
                  <p>
                    {action.type === 'SUBMIT'
                      ? '현재 공통 정보와 서류 내용을 불변 제출본으로 보존합니다. AI의 최종 초안도 사람이 확인한 뒤 제출해야 합니다.'
                      : action.type === 'FINAL_CONFIRM'
                        ? '현재 제출본을 담당 분야에서 확인했다는 기록입니다. 다른 제출본의 확인은 재사용되지 않습니다.'
                        : '정보보안 담당자가 이 제출본의 서류를 최종 확정합니다. 방화벽 실제 적용은 이후 ICT인프라 담당자가 별도로 기록합니다.'}
                  </p>
                </div>
                <label className="sa-confirm-action">
                  <input type="checkbox" required />
                  내용과 처리 의미를 확인했습니다.
                </label>
              </>
            )}
            {['CLOSE', 'WITHDRAW'].includes(action.type) && (
              <p>종료 후에는 이 신청을 수정할 수 없습니다. 기존 내용과 처리 이력은 보존합니다.</p>
            )}
            <div className="sa-dialog-actions">
              <button
                type="button"
                className="sa-button"
                disabled={pending}
                onClick={() => setAction(undefined)}
              >
                취소
              </button>
              <button
                className="sa-button sa-primary"
                type="submit"
                disabled={pending || action.revision !== request.revision}
              >
                {pending ? '처리 중…' : actionLabels[action.type]}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/** 작성·협의·최종 검토·확정을 한 상세에서 역할과 서버 허용 행동에 따라 연결한다. */
export function RequestDetail({ request }: { request: SecurityRequest }) {
  const workspace = useWorkspace();
  const [tab, setTab] = useState<'document' | 'history'>('document');
  const businessCase = workspace.cases.find((item) => item.id === request.caseId);
  const reasons: Record<string, string> = {};
  request.returns.forEach((item) =>
    item.fieldKeys.forEach((key) => {
      reasons[key] = item.reason;
    }),
  );
  request.supplements
    .filter((item) => item.status !== 'RESOLVED')
    .forEach((item) =>
      item.fieldKeys.forEach((key) => {
        reasons[key] = item.reason;
      }),
    );
  const isTerminal = ['FINALIZED', 'CLOSED', 'WITHDRAWN'].includes(request.status);
  const isSnapshot = request.stage === 4 || isTerminal;
  const highlighted = isSnapshot
    ? []
    : [...new Set([...request.highlightedFields, ...request.changedCommonFields])];
  return (
    <>
      <Link className="sa-back-link" href={workspacePath(workspace.mode, '/security-requests')}>
        <Icon name="back" width={18} height={18} />
        신청 현황
      </Link>
      <PageHeading
        title={request.caseTitle}
        description={`${businessCase?.department ?? '사업 건'} · ${request.ownerName} · ${DOCUMENT_LABELS[request.docType]}`}
        eyebrow={`신청 ${request.id.slice(-8).toUpperCase()}`}
      >
        <StatusBadge status={request.status} />
        {workspace.mode === 'live' && request.allowedActions.includes('DOWNLOAD') && (
          <a
            className="sa-button"
            href={`/api/security-requests/${encodeURIComponent(request.id)}/document`}
            download
          >
            <Icon name="download" width={18} height={18} />
            서류 내려받기
          </a>
        )}
      </PageHeading>
      <StageProgress stage={request.stage} expanded />
      {request.returns.length > 0 && (
        <div className="sa-callout sa-warning">
          <Icon name="info" />
          <div>
            <strong>반환 이력이 있습니다 · 기존 작성 내용 보존</strong>
            <p>{request.returns.at(-1)?.reason}</p>
            <small>
              {isSnapshot
                ? '이전 반환 기록입니다. 현재 표시된 내용은 보존됩니다.'
                : '아래의 ‘보완 필요’ 항목을 확인해 주세요.'}
            </small>
          </div>
        </div>
      )}
      {request.changedCommonFields.length > 0 && (
        <div className="sa-callout sa-warning">
          <Icon name="info" />
          <p>
            {isSnapshot
              ? `공통 정보가 변경되었습니다. 이 화면의 ${request.stage === 4 ? '제출본·확정본' : '종료 당시 초안(미제출)'}은 변경되지 않고 보존됩니다.`
              : '공통 정보가 바뀌었습니다. 영향을 받은 항목과 담당 분야의 협의를 다시 확인해 주세요.'}
          </p>
        </div>
      )}
      {request.stage === 3 && !isTerminal && (
        <div className="sa-callout">
          <Icon name="sparkle" />
          <p>
            <strong>사용자 최종 검토</strong> · AI 최종 초안은 미확정입니다. 출처와 근거를 확인하고
            미확정 값을 사람이 확인한 뒤 제출해 주세요.
          </p>
        </div>
      )}
      {request.status === 'FINALIZED' && (
        <div className="sa-callout sa-success">
          <Icon name="check" />
          <p>
            서류가 확정되었습니다. 방화벽이 실제 적용되었다는 뜻은 아닙니다. 이후 적용 기록은 별도의
            정책 수명주기 기능에서 관리합니다.
          </p>
        </div>
      )}
      <div className="sa-detail-grid">
        <div className="sa-detail-main">
          <div
            className="sa-tabs"
            role="tablist"
            aria-label="신청 상세 보기"
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === 'Home'
                  ? 'document'
                  : event.key === 'End'
                    ? 'history'
                    : tab === 'document'
                      ? 'history'
                      : 'document';
              setTab(next);
              event.currentTarget.querySelector<HTMLButtonElement>(`#request-${next}-tab`)?.focus();
            }}
          >
            <button
              role="tab"
              aria-selected={tab === 'document'}
              id="request-document-tab"
              tabIndex={tab === 'document' ? 0 : -1}
              aria-controls="request-document"
              onClick={() => setTab('document')}
            >
              작성 내용
            </button>
            <button
              role="tab"
              aria-selected={tab === 'history'}
              id="request-history-tab"
              tabIndex={tab === 'history' ? 0 : -1}
              aria-controls="request-history"
              onClick={() => setTab('history')}
            >
              처리 이력
            </button>
          </div>
          <div
            id="request-document"
            role="tabpanel"
            aria-labelledby="request-document-tab"
            hidden={tab !== 'document'}
          >
            <section className="sa-card">
              <div className="sa-section-heading">
                <h2>사업 공통 정보</h2>
                <Link
                  className="sa-text-button"
                  href={workspacePath(workspace.mode, `/business-cases/${request.caseId}`)}
                >
                  사업 건 보기 <Icon name="arrow" width={16} height={16} />
                </Link>
              </div>
              <div className="sa-document-meta">
                <span>공통 정보 v{request.caseRevision}</span>
                <span>설정 게시본 v{request.publicationVersion}</span>
                <span>신청 수정본 v{request.revision}</span>
              </div>
              {request.stage === 4 || !request.allowedActions.includes('EDIT_CASE') ? (
                request.commonAnswers.map((answer) => (
                  <AnswerReadout
                    key={answer.key}
                    answer={answer}
                    highlighted={highlighted.includes(answer.key)}
                    reason={reasons[answer.key]}
                  />
                ))
              ) : (
                <AnswerEditor
                  key={`${request.caseId}:${workspace.actor.userId}:common`}
                  answers={request.commonAnswers}
                  actorRole={workspace.actor.role}
                  revision={request.caseRevision}
                  save={(revision, answers) =>
                    workspace.saveCase(request.caseId, revision, answers)
                  }
                  highlightedFields={highlighted}
                  reasons={reasons}
                  memory={
                    workspace.mode === 'live'
                      ? {
                          scope: `${workspace.actor.institutionId}:${workspace.actor.userId}`,
                          key: `starter-case:${request.caseId}`,
                        }
                      : undefined
                  }
                />
              )}
            </section>
            <section className="sa-card">
              <div className="sa-section-heading">
                <h2>{DOCUMENT_LABELS[request.docType]} 추가 질문</h2>
                <span className="sa-badge sa-neutral">이 서류에만 반영</span>
              </div>
              <AnswerEditor
                key={`${request.id}:${workspace.actor.userId}`}
                answers={request.answers}
                actorRole={workspace.actor.role}
                revision={request.revision}
                disabled={!request.allowedActions.includes('EDIT_ANSWERS')}
                save={(revision, answers) =>
                  workspace.command(request.id, {
                    endpoint: '/answers',
                    method: 'PATCH',
                    body: { expectedRevision: revision, answers },
                  })
                }
                highlightedFields={highlighted}
                reasons={reasons}
                memory={
                  workspace.mode === 'live'
                    ? {
                        scope: `${workspace.actor.institutionId}:${workspace.actor.userId}`,
                        key: `starter-request:${request.id}`,
                      }
                    : undefined
                }
              />
            </section>
            <SupplementPanel request={request} />
          </div>
          <div
            id="request-history"
            role="tabpanel"
            aria-labelledby="request-history-tab"
            hidden={tab !== 'history'}
          >
            <section className="sa-card">
              <h2>반환·보완 이력</h2>
              {request.returns.length ? (
                <ol className="sa-timeline">
                  {request.returns.map((item) => (
                    <li key={item.id}>
                      <time>{formatDate(item.createdAt)}</time>
                      <div>
                        <strong>
                          {item.fromStage}단계 → {item.targetStage}단계 반환
                        </strong>
                        <span>{item.actorName}</span>
                        <p>{item.reason}</p>
                        <small>
                          지정 항목:{' '}
                          {item.fieldKeys
                            .map(
                              (key) =>
                                [...request.commonAnswers, ...request.answers].find(
                                  (answer) => answer.key === key,
                                )?.label ?? key,
                            )
                            .join(', ')}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="sa-muted">반환 이력이 없습니다.</p>
              )}
            </section>
            <section className="sa-card">
              <h2>감사·처리 이력</h2>
              {workspace.mode === 'live' ? (
                <LiveAudit id={request.id} />
              ) : (
                <AuditTimeline
                  events={workspace.auditEvents.filter((event) => event.targetId === request.id)}
                />
              )}
            </section>
          </div>
          <section className="sa-card">
            <h2>제출본 관리</h2>
            {request.submissions.length ? (
              request.submissions.map((submission) => (
                <div className="sa-submission" key={submission.id}>
                  <div>
                    <strong>제출본 {submission.number}</strong>
                    <span className="sa-meta">
                      {formatDate(submission.createdAt)} · 공통 v{submission.caseRevision} / 신청 v
                      {submission.requestRevision}
                    </span>
                  </div>
                  <span className="sa-badge sa-neutral">
                    {request.currentSubmissionId === submission.id
                      ? '현재 제출본'
                      : '이전 제출본 · 보존'}
                  </span>
                  <ul>
                    {request.finalConfirmations
                      .filter((item) => item.submissionId === submission.id)
                      .map((item) => (
                        <li key={item.id}>
                          <Icon name="check" width={16} height={16} />
                          {FIELD_LABELS[item.field]} · {item.actorName} 확인
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="sa-muted">
                {isTerminal
                  ? `${request.status === 'CLOSED' ? '종결(반려)' : '철회'} 당시 초안 · 미제출입니다. 종료 당시의 값을 보존하며 수정·제출할 수 없습니다.`
                  : '아직 제출하지 않은 초안입니다. 제출하면 공통 정보와 서류 내용이 함께 보존됩니다.'}
              </p>
            )}
          </section>
        </div>
        <aside className="sa-detail-aside">
          <ReviewActions request={request} />
          <section className="sa-card">
            <h2>처리 기한</h2>
            <DeadlineBadge request={request} preview={workspace.mode === 'preview'} />
            <p className="sa-panel-footnote">
              서버가 영업일 기준으로 정한 기한입니다. 기한 경과는 상태를 바꾸지 않습니다.
              {workspace.mode === 'preview' && ' 시연 기한은 고정된 예시입니다.'}
            </p>
            {request.deadlines.filter((item) => !item.active).length > 0 && (
              <details className="sa-evidence">
                <summary>종료된 기한 이력</summary>
                {request.deadlines
                  .filter((item) => !item.active)
                  .map((item) => (
                    <p key={item.id}>{formatDate(item.dueAt)} · 종료</p>
                  ))}
              </details>
            )}
          </section>
          <section className="sa-card">
            <h2>같은 사업의 서류</h2>
            <div className="sa-related">
              {workspace.requests
                .filter((item) => item.caseId === request.caseId && item.id !== request.id)
                .map((item) => (
                  <Link
                    key={item.id}
                    href={workspacePath(workspace.mode, `/security-requests/${item.id}`)}
                  >
                    <strong>{DOCUMENT_LABELS[item.docType]}</strong>
                    <StatusBadge status={item.status} />
                    <Icon name="arrow" width={16} height={16} />
                  </Link>
                ))}
            </div>
            <p className="sa-panel-footnote">
              한 신청의 반환·제출은 다른 신청의 상태를 바꾸지 않습니다.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
