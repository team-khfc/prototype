'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon, ErrorNotice, Loading, Empty } from '@/components/ui';
import { MODEL_PURPOSE_LABELS } from '@/features/llm';
import { useWorkspace, workspacePath } from './WorkspaceContext';
import { AnswerEditor } from './AnswerEditor';
import { AnswerReadout, PageHeading, StatusBadge } from './RequestComponents';
import { DOCUMENT_LABELS, type BusinessCase, type CaseAnalysis, type DocumentType } from './types';

/** 사업 건 하나에 필요한 서류를 복수 선택하고 이후 공통 질문을 한 번만 수집한다. */
export function NewBusinessCase() {
  const workspace = useWorkspace();
  const router = useRouter();
  const [types, setTypes] = useState<DocumentType[]>(['FIREWALL', 'SECURITY_REVIEW']);
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  if (workspace.actor.role !== 'APPLICANT')
    return (
      <>
        <PageHeading title="새 신청" />
        <div className="sa-callout">
          <Icon name="info" />
          <p>
            사업 건은 일반 사용자 계정으로 만듭니다.
            {workspace.mode === 'preview' && ' 화면 위의 시연 역할을 일반 사용자로 바꿔 주세요.'}
          </p>
        </div>
      </>
    );
  return (
    <>
      <Link className="sa-back-link" href={workspacePath(workspace.mode, '/business-cases')}>
        <Icon name="back" width={18} height={18} />
        사업 건 목록
      </Link>
      <PageHeading
        title="어떤 사업을 준비하고 계신가요?"
        description="사업 정보를 한 번 작성하면 필요한 서류를 함께 준비할 수 있어요."
        eyebrow="새 신청 · 1단계 작성"
      />
      <div className="sa-intake-grid">
        <form
          className="sa-card"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(undefined);
            const data = new FormData(event.currentTarget);
            try {
              const id = await workspace.createCase({
                title: String(data.get('title')),
                department: String(data.get('department')),
                description: String(data.get('description')),
                docTypes: types,
              });
              router.push(workspacePath(workspace.mode, `/business-cases/${id}`));
            } catch (failure) {
              setError(failure);
            } finally {
              setPending(false);
            }
          }}
        >
          <h2>사업 기본 정보</h2>
          <p className="sa-muted">실제 기관의 내부 정보 대신 합성 자료를 입력해 주세요.</p>
          <ErrorNotice error={error} />
          <div className="sa-field">
            <label htmlFor="case-title">
              사업명 <span className="sa-required">필수</span>
            </label>
            <input
              id="case-title"
              name="title"
              required
              maxLength={160}
              placeholder="예: 공공자료 안내 서비스 구축"
              disabled={pending}
            />
          </div>
          <div className="sa-field">
            <label htmlFor="case-department">
              신청 부서 <span className="sa-required">필수</span>
            </label>
            <input
              id="case-department"
              name="department"
              required
              maxLength={100}
              placeholder="예: 합성 디지털사업팀"
              disabled={pending}
            />
          </div>
          <div className="sa-field">
            <label htmlFor="case-description">간단한 사업 설명</label>
            <textarea
              id="case-description"
              name="description"
              rows={3}
              maxLength={20000}
              placeholder="누가 어떤 목적으로 사용할 서비스인지 알려주세요."
              disabled={pending}
            />
          </div>
          <fieldset className="sa-document-types">
            <legend>
              함께 준비할 서류 <span className="sa-required">1개 이상 선택</span>
            </legend>
            {(['FIREWALL', 'SECURITY_REVIEW'] as const).map((type) => (
              <label key={type} className={types.includes(type) ? 'sa-selected' : ''}>
                <input
                  type="checkbox"
                  checked={types.includes(type)}
                  disabled={pending}
                  onChange={(event) =>
                    setTypes(
                      event.target.checked
                        ? [...types, type]
                        : types.filter((item) => item !== type),
                    )
                  }
                />
                <Icon name={type === 'FIREWALL' ? 'server' : 'shield'} />
                <span>
                  <strong>{DOCUMENT_LABELS[type]}</strong>
                  <small>
                    {type === 'FIREWALL'
                      ? '시스템 간 통신이 필요한 경우'
                      : '사업의 보안 사항을 검토받는 경우'}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="sa-callout">
            <Icon name="info" />
            <p>공통 정보는 한 번만 질문합니다. 만든 서류는 각각 협의·반환·제출할 수 있습니다.</p>
          </div>
          <div className="sa-form-actions">
            <span>선택한 서류 {types.length}종</span>
            <button
              className="sa-button sa-primary"
              disabled={pending || types.length === 0}
              type="submit"
            >
              {pending ? '만드는 중…' : '사업 건 만들고 작성 시작'}
              <Icon name="arrow" width={18} height={18} />
            </button>
          </div>
        </form>
        <aside className="sa-card sa-intake-help">
          <span className="sa-eyebrow">함께 작성해요</span>
          <h2>
            보안 용어를
            <br />
            모르셔도 괜찮아요.
          </h2>
          <p>신청자는 사업 목적과 이용 환경을 설명하고, 담당자는 필요한 기술 정보를 확인합니다.</p>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>사업과 이용 환경 설명</strong>
                <p>공통 질문에 한 번만 답해요.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>각 서류의 추가 질문 작성</strong>
                <p>모르는 기술 항목은 담당자에게 맡겨요.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>초안을 확인하고 협의 요청</strong>
                <p>AI가 제안한 내용은 사람이 확인해요.</p>
              </div>
            </li>
          </ol>
          <div className="sa-help-line">
            <Icon name="lock" />
            <p>자료는 선택만으로 전송되지 않습니다. 분석 요청을 눌렀을 때 전송됩니다.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

/** 선택 파일을 자동 전송하지 않고 분석과 미확정 후보 적용을 분리한다. */
export function CaseAnalysisPanel({
  businessCase,
  disabled,
}: {
  businessCase: BusinessCase;
  disabled?: boolean;
}) {
  const workspace = useWorkspace();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File>();
  const [configurationId, setConfigurationId] = useState('');
  const selectedModel = workspace.modelOptions.find(
    (option) => (option.id ?? '') === configurationId,
  );
  const [analysis, setAnalysis] = useState<CaseAnalysis>();
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const [applied, setApplied] = useState(false);
  return (
    <section className="sa-analysis" aria-labelledby="analysis-title">
      <div className="sa-section-heading">
        <h3 id="analysis-title">
          <Icon name="sparkle" width={20} height={20} />
          자료로 작성 시작
        </h3>
        <span className="sa-badge sa-neutral">사람 확인 필요</span>
      </div>
      <p className="sa-muted">
        설명이나 TXT·MD 자료를 분석해 공통 정보의 후보를 만듭니다. 후보는 적용 전까지 작성 내용을
        바꾸지 않습니다.
      </p>
      <ErrorNotice error={error} />
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError(undefined);
          setPending(true);
          setApplied(false);
          setAnalysis(undefined);
          try {
            setAnalysis(
              await workspace.analyse({
                caseId: businessCase.id,
                expectedRevision: businessCase.revision,
                text,
                file,
                ...(configurationId ? { configurationId } : {}),
              }),
            );
          } catch (failure) {
            setError(failure);
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="sa-model-selector">
          <div className="sa-field">
            <label htmlFor="analysis-model">분석 모델</label>
            <select
              id="analysis-model"
              value={configurationId}
              disabled={disabled || pending || workspace.modelsLoading || !!workspace.modelsError}
              aria-describedby="analysis-model-help"
              onChange={(event) => setConfigurationId(event.target.value)}
            >
              {!workspace.modelOptions.length && (
                <option value="">
                  {workspace.modelsLoading ? '모델 불러오는 중…' : '사용 가능한 모델 없음'}
                </option>
              )}
              {workspace.modelOptions.map((option) => (
                <option key={option.id ?? 'example'} value={option.id ?? ''}>
                  {option.mode === 'EXAMPLE'
                    ? '예시 추출기 · 실제 AI 호출 없음'
                    : `${option.provider} · ${option.model} · ${MODEL_PURPOSE_LABELS[option.purpose]}`}
                </option>
              ))}
            </select>
            <small id="analysis-model-help">
              {workspace.modelsLoading
                ? '사용 가능한 모델을 확인하고 있습니다.'
                : !selectedModel
                  ? '사용 가능한 모델을 확인할 수 없습니다. 목록을 다시 불러오거나 기관 관리자에게 문의해 주세요.'
                  : selectedModel.mode === 'LIVE'
                    ? '분석 요청을 누르면 선택한 모델로 자료를 전송합니다.'
                    : '예시 추출기는 정해진 형식의 값을 발췌합니다. 실제 AI 모델을 호출하지 않습니다.'}
            </small>
          </div>
          {workspace.modelsError ? (
            <ErrorNotice error={workspace.modelsError} retry={workspace.refresh} />
          ) : null}
        </div>
        <div className="sa-upload-zone">
          <Icon name="upload" width={30} height={30} />
          <strong>합성 사업 자료를 선택해 주세요</strong>
          <span>UTF-8 TXT, MD · 최대 1 MiB · 설명과 합계 40,000자</span>
          <label className="sa-button sa-secondary sa-file-label">
            파일 선택
            <input
              aria-label="분석할 합성 자료 선택"
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              disabled={disabled || pending}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (
                  selected &&
                  (!/\.(txt|md)$/i.test(selected.name) ||
                    !selected.size ||
                    selected.size > 1024 * 1024)
                ) {
                  setError(new Error('1 MiB 이하의 비어 있지 않은 TXT·MD 파일만 선택해 주세요.'));
                  event.currentTarget.value = '';
                  setFile(undefined);
                  return;
                }
                setError(undefined);
                setFile(selected);
              }}
            />
          </label>
          {file && (
            <div className="sa-pending-file">
              <Icon name="file" width={17} height={17} />
              <span>{file.name} · 전송 대기</span>
              <button
                type="button"
                className="sa-text-button"
                disabled={pending}
                onClick={() => setFile(undefined)}
              >
                선택 해제
              </button>
            </div>
          )}
        </div>
        <label className="sa-field" htmlFor="analysis-text">
          <span>자료 없이 설명으로 시작해도 괜찮아요</span>
          <textarea
            id="analysis-text"
            rows={3}
            value={text}
            maxLength={40000}
            placeholder="서비스의 목적과 사용자를 편한 말로 설명해 주세요."
            disabled={disabled || pending}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <div className="sa-analysis-actions">
          <span className="sa-meta">
            {workspace.mode === 'preview'
              ? '시연: 예시 추출기 · 실제 AI 호출 없음'
              : '분석 응답에서 실제 사용한 모델과 모드를 확인할 수 있습니다.'}
          </span>
          <button
            className="sa-button sa-primary"
            disabled={
              disabled ||
              pending ||
              (!text.trim() && !file) ||
              !selectedModel ||
              workspace.modelsLoading ||
              !!workspace.modelsError
            }
            type="submit"
          >
            <Icon name="sparkle" width={18} height={18} />
            {pending ? '자료 분석 중…' : '자료 분석 요청'}
          </button>
        </div>
      </form>
      {analysis && (
        <div className="sa-analysis-result" role="status">
          <strong>
            {analysis.mode === 'EXAMPLE'
              ? '예시 추출 결과 · 실제 AI 호출 아님'
              : `${analysis.provider} · ${analysis.model}`}
          </strong>
          {analysis.status === 'RUNNING' ? (
            <p>자료 분석을 진행하고 있습니다. 완료된 결과만 초안에 적용할 수 있습니다.</p>
          ) : analysis.status !== 'SUCCEEDED' ? (
            <p className="sa-return-reason">
              {analysis.error ??
                '분석 결과를 적용할 수 없습니다. 최신 내용으로 다시 분석하거나 직접 입력해 주세요.'}
            </p>
          ) : (
            <>
              <ul>
                {analysis.suggestions.map((suggestion) => (
                  <li key={suggestion.key}>
                    <strong>
                      {businessCase.answers.find((answer) => answer.key === suggestion.key)
                        ?.label ?? suggestion.key}
                    </strong>
                    <p>{suggestion.value}</p>
                    <small>근거: {suggestion.evidence}</small>
                    {businessCase.answers.find((answer) => answer.key === suggestion.key)
                      ?.confirmed && (
                      <small>이미 사람이 확인한 항목입니다. 기존 값을 보존합니다.</small>
                    )}
                  </li>
                ))}
              </ul>
              <button
                className="sa-button sa-secondary"
                disabled={
                  disabled ||
                  pending ||
                  applied ||
                  analysis.revision !== businessCase.revision ||
                  !analysis.suggestions.some((suggestion) =>
                    businessCase.answers.some(
                      (answer) => answer.key === suggestion.key && !answer.confirmed,
                    ),
                  )
                }
                onClick={async () => {
                  setPending(true);
                  setError(undefined);
                  try {
                    await workspace.applyAnalysis(analysis, businessCase.revision);
                    setApplied(true);
                  } catch (failure) {
                    setError(failure);
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {applied ? '미확정 후보 반영됨 · 아래에서 확인' : '초안에 미확정으로 반영'}
              </button>
              {analysis.revision !== businessCase.revision && !applied && (
                <p>분석 후 입력이 바뀌었습니다. 최신 내용으로 다시 분석해 주세요.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** 공통 인터뷰와 수집 현황을 나란히 보여주고 서류별 질문으로 이어 준다. */
export function BusinessCaseDetail({ id }: { id: string }) {
  const workspace = useWorkspace();
  const businessCase = workspace.cases.find((item) => item.id === id);
  if (workspace.loading) return <Loading />;
  if (workspace.error) return <ErrorNotice error={workspace.error} retry={workspace.refresh} />;
  if (!businessCase)
    return (
      <Empty
        title="사업 건을 찾을 수 없습니다"
        description="조회 가능한 사업 건 목록에서 다시 선택해 주세요."
      />
    );
  const requests = workspace.requests.filter((item) => item.caseId === id);
  const canEdit = requests.some((item) => item.allowedActions.includes('EDIT_CASE'));
  const applicantAnswers = businessCase.answers.filter(
    (answer) => answer.ownerRole === workspace.actor.role,
  );
  const progress = businessCase.answers.filter(
    (answer) => answer.confirmed && (answer.value || answer.notApplicable),
  ).length;
  const highlighted = [
    ...new Set(
      requests
        .filter(
          (request) =>
            request.stage < 4 && !['FINALIZED', 'CLOSED', 'WITHDRAWN'].includes(request.status),
        )
        .flatMap((request) => [...request.highlightedFields, ...request.changedCommonFields]),
    ),
  ];
  const reasons: Record<string, string> = {};
  requests
    .flatMap((request) => request.returns)
    .forEach((item) =>
      item.fieldKeys.forEach((key) => {
        reasons[key] = item.reason;
      }),
    );
  return (
    <>
      <Link className="sa-back-link" href={workspacePath(workspace.mode, '/business-cases')}>
        <Icon name="back" width={18} height={18} />
        사업 건 목록
      </Link>
      <PageHeading
        title={businessCase.title}
        description={`${businessCase.department} · ${businessCase.ownerName} · 공통 정보 v${businessCase.revision}`}
        eyebrow="사업 건 공통 작성"
      />
      <div className="sa-case-documents">
        {requests.map((request) => (
          <Link
            key={request.id}
            href={workspacePath(workspace.mode, `/security-requests/${request.id}`)}
          >
            <Icon name={request.docType === 'FIREWALL' ? 'server' : 'shield'} />
            <div>
              <strong>{DOCUMENT_LABELS[request.docType]}</strong>
              <span>{request.stage}단계 · 독립 진행</span>
            </div>
            <StatusBadge status={request.status} />
            <Icon name="arrow" width={18} height={18} />
          </Link>
        ))}
      </div>
      <div className="sa-callout">
        <Icon name="info" />
        <p>
          이 사업의 공통 질문은 한 번만 답합니다. 공통 정보가 바뀌면 미제출 신청은 재검토가
          필요하며, 이미 제출한 서류의 값은 그대로 보존됩니다.
        </p>
      </div>
      <div className="sa-interview-workspace">
        <section className="sa-card sa-interview">
          <div className="sa-interview-header">
            <div>
              <span className="sa-eyebrow">공통 인터뷰</span>
              <h2>사업 이야기를 들려주세요</h2>
            </div>
            <Icon name="sparkle" width={26} height={26} />
          </div>
          <div className="sa-interview-body">
            <div className="sa-chat-message">
              <span className="sa-avatar">
                <Icon name="shield" width={19} height={19} />
              </span>
              <div>
                <strong>보안길잡이</strong>
                <p>
                  공통 정보를 먼저 모아볼게요. 사업 목적과 다루는 자료를 알려주세요. 서버 주소나
                  포트처럼 어려운 정보는 ICT인프라 담당자가 작성합니다.
                </p>
              </div>
            </div>
            {workspace.actor.role === 'APPLICANT' && (
              <CaseAnalysisPanel businessCase={businessCase} disabled={!canEdit} />
            )}
            <div className="sa-question-heading">
              <h3>
                {workspace.actor.role === 'INFRA'
                  ? '할당을 위한 공통 정보'
                  : '직접 입력하고 확인하기'}
              </h3>
              <span>{applicantAnswers.length}개 항목</span>
            </div>
            <AnswerEditor
              key={`${id}:${workspace.actor.userId}`}
              answers={businessCase.answers}
              actorRole={workspace.actor.role}
              revision={businessCase.revision}
              disabled={!canEdit}
              save={(revision, answers) => workspace.saveCase(id, revision, answers)}
              highlightedFields={highlighted}
              reasons={reasons}
              memory={
                workspace.mode === 'live'
                  ? {
                      scope: `${workspace.actor.institutionId}:${workspace.actor.userId}`,
                      key: `starter-case:${id}`,
                    }
                  : undefined
              }
            />
          </div>
        </section>
        <aside className="sa-card sa-collected">
          <div className="sa-collected-header">
            <h2>수집된 정보</h2>
            <span>
              <strong>{progress}</strong> / {businessCase.answers.length} 확인
            </span>
          </div>
          <progress
            value={progress}
            max={businessCase.answers.length}
            aria-label="공통 정보 사람 확인 진행률"
          />
          <p className="sa-field-help">확인되지 않은 AI 제안은 확인 수에 포함하지 않습니다.</p>
          <div className="sa-collected-scroll">
            {businessCase.answers.map((answer) => (
              <AnswerReadout
                key={answer.key}
                answer={answer}
                idPrefix="collected-answer"
                highlighted={highlighted.includes(answer.key)}
                reason={reasons[answer.key]}
              />
            ))}
          </div>
          <div className="sa-collected-footer">
            <p>공통 정보를 저장한 뒤 각 서류의 추가 질문을 작성하고 협의를 요청하세요.</p>
            {requests.map((request) => (
              <Link
                className="sa-button"
                href={workspacePath(workspace.mode, `/security-requests/${request.id}`)}
                key={request.id}
              >
                {DOCUMENT_LABELS[request.docType]} 작성
                <Icon name="arrow" width={18} height={18} />
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
