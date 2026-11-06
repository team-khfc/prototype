'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession, useMemoryDraft } from '@/features/auth';
import { procedureSchema, type Procedure } from './types';
import { requestJson } from '@/lib/http';
import { documentLabel, formatDate, shortId, stepPath } from '@/lib/format';
import {
  Heading,
  Badge,
  Notice,
  ErrorNotice,
  Loading,
  Icon,
  Stepper,
  FormHelp,
  Modal,
  Empty,
} from '@/components/ui';
import { useProcedures, useProcedure, useProcedureMutation } from './useProcedures';
import { WorkspaceView, RequestsView, DEFAULT_REQUEST_FILTERS } from './Overview';
import { AnswerEditor } from './AnswerEditor';
import { AnalysisPage } from './Analysis';
import {
  DetailView,
  ReviewPanel,
  SubmitPanel,
  DocumentPanel,
  DocumentPreview,
  ReviewProgress,
} from './Details';
import { NetworkEditor, NetworkTable } from './Network';

/** 기관 관리자의 설정 업무와 일반 업무 목록을 구분하여 불필요한 신청 조회를 하지 않는다. */
export function WorkspacePage() {
  const session = useSession();
  const requests = useProcedures(session.user.role !== 'ADMIN');
  if (session.user.role === 'ADMIN')
    return (
      <>
        <Heading
          title="기관 운영 한눈에 보기"
          description="질문과 검토 절차를 준비하고 새 신청부터 적용하세요."
        />
        <div className="workspace-intro">
          <span className="workspace-intro-icon">
            <Icon name="settings" width={30} height={30} />
          </span>
          <div>
            <h2>기관의 절차에 맞게, 담당자의 판단을 돕습니다.</h2>
            <p>설정 초안과 게시본을 구분하고, 기존 신청의 적용 버전을 유지합니다.</p>
          </div>
        </div>
        <div className="document-grid">
          {[
            ['questions', '인터뷰 질문', '역할별 추가 질문과 작성 이유를 정리합니다.'],
            ['workflow', '검토 절차', '병렬·순차 검토와 필수 담당 분야를 정합니다.'],
            ['versions', '설정 게시', '초안을 검토하고 게시 이력을 확인합니다.'],
            ['models', 'AI 모델 연결', '예시 분석과 실제 연결을 명확히 구분합니다.'],
            ['context', '기관 컨텍스트', '기관 내부 참고 정보를 공개 지식과 분리합니다.'],
          ].map(([path, title, body]) => (
            <section className="sf-panel" key={path}>
              <h2>{title}</h2>
              <p>{body}</p>
              <Link className="text-button" href={`/admin/${path}`}>
                관리하기
                <Icon name="arrow" />
              </Link>
            </section>
          ))}
        </div>
      </>
    );
  if (requests.isPending) return <Loading />;
  if (requests.error)
    return <ErrorNotice error={requests.error} retry={() => void requests.refetch()} />;
  return (
    <WorkspaceView
      items={requests.data}
      role={session.user.role}
      institutionName={session.institutionName}
    />
  );
}
/** 인증된 사용자별 조회 문맥을 유지하고 서버 목록 조회 권한을 확대하지 않는다. */
export function RequestsPage() {
  const { user } = useSession();
  const [filters, setFilters] = useMemoryDraft('request-list-filters', DEFAULT_REQUEST_FILTERS);
  const query = useProcedures(user.role !== 'ADMIN');
  if (user.role === 'ADMIN')
    return (
      <Notice>
        기관 관리자는 기관 설정을 관리합니다. 신청 내용은 업무 담당자 계정으로 확인해 주세요.
      </Notice>
    );
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  return (
    <RequestsView
      items={query.data}
      role={user.role}
      filters={filters}
      onFiltersChange={setFilters}
    />
  );
}

/** 새 신청은 명시적 초안 생성에서만 서버에 저장하며 AI가 내부 사실을 채우지 않는다. */
export function CreatePage() {
  const { user } = useSession();
  const router = useRouter();
  const client = useQueryClient();
  const [draft, setDraft, clear] = useMemoryDraft('new-procedure', {
    title: '',
    documentType: 'FIREWALL',
    department: '',
    description: '',
  });
  const mutation = useMutation({
    mutationFn: () =>
      requestJson('/procedures', procedureSchema, { method: 'POST', body: JSON.stringify(draft) }),
    onSuccess: (procedure) => {
      clear();
      void client.invalidateQueries({ queryKey: ['procedures'] });
      router.push(`/requests/${procedure.id}/analysis`);
    },
  });
  if (user.role !== 'APPLICANT')
    return <Notice>새 보안 신청은 일반 사용자 계정으로 작성해 주세요.</Notice>;
  return (
    <>
      <Heading
        title="새 보안 신청"
        description="사업 설명부터 차근차근, 필요한 정보는 담당자와 함께 확인합니다."
      />
      <Stepper current={0} />
      <div className="form-layout">
        <form
          className="form-main"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <section className="sf-panel form-panel">
            <div className="section-heading">
              <span className="section-num">01</span>
              <div>
                <h2>어떤 사업을 준비하고 있나요?</h2>
                <p>지금 알고 있는 내용을 편하게 적어 주세요.</p>
              </div>
            </div>
            <ErrorNotice error={mutation.error} />
            <div className="sf-field">
              <label htmlFor="document-type">
                작성할 서류 <span className="required">필수</span>
              </label>
              <select
                id="document-type"
                value={draft.documentType}
                disabled={mutation.isPending}
                onChange={(event) => setDraft({ ...draft, documentType: event.target.value })}
              >
                <option value="FIREWALL">방화벽 신청서</option>
                <option value="SECURITY_REVIEW">보안성검토 신청서</option>
              </select>
            </div>
            <div className="sf-field">
              <label htmlFor="project-title">
                사업명 <span className="required">필수</span>
              </label>
              <p className="field-hint" id="title-hint">
                어떤 사업인지 알 수 있는 이름을 입력해 주세요.
              </p>
              <input
                id="project-title"
                required
                maxLength={160}
                aria-describedby="title-hint"
                disabled={mutation.isPending}
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="예: 공개 안내 챗봇 서비스 구축 (합성)"
              />
              <span className="char-count">{draft.title.length} / 160자</span>
            </div>
            <div className="sf-field">
              <label htmlFor="department">
                신청 부서 <span className="required">필수</span>
              </label>
              <input
                id="department"
                required
                maxLength={100}
                disabled={mutation.isPending}
                value={draft.department}
                onChange={(event) => setDraft({ ...draft, department: event.target.value })}
                placeholder="합성 부서명"
              />
            </div>
            <div className="sf-field">
              <label htmlFor="description">
                서비스 설명 <span className="required">필수</span>
              </label>
              <p className="field-hint" id="description-hint">
                이용 대상과 제공하려는 서비스, 현재 정해진 범위를 알려 주세요.
              </p>
              <textarea
                id="description"
                rows={6}
                maxLength={20000}
                required
                aria-describedby="description-hint"
                disabled={mutation.isPending}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="어떤 서비스를 누구에게 제공하고 싶나요?"
              />
              <span className="char-count">
                {draft.description.length.toLocaleString()} / 20,000자
              </span>
            </div>
            <button
              type="button"
              className="text-button"
              disabled={mutation.isPending}
              onClick={() =>
                setDraft({
                  ...draft,
                  title: '공개 주택연금 안내 챗봇 (합성)',
                  department: '디지털서비스팀 (합성)',
                  description:
                    '공개된 주택연금 안내 자료를 검색해 일반 국민에게 안내하는 챗봇을 준비합니다. 실제 개인정보와 내부 시스템 정보는 사용하지 않습니다. 합성 질문과 공개 FAQ로 시연합니다.',
                })
              }
            >
              합성 작성 예시 채우기
            </button>
          </section>
          <div className="form-actions">
            <button className="button primary" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? '초안 생성 중…' : '초안 생성 후 다음 단계'}
              <Icon name="arrow" />
            </button>
            <Link className="button subtle" href="/requests">
              <Icon name="back" />
              목록으로
            </Link>
          </div>
          <p className="save-status">초안 생성 버튼을 누르면 사업 정보를 서버에 저장합니다.</p>
        </form>
        <FormHelp />
      </div>
    </>
  );
}
function QuestionsPage({ procedure }: { procedure: Procedure }) {
  return (
    <>
      <Heading
        title="새 보안 신청"
        description="사업 설명부터 차근차근, 필요한 정보는 담당자와 함께 확인합니다."
      >
        <Badge tone="blue">기관 설정 v{procedure.policyVersion}</Badge>
      </Heading>
      <Stepper current={2} />
      <div className="form-layout">
        <div className="form-main">
          <section className="sf-panel form-panel">
            <div className="section-heading">
              <span className="section-num">03</span>
              <div>
                <h2>기관별 확인 질문</h2>
                <p>모르는 항목은 비워 두고 담당자와 함께 확인해 주세요.</p>
              </div>
            </div>
            <AnswerEditor procedure={procedure} />
          </section>
          <div className="form-actions">
            <Link className="button primary" href={`/requests/${procedure.id}/summary`}>
              협의 요청 확인
              <Icon name="arrow" />
            </Link>
            <Link className="button subtle" href={`/requests/${procedure.id}/analysis`}>
              <Icon name="back" />
              자료·AI 제안
            </Link>
          </div>
          <p className="save-status">
            다음 단계로 이동해도 답변은 자동 저장되지 않습니다. ‘답변·확인 상태 저장’을 먼저 눌러
            주세요.
          </p>
        </div>
        <FormHelp />
      </div>
    </>
  );
}
function SummaryPage({ procedure }: { procedure: Procedure }) {
  const mutation = useProcedureMutation(procedure.id);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  async function consult() {
    try {
      await mutation.mutateAsync({
        endpoint: '/consult',
        body: { expectedRevision: procedure.revision },
      });
      setOpen(false);
      router.push(`/requests/${procedure.id}/submit`);
    } catch {
      setOpen(false);
    }
  }
  return (
    <>
      <Heading
        title={procedure.status === 'DRAFT' ? '새 보안 신청' : '협의 요청 내용'}
        description="사업 정보와 확인된 내용을 정리해 담당자에게 전달합니다."
      >
        <Badge tone="blue">기관 설정 v{procedure.policyVersion}</Badge>
      </Heading>
      {procedure.status === 'DRAFT' && <Stepper current={3} />}
      <div className="form-layout">
        <div className="form-main">
          <section className="sf-panel form-panel">
            <div className="section-heading">
              <span className="section-num">04</span>
              <div>
                <h2>
                  {procedure.status === 'DRAFT'
                    ? '사전 협의를 요청할까요?'
                    : '저장된 협의 요청 내용'}
                </h2>
                <p>정보보안·ICT인프라 담당자가 필요한 전문 정보를 확인합니다.</p>
              </div>
            </div>
            <ErrorNotice error={mutation.error} />
            <dl className="summary-list">
              <div>
                <dt>사업명</dt>
                <dd>{procedure.title}</dd>
              </div>
              <div>
                <dt>신청자</dt>
                <dd>
                  {procedure.ownerName} · {procedure.department}
                </dd>
              </div>
              <div>
                <dt>요청 문서</dt>
                <dd>{documentLabel(procedure.documentType)}</dd>
              </div>
              <div>
                <dt>서비스 설명</dt>
                <dd>{procedure.description}</dd>
              </div>
              <div>
                <dt>기관 설정</dt>
                <dd>
                  v{procedure.policyVersion} ·{' '}
                  {procedure.policy.reviewMode === 'PARALLEL' ? '병렬 검토' : '순차 검토'}
                </dd>
              </div>
              <div>
                <dt>답변 확인</dt>
                <dd>
                  {
                    procedure.answers.filter((answer) =>
                      ['CONFIRMED', 'NOT_APPLICABLE'].includes(answer.status),
                    ).length
                  }
                  개 확인 ·{' '}
                  {
                    procedure.answers.filter(
                      (answer) => !['CONFIRMED', 'NOT_APPLICABLE'].includes(answer.status),
                    ).length
                  }
                  개 미확정
                </dd>
              </div>
            </dl>
            <Notice>
              이 단계는 담당자 사전 협의 요청입니다. 검토와 보완을 마친 후 최종 제출 화면에서
              제출본을 확정합니다.
            </Notice>
            {procedure.status === 'DRAFT' && !procedure.allowedActions.includes('CONSULT') && (
              <Notice error>사업 목적과 이용 대상을 입력하고 직접 확인한 후 저장해 주세요.</Notice>
            )}
          </section>
          <div className="form-actions">
            {procedure.status === 'DRAFT' ? (
              <button
                className="button primary"
                type="button"
                disabled={!procedure.allowedActions.includes('CONSULT') || mutation.isPending}
                onClick={() => setOpen(true)}
              >
                사전 협의 요청
                <Icon name="arrow" />
              </button>
            ) : (
              <Link className="button primary" href={`/requests/${procedure.id}/submit`}>
                협의 현황 확인
                <Icon name="arrow" />
              </Link>
            )}
            <Link className="button subtle" href={`/requests/${procedure.id}/questions`}>
              <Icon name="back" />
              기관별 질문
            </Link>
          </div>
        </div>
        <FormHelp />
      </div>
      <Modal open={open} title="사전 협의 요청" onClose={() => setOpen(false)}>
        <p>
          {procedure.title}의 수정본 v{procedure.revision}을 기관의 정보보안·ICT인프라 담당자가 볼
          수 있도록 사전 협의를 요청합니다.
        </p>
        <Notice>
          부족한 전문 정보는 담당자가 보완합니다. 최종 제출 단계는 별도로 남아 있습니다.
        </Notice>
        <div className="dialog-actions">
          <button className="button" type="button" onClick={() => setOpen(false)}>
            취소
          </button>
          <button
            className="button primary"
            type="button"
            disabled={mutation.isPending}
            onClick={() => void consult()}
          >
            {mutation.isPending ? '요청 처리 중…' : '담당자 협의 시작'}
          </button>
        </div>
      </Modal>
    </>
  );
}
function SupplementEntry({ procedure, id }: { procedure: Procedure; id: string }) {
  const entry = procedure.supplements.find((supplement) => supplement.id === id)!;
  const { user } = useSession();
  const mutation = useProcedureMutation(procedure.id);
  const [answer, setAnswer] = useMemoryDraft(`supplement-answer:${id}`, entry.answer);
  const [open, setOpen] = useState(false);
  const mayAnswer =
    user.role === 'APPLICANT' &&
    procedure.allowedActions.includes('ANSWER') &&
    entry.status !== 'RESOLVED';
  const mayResolve =
    user.role === entry.requestedByRole &&
    procedure.allowedActions.includes('RESOLVE') &&
    entry.status === 'ANSWERED';
  async function submit(resolve = false) {
    try {
      await mutation.mutateAsync({
        endpoint: `/supplements/${id}/${resolve ? 'resolve' : 'answer'}`,
        body: { expectedRevision: procedure.revision, ...(!resolve ? { answer } : {}) },
      });
      setOpen(false);
    } catch {
      setOpen(false);
    }
  }
  return (
    <article className="supplement-item">
      <div className="row-between">
        <h3>{entry.requestedByRole === 'SECURITY' ? '정보보안' : 'ICT인프라'} 확인 요청</h3>
        <Badge tone={entry.status === 'RESOLVED' ? 'green' : 'amber'}>
          {entry.status === 'RESOLVED'
            ? '해소 확인'
            : entry.status === 'ANSWERED'
              ? '답변 완료 · 담당자 확인 대기'
              : '답변 필요'}
        </Badge>
      </div>
      <p>{entry.question}</p>
      <small>
        {entry.requestedBy} · {formatDate(entry.createdAt, true)}
      </small>
      <ErrorNotice error={mutation.error} />
      {mayAnswer ? (
        <>
          <label htmlFor={`supplement-${id}`}>보완 답변</label>
          <textarea
            id={`supplement-${id}`}
            rows={4}
            maxLength={4000}
            value={answer}
            disabled={mutation.isPending}
            onChange={(event) => setAnswer(event.target.value)}
          />
          <button
            className="button"
            type="button"
            disabled={!answer.trim() || mutation.isPending}
            onClick={() => void submit()}
          >
            보완 답변 저장
          </button>
        </>
      ) : entry.answer ? (
        <blockquote>{entry.answer}</blockquote>
      ) : (
        <p className="muted">신청자 답변을 기다리고 있습니다.</p>
      )}
      {mayResolve && (
        <button className="button" type="button" onClick={() => setOpen(true)}>
          답변 확인 후 보완 해소
        </button>
      )}
      <Modal open={open} title="보완 해소 확인" onClose={() => setOpen(false)}>
        <p>
          위 답변으로 요청한 정보가 충분히 확인되었나요? 보완 해소는 별도의 분야별 검토 완료와
          구분하여 기록합니다.
        </p>
        <div className="dialog-actions">
          <button className="button" type="button" onClick={() => setOpen(false)}>
            취소
          </button>
          <button
            className="button primary"
            type="button"
            disabled={mutation.isPending}
            onClick={() => void submit(true)}
          >
            보완 해소 기록
          </button>
        </div>
      </Modal>
    </article>
  );
}
function ReceiptPage({ procedure }: { procedure: Procedure }) {
  const mutation = useProcedureMutation(procedure.id);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const submitted = ['SUBMITTED', 'RECEIVED'].includes(procedure.status);
  const event = procedure.timeline.findLast((entry) => entry.action.includes('SUBMIT'));
  if (!submitted)
    return (
      <Notice>
        아직 최종 제출되지 않은 신청입니다.{' '}
        <Link href={`/requests/${procedure.id}/submit`}>제출 준비 상태 확인</Link>
      </Notice>
    );
  return (
    <>
      <Heading
        title={
          procedure.status === 'RECEIVED'
            ? '담당자가 신청을 접수했습니다'
            : '보안 협의 신청을 제출했습니다'
        }
        description="제출 시점의 답변·출처·통신 규칙을 제출본으로 보관합니다."
      />
      <section className="sf-panel receipt">
        <span className="receipt-icon">
          <Icon name="check" width={40} height={40} />
        </span>
        <h2>
          {procedure.status === 'RECEIVED' ? '접수 기록을 확인했습니다.' : '제출본을 확정했습니다.'}
        </h2>
        <p>실제 방화벽 적용이나 서비스 운영 승인은 이 화면에서 수행하지 않습니다.</p>
        <ErrorNotice error={mutation.error} />
        <dl className="summary-list">
          <div>
            <dt>신청번호</dt>
            <dd>{shortId(procedure.id)}</dd>
          </div>
          <div>
            <dt>제출 일시</dt>
            <dd>{event ? `${formatDate(event.at, true)} (한국 시간)` : '협의 이력에서 확인'}</dd>
          </div>
          <div>
            <dt>제출 수정본 / 설정</dt>
            <dd>
              v{procedure.revision} / v{procedure.policyVersion}
            </dd>
          </div>
          <div>
            <dt>상태</dt>
            <dd>
              {procedure.status === 'RECEIVED'
                ? '담당자 접수 완료 · 실제 처리 별도'
                : '제출 완료 · 담당자 접수 대기'}
            </dd>
          </div>
        </dl>
        <div className="receipt-actions">
          <button className="button primary" type="button" onClick={() => setPreview(true)}>
            제출본 확인
            <Icon name="arrow" />
          </button>
          <Link className="button" href="/requests">
            신청 현황으로
          </Link>
          {procedure.allowedActions.includes('RECEIVE') && (
            <button className="button" type="button" onClick={() => setConfirm(true)}>
              담당자 접수 기록
            </button>
          )}
        </div>
      </section>
      <Modal open={preview} title="제출본 확인" onClose={() => setPreview(false)}>
        <DocumentPreview procedure={procedure} />
      </Modal>
      <Modal open={confirm} title="접수 기록 확인" onClose={() => setConfirm(false)}>
        <Notice>
          제출본을 검토할 담당자 접수 기록을 남깁니다. 실제 처리 완료로 표시하지 않습니다.
        </Notice>
        <div className="dialog-actions">
          <button className="button" type="button" onClick={() => setConfirm(false)}>
            취소
          </button>
          <button
            className="button primary"
            type="button"
            disabled={mutation.isPending}
            onClick={() =>
              void mutation
                .mutateAsync({
                  endpoint: '/receive',
                  body: { expectedRevision: procedure.revision },
                })
                .then(() => setConfirm(false))
                .catch(() => setConfirm(false))
            }
          >
            접수 기록
          </button>
        </div>
      </Modal>
    </>
  );
}
/** 같은 신청 데이터를 단계별 화면으로 나누고 단계 링크만으로 업무 전이를 실행하지 않는다. */
export function ProcedurePage({ id, step }: { id: string; step: string }) {
  const query = useProcedure(id);
  const { user } = useSession();
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  const procedure = query.data;
  if (step === 'analysis') return <AnalysisPage procedure={procedure} />;
  if (step === 'questions') return <QuestionsPage procedure={procedure} />;
  if (step === 'summary') return <SummaryPage procedure={procedure} />;
  if (step === 'receipt') return <ReceiptPage procedure={procedure} />;
  if (step === 'security' || step === 'infra')
    return (
      <DetailView
        procedure={procedure}
        step={step}
        aside={
          <ReviewPanel procedure={procedure} role={step === 'security' ? 'SECURITY' : 'INFRA'} />
        }
      >
        {step === 'infra' && procedure.documentType === 'FIREWALL' && (
          <section className="sf-panel">
            {user.role === 'INFRA' && procedure.allowedActions.includes('EDIT') ? (
              <NetworkEditor procedure={procedure} />
            ) : (
              <>
                <div className="panel-heading">
                  <h2>통신 규칙</h2>
                  <Badge>담당자 입력</Badge>
                </div>
                <NetworkTable procedure={procedure} />
              </>
            )}
          </section>
        )}
      </DetailView>
    );
  if (step === 'supplement')
    return (
      <DetailView
        procedure={procedure}
        step={step}
        aside={
          <section className="sf-panel review-panel">
            <h2>담당자 협의 현황</h2>
            <ReviewProgress procedure={procedure} />
            <Notice>신청자의 답변 후 요청한 담당자가 보완 해소를 확인합니다.</Notice>
            <Link className="button primary full" href={`/requests/${id}/submit`}>
              제출 준비 확인
              <Icon name="arrow" />
            </Link>
          </section>
        }
      >
        <section className="sf-panel">
          <div className="panel-heading">
            <h2>보완 요청과 답변</h2>
            <Badge tone="amber">
              {procedure.supplements.filter((entry) => entry.status !== 'RESOLVED').length}건 미해소
            </Badge>
          </div>
          {procedure.supplements.length ? (
            procedure.supplements.map((entry) => (
              <SupplementEntry key={entry.id} procedure={procedure} id={entry.id} />
            ))
          ) : (
            <Empty
              title="보완 요청이 없습니다"
              description="담당자가 추가 확인할 내용을 요청하면 여기에 표시됩니다."
            />
          )}
        </section>
      </DetailView>
    );
  if (step === 'submit')
    return (
      <DetailView procedure={procedure} step={step} aside={<SubmitPanel procedure={procedure} />} />
    );
  return (
    <Notice>
      존재하지 않는 신청 단계입니다. <Link href="/requests">협의 요청함으로 이동</Link>
    </Notice>
  );
}
/** 검토 초안과 불변 제출본을 구분하여 검색·열람·다운로드할 수 있게 한다. */
export function DocumentsPage() {
  const { user } = useSession();
  const query = useProcedures(user.role !== 'ADMIN');
  const [search, setSearch] = useMemoryDraft('document-search', '');
  const [kind, setKind] = useMemoryDraft('document-kind', 'ALL');
  if (user.role === 'ADMIN')
    return <Notice>문서함은 신청자와 담당자 계정에서 확인할 수 있습니다.</Notice>;
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  const list = query.data.filter(
    (item) =>
      `${item.title} ${shortId(item.id)}`.includes(search) &&
      (kind === 'ALL' ||
        (kind === 'SUBMITTED') === ['SUBMITTED', 'RECEIVED'].includes(item.status)),
  );
  return (
    <>
      <Heading
        title="문서함"
        description="진행 중인 검토 초안과 제출 시점에 확정한 문서를 확인하세요."
      />
      <Notice>
        저장된 내용과 출처를 HTML 문서로 내려받습니다. 공식 양식·PDF·DOCX 발급은 연결되지
        않았습니다.
      </Notice>
      <section className="sf-panel document-search" aria-label="문서 검색">
        <div className="filter-field">
          <label htmlFor="document-query">사업명·신청번호</label>
          <div className="search-input">
            <Icon name="search" />
            <input
              id="document-query"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="문서를 검색해 주세요"
            />
          </div>
        </div>
        <div className="filter-field">
          <label htmlFor="document-kind">문서 구분</label>
          <select id="document-kind" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="ALL">전체</option>
            <option value="DRAFT">검토 초안</option>
            <option value="SUBMITTED">제출본</option>
          </select>
        </div>
        <button
          className="button"
          type="button"
          onClick={() => {
            setSearch('');
            setKind('ALL');
          }}
        >
          검색 초기화
        </button>
      </section>
      <p className="document-count" role="status">
        문서 <strong>{list.length}</strong>건 · 초안은 저장한 최신 내용으로 표시됩니다.
      </p>
      <div className="document-grid">
        {list.map((item) => (
          <section className="sf-panel document-card" key={item.id}>
            <div className="row-between">
              <span className="document-symbol">
                <Icon name="file" width={26} height={26} />
              </span>
              <Badge tone={['SUBMITTED', 'RECEIVED'].includes(item.status) ? 'green' : 'gray'}>
                {['SUBMITTED', 'RECEIVED'].includes(item.status) ? '제출본' : '검토 초안'} v
                {item.revision}
              </Badge>
            </div>
            <h2>{item.title}</h2>
            <p>{shortId(item.id)}</p>
            <dl className="document-facts">
              <div>
                <dt>적용 설정</dt>
                <dd>v{item.policyVersion}</dd>
              </div>
              <div>
                <dt>확인 상태</dt>
                <dd>
                  미확정{' '}
                  {
                    item.answers.filter(
                      (answer) => !['CONFIRMED', 'NOT_APPLICABLE'].includes(answer.status),
                    ).length
                  }
                  개
                </dd>
              </div>
              <div>
                <dt>문서 형식</dt>
                <dd>HTML · 출처·확인 이력 포함</dd>
              </div>
            </dl>
            <div className="document-state">
              <Icon name="info" width={16} height={16} />
              <span>
                {['SUBMITTED', 'RECEIVED'].includes(item.status)
                  ? '제출 시점에 고정 · 읽기전용'
                  : '검토 중 변경될 수 있는 초안입니다.'}
              </span>
            </div>
            <DocumentPanel procedure={item} compact />
            <Link className="document-detail-link" href={stepPath(item, user.role)}>
              협의 내용과 원문 근거
              <Icon name="arrow" width={16} height={16} />
            </Link>
          </section>
        ))}
      </div>
      {!list.length && (
        <Empty
          title="문서가 없습니다"
          description="검색 조건을 바꾸거나 새 보안 신청을 작성해 주세요."
        />
      )}
    </>
  );
}
