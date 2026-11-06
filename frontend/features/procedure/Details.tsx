'use client';
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession, useMemoryDraft } from '@/features/auth';
import { type Procedure } from './types';
import { type Role, ROLE_LABELS } from '@/lib/sharedTypes';
import { downloadDocument } from '@/lib/http';
import { documentLabel, formatAnswerValue, formatDate, shortId } from '@/lib/format';
import { Badge, Heading, Notice, Icon, Stepper, Modal, ErrorNotice } from '@/components/ui';
import { EvidenceList, AnswerEditor, AnswerFields, toDraftAnswer } from './AnswerEditor';
import { NetworkTable } from './Network';
import { ProcedureBadge } from './Overview';
import { useProcedureMutation } from './useProcedures';

/** 문서 내용을 React 텍스트로 렌더링해 업로드·AI 출력의 HTML이나 명령문을 실행하지 않는다. */
export function DocumentPreview({ procedure }: { procedure: Procedure }) {
  const submitted = ['SUBMITTED', 'RECEIVED'].includes(procedure.status);
  return (
    <article className="document-preview">
      <p className="draft-watermark">
        {submitted ? '제출 시점에 고정된 제출본 · 읽기전용' : '검토 초안 · 미확정 항목 포함 가능'}
      </p>
      <h3>{documentLabel(procedure.documentType)}</h3>
      <p>{procedure.title}</p>
      <p className="source-meta">
        신청번호 {shortId(procedure.id)} · 수정본 v{procedure.revision} · 기관 설정 v
        {procedure.policyVersion}
      </p>
      <dl>
        {procedure.answers.map((answer) => (
          <div key={answer.key}>
            <dt>{answer.label}</dt>
            <dd>{formatAnswerValue(answer.key, answer.value)}</dd>
            <dd className="source-meta">
              {answer.source?.kind === 'AI_INFERENCE'
                ? 'AI 제안'
                : answer.source?.kind === 'USER_ANSWER'
                  ? '사용자 답변'
                  : answer.source
                    ? '담당자 입력'
                    : '출처 없음 · 담당자 확인 필요'}{' '}
              ·{' '}
              {answer.status === 'CONFIRMED' || answer.status === 'NOT_APPLICABLE'
                ? '확인 완료'
                : '미확정'}
            </dd>
            {answer.source?.evidence && (
              <dd className="source-meta">근거: {answer.source.evidence}</dd>
            )}
          </div>
        ))}
      </dl>
      {procedure.documentType === 'FIREWALL' && <NetworkTable procedure={procedure} />}
      <p className="source-meta">{procedure.policy.documentFooter}</p>
      <p className="source-meta">
        검토·접수 상태는 실제 방화벽 적용이나 서비스 운영 승인을 의미하지 않습니다.
      </p>
    </article>
  );
}
/** 읽기 미리보기와 서버 문서 다운로드를 구분하고 공개 시안에서는 다운로드를 비활성화한다. */
export function DocumentPanel({
  procedure,
  preview = false,
  compact = false,
}: {
  procedure: Procedure;
  preview?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const submitted = ['SUBMITTED', 'RECEIVED'].includes(procedure.status);
  return (
    <section className={compact ? undefined : 'sf-panel'}>
      {!compact && (
        <div className="panel-heading">
          <h2>문서</h2>
          <Badge tone={submitted ? 'green' : 'gray'}>{submitted ? '제출본' : '검토 초안'}</Badge>
        </div>
      )}
      <ErrorNotice error={error} />
      <div className={compact ? 'document-card-actions' : 'document-row'}>
        {!compact && (
          <>
            <span className="document-symbol">
              <Icon name="file" width={26} height={26} />
            </span>
            <div>
              <h3>
                {documentLabel(procedure.documentType)} {submitted ? '제출본' : '초안'}
              </h3>
              <p>
                수정본 v{procedure.revision} · 기관 설정 v{procedure.policyVersion} ·{' '}
                {formatDate(procedure.updatedAt, true)}
              </p>
            </div>
          </>
        )}
        <button className="button" type="button" onClick={() => setOpen(true)}>
          미리보기
        </button>
        <button
          className="text-button"
          type="button"
          disabled={preview || busy}
          onClick={() => {
            setBusy(true);
            setError(undefined);
            void downloadDocument(procedure.id)
              .catch(setError)
              .finally(() => setBusy(false));
          }}
        >
          <Icon name="download" width={18} height={18} />
          HTML 다운로드
        </button>
      </div>
      <Modal
        open={open}
        title={submitted ? '제출본 확인' : '검토 초안 미리보기'}
        onClose={() => setOpen(false)}
      >
        <DocumentPreview procedure={procedure} />
        <div className="dialog-actions">
          <button className="button primary" type="button" onClick={() => setOpen(false)}>
            닫기
          </button>
        </div>
      </Modal>
    </section>
  );
}
/** 내용 변경으로 무효화되었거나 다른 수정본의 검토는 완료로 보이지 않게 한다. */
export function ReviewProgress({ procedure }: { procedure: Procedure }) {
  return (
    <div className="review-progress">
      {procedure.reviews.map((review) => (
        <div key={review.role}>
          <span>{ROLE_LABELS[review.role]}</span>
          <Badge
            tone={
              review.status === 'COMPLETE' && review.revision === procedure.revision
                ? 'green'
                : review.status === 'INVALIDATED'
                  ? 'amber'
                  : 'gray'
            }
          >
            {review.status === 'COMPLETE' && review.revision === procedure.revision
              ? '검토 완료'
              : review.status === 'INVALIDATED'
                ? '재확인 필요'
                : '검토 대기'}
          </Badge>
        </div>
      ))}
    </div>
  );
}
/** 출처·협의 이력과 담당자 검토를 지정 시안의 두 열로 나누되 모바일에서는 순서대로 읽게 한다. */
export function DetailView({
  procedure,
  step,
  aside,
  children,
  preview = false,
}: {
  procedure: Procedure;
  step: string;
  aside: ReactNode;
  children?: ReactNode;
  preview?: boolean;
}) {
  const current = ['SUBMITTED', 'RECEIVED'].includes(procedure.status)
    ? 3
    : step === 'submit' || step === 'supplement'
      ? 2
      : 1;
  return (
    <>
      <div className="breadcrumb">
        <Link href={preview ? '/design-preview/requests' : '/requests'}>목록으로</Link>
        <span>/</span>
        <span>협의 상세</span>
      </div>
      <Heading
        title={procedure.title}
        description={`${shortId(procedure.id)} · ${procedure.department} · ${procedure.ownerName}`}
      >
        <Link className="button" href={preview ? '/design-preview/requests' : '/requests'}>
          <Icon name="back" />
          목록으로
        </Link>
      </Heading>
      <div className="detail-meta">
        <ProcedureBadge item={procedure} />
        <span>기관 설정 v{procedure.policyVersion}</span>
        <span>
          {procedure.policy.reviewMode === 'PARALLEL'
            ? '병렬 검토'
            : '정보보안 후 ICT인프라 순차 검토'}
        </span>
        <span className="right">신청 수정본 v{procedure.revision}</span>
      </div>
      <Stepper current={current} detail />
      {!preview && (
        <nav className="subnavigation" aria-label="협의 상세 보기">
          {[
            ['summary', '신청 요약'],
            ['questions', '기관별 질문'],
            ['security', '정보보안'],
            ['infra', 'ICT인프라'],
            ['supplement', '보완'],
            ['submit', '최종 제출'],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={`/requests/${procedure.id}/${key}`}
              aria-current={step === key ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      <div className="detail-grid">
        <div className="detail-main">
          <section className="sf-panel">
            <div className="panel-heading">
              <h2>사업 개요</h2>
              <Badge>신청자 작성</Badge>
            </div>
            <p className="summary-text readonly-value">{procedure.description}</p>
            <dl className="inline-facts">
              <div>
                <dt>이용 대상</dt>
                <dd>
                  {procedure.answers.find((answer) => answer.key === 'audience')?.value ||
                    '담당자 확인 필요'}
                </dd>
              </div>
              <div>
                <dt>요청 문서</dt>
                <dd>{documentLabel(procedure.documentType)}</dd>
              </div>
              <div>
                <dt>실제 처리</dt>
                <dd>이 서비스에서 적용하지 않음</dd>
              </div>
            </dl>
          </section>
          {children}
          <section className="sf-panel">
            <div className="panel-heading">
              <h2>수집 정보와 원문 근거</h2>
              <span className="muted">
                {
                  procedure.answers.filter(
                    (answer) => !['CONFIRMED', 'NOT_APPLICABLE'].includes(answer.status),
                  ).length
                }
                개 확인 필요
              </span>
            </div>
            <Notice>AI 제안은 검토할 정보 후보입니다. 담당자가 실제 근거를 확인해야 합니다.</Notice>
            <EvidenceList answers={procedure.answers} />
          </section>
          <DocumentPanel procedure={procedure} preview={preview} />
          <section className="sf-panel">
            <div className="panel-heading">
              <h2>협의 이력</h2>
              <Icon name="clock" />
            </div>
            <ol className="timeline">
              {procedure.timeline.map((event) => (
                <li key={event.id}>
                  <span className="timeline-dot" />
                  <div>
                    <p>{event.description}</p>
                    <small>
                      {event.actorName} · {formatDate(event.at, true)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            {!procedure.timeline.length && <p className="muted">기록된 협의 이력이 없습니다.</p>}
          </section>
        </div>
        <aside className="review-aside">
          {aside}
          <div className="aside-guidance">
            <Icon name="shield" />
            <p>
              검토 기록과 제출본은 기관 설정 버전과 함께 관리합니다. 검토 완료와 실제 처리 완료를
              구분합니다.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
/** 합성 담당자 화면을 같은 폼으로 보여 주면서 모든 업무 변경은 비활성화한다. */
export function PreviewReview({ procedure, role }: { procedure: Procedure; role: Role }) {
  const fields = procedure.answers.filter((answer) => answer.ownerRole === role);
  return (
    <section className="sf-panel review-panel">
      <div className="review-title">
        <Icon name={role === 'INFRA' ? 'server' : 'shield'} width={30} height={30} />
        <div>
          <h2>{ROLE_LABELS[role]} 검토</h2>
          <p>담당 분야의 확인 내용을 기록합니다.</p>
        </div>
      </div>
      <ReviewProgress procedure={procedure} />
      <AnswerFields answers={fields} values={fields.map(toDraftAnswer)} disabled />
      <label htmlFor="preview-comment">검토 의견</label>
      <textarea
        id="preview-comment"
        className="review-notes"
        rows={3}
        placeholder="확인한 내용과 보완 사항을 기록합니다."
        disabled
      />
      <div className="review-buttons">
        <button className="button primary full" disabled>
          검토 완료
        </button>
        <button className="button full" disabled>
          보완 요청
        </button>
      </div>
      <p className="role-caption">읽기전용 디자인 시안 · 변경 기능 비활성</p>
    </section>
  );
}
/** 자기 담당 분야의 답변과 의견만 편집하며 최종 검토 가능 여부는 서버 allowedActions를 따른다. */
export function ReviewPanel({
  procedure,
  role,
}: {
  procedure: Procedure;
  role: 'SECURITY' | 'INFRA';
}) {
  const { user } = useSession();
  const mutation = useProcedureMutation(procedure.id);
  const [comment, setComment] = useMemoryDraft(`review:${procedure.id}:${role}`, '');
  const [question, setQuestion] = useMemoryDraft(`supplement-request:${procedure.id}`, '');
  const [modal, setModal] = useState<'REVIEW' | 'SUPPLEMENT'>();
  const [success, setSuccess] = useState('');
  const mine = user.role === role;
  async function confirm() {
    try {
      await mutation.mutateAsync({
        endpoint: modal === 'REVIEW' ? '/review' : '/supplements',
        body:
          modal === 'REVIEW'
            ? { expectedRevision: procedure.revision, comment }
            : { expectedRevision: procedure.revision, question },
      });
      setSuccess(
        modal === 'REVIEW'
          ? '현재 수정본의 검토 완료를 기록했습니다.'
          : '보완 요청을 신청자에게 등록했습니다.',
      );
      setModal(undefined);
      setQuestion('');
    } catch {
      setModal(undefined);
    }
  }
  return (
    <section className="sf-panel review-panel">
      <div className="review-title">
        <Icon name={role === 'INFRA' ? 'server' : 'shield'} width={30} height={30} />
        <div>
          <h2>{ROLE_LABELS[role]} 검토</h2>
          <p>담당 분야의 확인 내용을 기록합니다.</p>
        </div>
      </div>
      <ReviewProgress procedure={procedure} />
      <ErrorNotice error={mutation.error} />
      {mine ? (
        <>
          <AnswerEditor procedure={procedure} compact />
          <div className="sf-field">
            <label htmlFor="review-comment">검토 의견</label>
            <textarea
              id="review-comment"
              rows={3}
              maxLength={2000}
              value={comment}
              disabled={!procedure.allowedActions.includes('EDIT') || mutation.isPending}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          <div className="review-buttons">
            <button
              className="button primary full"
              type="button"
              disabled={!procedure.allowedActions.includes('REVIEW') || mutation.isPending}
              onClick={() => setModal('REVIEW')}
            >
              검토 완료
            </button>
            <button
              className="button full"
              type="button"
              disabled={!procedure.allowedActions.includes('SUPPLEMENT') || mutation.isPending}
              onClick={() => setModal('SUPPLEMENT')}
            >
              보완 요청
            </button>
          </div>
          {!procedure.allowedActions.includes('REVIEW') && (
            <p className="role-caption">
              자기 분야의 필수 답변, 통신 정보와 선행 검토가 완료되어야 검토를 확정할 수 있습니다.
            </p>
          )}
        </>
      ) : (
        <Notice>
          이 분야의 검토 기록은 {ROLE_LABELS[role]} 계정으로 작성합니다. 현재 화면에서는 저장된
          내용을 확인할 수 있습니다.
        </Notice>
      )}
      {success && (
        <p className="action-feedback" role="status">
          {success}
        </p>
      )}
      <Modal
        open={Boolean(modal)}
        title={modal === 'REVIEW' ? '검토 완료 확인' : '신청자에게 보완 요청'}
        onClose={() => setModal(undefined)}
      >
        {modal === 'REVIEW' ? (
          <>
            <p>
              수정본 v{procedure.revision}의 {ROLE_LABELS[role]} 검토를 완료합니다.
            </p>
            <Notice>
              이후 답변이나 통신 규칙이 바뀌면 다시 확인해야 합니다. 실제 방화벽 적용은 수행하지
              않습니다.
            </Notice>
            <p>{comment || '별도 검토 의견 없음'}</p>
          </>
        ) : (
          <div className="sf-field">
            <label htmlFor="supplement-question">
              확인이 필요한 내용 <span className="required">필수</span>
            </label>
            <textarea
              id="supplement-question"
              rows={4}
              maxLength={2000}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="신청자가 이해할 수 있도록 확인 목적과 필요한 정보를 구체적으로 적어 주세요."
            />
          </div>
        )}
        <div className="dialog-actions">
          <button className="button" type="button" onClick={() => setModal(undefined)}>
            취소
          </button>
          <button
            className="button primary"
            type="button"
            disabled={mutation.isPending || (modal === 'SUPPLEMENT' && !question.trim())}
            onClick={() => void confirm()}
          >
            {mutation.isPending
              ? '처리 중…'
              : modal === 'REVIEW'
                ? '검토 완료 기록'
                : '보완 요청 등록'}
          </button>
        </div>
      </Modal>
    </section>
  );
}
/** 서버의 제출 조건과 사용자의 최종 확인을 모두 요구하며 재시도에는 같은 멱등 키를 사용한다. */
export function SubmitPanel({ procedure }: { procedure: Procedure }) {
  const mutation = useProcedureMutation(procedure.id);
  const [confirmed, setConfirmed] = useState(false);
  const [open, setOpen] = useState(false);
  const key = useRef<string | undefined>(undefined);
  async function submit() {
    key.current ??= crypto.randomUUID();
    try {
      await mutation.mutateAsync({
        endpoint: '/submit',
        body: { expectedRevision: procedure.revision },
        idempotencyKey: key.current,
      });
      key.current = undefined;
      setOpen(false);
    } catch {
      setOpen(false);
    }
  }
  if (['SUBMITTED', 'RECEIVED'].includes(procedure.status))
    return (
      <section className="sf-panel review-panel">
        <h2>제출본을 보관했습니다</h2>
        <p>제출 시점의 값과 출처가 고정되었습니다.</p>
        <Link className="button primary full" href={`/requests/${procedure.id}/receipt`}>
          제출 내역 확인
          <Icon name="arrow" />
        </Link>
      </section>
    );
  return (
    <section className="sf-panel review-panel">
      <div className="review-title">
        <Icon name="shield" />
        <div>
          <h2>담당자 협의 현황</h2>
          <p>검토와 보완을 마친 후 제출본을 확정합니다.</p>
        </div>
      </div>
      <ReviewProgress procedure={procedure} />
      <ErrorNotice error={mutation.error} />
      {procedure.blockers.length > 0 ? (
        <Notice>
          <strong>제출 전 확인할 내용</strong>
          <ul className="notes-list">
            {procedure.blockers.map((blocker, index) => (
              <li key={`${index}-${blocker}`}>{blocker}</li>
            ))}
          </ul>
        </Notice>
      ) : (
        <Notice>서버가 판단한 제출 준비 조건을 충족했습니다. 최종 내용을 확인해 주세요.</Notice>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={!procedure.allowedActions.includes('SUBMIT')}
        />
        문서와 근거를 검토했으며 제출본으로 확정합니다.
      </label>
      <button
        className="button primary full"
        type="button"
        disabled={!confirmed || !procedure.allowedActions.includes('SUBMIT') || mutation.isPending}
        onClick={() => setOpen(true)}
      >
        최종 제출 확인
        <Icon name="arrow" />
      </button>
      <p className="role-caption">
        최종 제출은 신청자만 할 수 있습니다. 검토 완료와 실제 처리는 별도로 관리합니다.
      </p>
      <Modal open={open} title="최종 제출본 확정" onClose={() => setOpen(false)}>
        <p>
          <strong>{procedure.title}</strong>의 수정본 v{procedure.revision}을 제출본으로 고정합니다.
        </p>
        <Notice>
          확정 이후 이 제출본의 답변과 통신 규칙을 수정할 수 없습니다. 정보보안·ICT인프라 담당자의
          접수 대상이 됩니다.
        </Notice>
        <div className="dialog-actions">
          <button className="button" type="button" onClick={() => setOpen(false)}>
            돌아가서 확인
          </button>
          <button
            className="button primary"
            type="button"
            disabled={mutation.isPending}
            onClick={() => void submit()}
          >
            {mutation.isPending ? '제출 확인 중…' : '제출본 확정'}
          </button>
        </div>
      </Modal>
    </section>
  );
}
