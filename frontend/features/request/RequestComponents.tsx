import type { ReactNode } from 'react';
import { Icon } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/sharedTypes';
import {
  DOCUMENT_LABELS,
  FIELD_LABELS,
  STAGE_LABELS,
  STATUS_LABELS,
  type Answer,
  type RequestStatus,
  type SecurityRequest,
} from './types';

/** 중요한 행동을 제목 오른쪽에 배치하는 시안의 공통 페이지 헤더다. */
export function PageHeading({
  title,
  description,
  children,
  eyebrow,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="sa-heading">
      <div>
        {eyebrow && <p className="sa-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="sa-heading-actions">{children}</div>}
    </div>
  );
}
/** 상태 이름은 시안의 예시 문구 대신 기능 명세의 단계×상태 계약을 따른다. */
export function StatusBadge({ status }: { status: RequestStatus }) {
  const tone =
    status === 'FINALIZED'
      ? 'success'
      : status === 'SUPPLEMENT_REQUESTED'
        ? 'warning'
        : status === 'CLOSED'
          ? 'danger'
          : ['DRAFT', 'WITHDRAWN'].includes(status)
            ? 'neutral'
            : 'info';
  return <span className={`sa-badge sa-${tone}`}>{STATUS_LABELS[status]}</span>;
}
/** 출처 네 종류와 사람의 확인 정보를 분리해 AI 근거가 사라지지 않게 한다. */
export function SourceBadge({ answer }: { answer: Answer }) {
  const label =
    answer.source === 'USER_ANSWER'
      ? '사용자 답변'
      : answer.source === 'AI_INFERRED'
        ? 'AI 추론'
        : answer.source === 'STAFF_INPUT'
          ? '담당자 입력'
          : answer.source === 'STAFF_CONFIRMED'
            ? '담당자 확인'
            : '담당자 확인 필요';
  return (
    <span className={`sa-source${answer.source === 'AI_INFERRED' ? ' sa-source-ai' : ''}`}>
      <Icon
        name={answer.source === 'AI_INFERRED' ? 'sparkle' : answer.confirmed ? 'check' : 'info'}
        width={14}
        height={14}
      />
      {label}
      {answer.source === 'AI_INFERRED' && (
        <span>· {answer.confirmed ? '사람 확인' : '미확정'}</span>
      )}
    </span>
  );
}
/** 단계 색상과 텍스트를 같이 제공하며 할당 여부를 단계 완료로 표시하지 않는다. */
export function StageProgress({ stage, expanded = false }: { stage: number; expanded?: boolean }) {
  if (expanded)
    return (
      <ol className="sa-stepper" aria-label="신청 처리 단계">
        {STAGE_LABELS.map((label, index) => (
          <li
            key={label}
            className={`sa-stage-${index + 1}${stage === index + 1 ? ' sa-current' : ''}${stage > index + 1 ? ' sa-done' : ''}`}
            aria-current={stage === index + 1 ? 'step' : undefined}
          >
            <span>
              {stage > index + 1 ? <Icon name="check" width={17} height={17} /> : index + 1}
            </span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
    );
  return (
    <div className="sa-progress">
      <span>
        {stage}단계 · {STAGE_LABELS[stage - 1]}
      </span>
      <div aria-hidden="true">
        {STAGE_LABELS.map((label, index) => (
          <i key={label} className={index < stage ? `sa-stage-${index + 1}` : ''} />
        ))}
      </div>
    </div>
  );
}
/** 활성 배정자와 분야별 협의 결과를 분리해 보여준다. */
export function AssignedReviewers({ request }: { request: SecurityRequest }) {
  if (!request.assignments.some((item) => item.active))
    return <span className="sa-muted">협의 요청 후 배정</span>;
  return (
    <ul className="sa-assignees">
      {(['INFRA', 'SECURITY'] as const).map((field) => {
        const assignment = request.assignments.find((item) => item.field === field && item.active);
        const review = request.reviews.find((item) => item.field === field);
        const complete = review?.status === 'COMPLETE';
        return (
          <li key={field}>
            <span>{FIELD_LABELS[field]}</span>
            <strong>{assignment?.assigneeName ?? '미배정'}</strong>
            <span className={`sa-review-dot ${complete ? 'sa-success' : 'sa-muted'}`}>
              {complete ? '협의 완료' : review?.allocationCompleted ? '할당 완료' : '대기'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
/** 처리 기한은 서버 응답을 표시하고 경과를 업무 상태 전이로 해석하지 않는다. */
export function DeadlineBadge({
  request,
  preview = false,
}: {
  request: SecurityRequest;
  preview?: boolean;
}) {
  const deadline = request.deadlines
    .filter((item) => item.active)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  if (!deadline) return <span className="sa-muted">—</span>;
  const calendarDate = (value: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Seoul',
    }).format(value);
  const today = preview ? '2026-11-07' : calendarDate(new Date());
  const days = Math.round(
    (Date.parse(`${calendarDate(new Date(deadline.dueAt))}T00:00:00Z`) -
      Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );
  const label = days < 0 ? `D+${Math.abs(days)}` : days === 0 ? 'D-0' : `D-${days}`;
  return (
    <div className="sa-deadline">
      <span
        className={`sa-badge ${deadline.timing === 'OVERDUE' ? 'sa-danger' : deadline.timing === 'DUE_SOON' ? 'sa-warning' : 'sa-neutral'}`}
      >
        {label}
        <span className="sr-only">
          {deadline.timing === 'OVERDUE' ? ' 기한 경과' : ' 처리 기한'}
        </span>
      </span>
      <small>{formatDate(deadline.dueAt)}</small>
    </div>
  );
}
/** 시간대에 따른 렌더링 차이를 줄이면서 한국어 날짜를 표시한다. */
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}
/** 필드의 출처·미확정·반환 사유를 값과 함께 읽을 수 있게 한다. */
export function AnswerReadout({
  answer,
  highlighted,
  reason,
  idPrefix = 'answer',
}: {
  answer: Answer;
  highlighted?: boolean;
  reason?: string;
  idPrefix?: string;
}) {
  return (
    <div
      className={`sa-answer${highlighted ? ' sa-answer-highlight' : ''}`}
      id={`${idPrefix}-${answer.scope.toLowerCase()}-${answer.key}`}
    >
      <div className="sa-answer-label">
        <strong>{answer.label}</strong>
        <span>{ROLE_LABELS[answer.ownerRole]}</span>
        {highlighted && (
          <b className="sa-highlight-label">
            <Icon name="info" width={14} height={14} />
            보완 필요
          </b>
        )}
      </div>
      <p className={!answer.value ? 'sa-muted' : ''}>
        {answer.notApplicable ? '해당 없음' : answer.value || '담당자가 확인할 항목입니다.'}
      </p>
      <div className="sa-answer-meta">
        <SourceBadge answer={answer} />
        {answer.confirmed ? (
          <span className="sa-confirmed">
            <Icon name="check" width={14} height={14} />
            {answer.confirmation?.actorName ?? '사람'} 확인
          </span>
        ) : (
          answer.value && <span className="sa-unconfirmed">미확정</span>
        )}
      </div>
      {answer.evidence && (
        <details className="sa-evidence">
          <summary>추론 근거 보기</summary>
          <p>{answer.evidence}</p>
        </details>
      )}
      {highlighted && reason && <p className="sa-return-reason">보완 사유: {reason}</p>}
    </div>
  );
}
/** 다음 행동은 업무 상태와 서버 표시 힌트에서만 안내한다. */
export function nextAction(request: SecurityRequest) {
  if (request.status === 'FINALIZED') return '서류 확정 · 실제 적용은 별도';
  if (request.status === 'CLOSED' || request.status === 'WITHDRAWN') return '이력 조회';
  if (request.allowedActions.includes('FINALIZE')) return '서류 최종 확정';
  if (request.allowedActions.includes('FINAL_CONFIRM')) return '제출본 확인';
  if (request.allowedActions.includes('ALLOCATE')) return '서버·IP·포트 할당';
  if (request.allowedActions.includes('COMPLETE_REVIEW')) return '담당 분야 검토';
  if (request.allowedActions.includes('SUBMIT')) return '내용 확인 후 제출';
  if (request.status === 'SUPPLEMENT_REQUESTED') return '보완 답변 확인';
  if (request.stage === 1) return '공통 정보와 서류 작성';
  return request.stage === 2
    ? '담당자 협의 대기'
    : request.stage === 4
      ? '담당자 최종 확인 대기'
      : '신청자 최종 검토';
}
/** 문서 제목을 한곳에서 구성해 사업 건과 서류 유형을 혼동하지 않게 한다. */
export function requestTitle(request: SecurityRequest) {
  return `${request.caseTitle} · ${DOCUMENT_LABELS[request.docType]}`;
}
