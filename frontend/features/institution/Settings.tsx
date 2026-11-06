'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemoryDraft, useSession } from '@/features/auth';
import { settingsSchema, type Settings } from './types';
import { ROLE_LABELS, type Policy, type ExtraQuestion } from '@/lib/sharedTypes';
import { requestJson } from '@/lib/http';
import { formatDate } from '@/lib/format';
import { createVersionedDraft, reconcileVersionedDraft } from '@/lib/versionedDraft';
import { Badge, Heading, Icon, Notice, ErrorNotice, Loading, Modal, Empty } from '@/components/ui';

export const ADMIN_TABS = [
  ['questions', '인터뷰 질문'],
  ['workflow', '검토 절차'],
  ['versions', '설정 버전'],
  ['models', 'AI 모델'],
  ['context', '기관 컨텍스트'],
] as const;
const tabLabels: Record<string, string> = {
  questions: '인터뷰 질문',
  workflow: '검토 절차',
  versions: '설정 버전',
  models: 'AI 모델',
  context: '기관 컨텍스트',
};
/** 기관 설정의 수정 초안과 현재 게시본을 서로 다른 버전 표시로 구분한다. */
export function AdminHeader({
  settings,
  tab,
  preview = false,
}: {
  settings: Settings;
  tab: string;
  preview?: boolean;
}) {
  return (
    <>
      <Heading
        title="기관 설정"
        description="질문과 검토 절차를 관리하고, 준비된 설정을 새 신청부터 적용하세요."
      >
        <Badge tone="green">게시본 v{settings.publishedVersion}</Badge>
        <Badge tone="amber">수정 초안 r{settings.revision}</Badge>
      </Heading>
      <div className="admin-status">
        <div>
          <span className="institution-icon">
            <Icon name="building" width={28} height={28} />
          </span>
          <div>
            <strong>{settings.draft.institutionName}</strong>
            <p>기관 관리자 · 설정의 변경과 적용 범위를 확인해 주세요.</p>
          </div>
        </div>
        <span>기존 신청의 설정 버전 유지</span>
      </div>
      <nav className="section-nav" aria-label="기관 설정 분류">
        {Object.entries(tabLabels).map(([path, title]) => (
          <Link
            key={path}
            className={tab === path ? 'selected' : ''}
            aria-current={tab === path ? 'page' : undefined}
            href={preview ? `/design-preview/admin?tab=${path}` : `/admin/${path}`}
          >
            {title}
            {path === 'questions' && <span> {settings.draft.questions.length}</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}
/** 저장·게시의 실제 동작은 컨테이너에 위임하고 지정 시안과 읽기전용 화면에 같은 구성을 쓴다. */
export function AdminView({
  settings,
  policy,
  tab,
  preview = false,
  busy = false,
  error,
  onChange,
  onSave,
  onPublish,
  localDirty = false,
  publishedDiff = false,
  children,
}: {
  settings: Settings;
  policy: Policy;
  tab: string;
  preview?: boolean;
  busy?: boolean;
  error?: unknown;
  onChange?: (policy: Policy) => void;
  onSave?: () => void;
  onPublish?: () => void;
  localDirty?: boolean;
  publishedDiff?: boolean;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState(policy.questions[0]?.key ?? '');
  const selected =
    policy.questions.find((question) => question.key === selectedKey) ?? policy.questions[0];
  const locked = preview || busy;
  function editQuestion(patch: Partial<ExtraQuestion>) {
    if (!selected) return;
    const next = { ...selected, ...patch };
    onChange?.({
      ...policy,
      questions: policy.questions.map((question) =>
        question.key === selected.key ? next : question,
      ),
    });
    if (patch.key !== undefined) setSelectedKey(patch.key);
  }
  function add() {
    let index = 1;
    while (policy.questions.some((question) => question.key === `custom_q${index}`)) index += 1;
    const key = `custom_q${index}`;
    onChange?.({
      ...policy,
      questions: [
        ...policy.questions,
        { key, label: '새 확인 질문', reason: '', ownerRole: 'APPLICANT', required: false },
      ],
    });
    setSelectedKey(key);
  }
  return (
    <>
      <AdminHeader settings={settings} tab={tab} preview={preview} />
      <ErrorNotice error={error} />
      {tab === 'questions' && (
        <>
          <div className="admin-grid">
            <section className="sf-panel question-list">
              <div className="panel-heading">
                <h2>기관 추가 질문</h2>
                <button
                  className="icon-button"
                  type="button"
                  disabled={locked || policy.questions.length >= 30}
                  aria-label="기관 질문 추가"
                  onClick={add}
                >
                  <Icon name="plus" />
                </button>
              </div>
              <label className="sr-only" htmlFor="question-search">
                질문 검색
              </label>
              <div className="search-input">
                <Icon name="search" />
                <input
                  id="question-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="질문 검색"
                />
              </div>
              <div className="question-items">
                {policy.questions
                  .filter((question) => `${question.label} ${question.key}`.includes(query))
                  .map((question, index) => (
                    <button
                      type="button"
                      key={question.key}
                      className={question.key === selected?.key ? 'selected' : ''}
                      onClick={() => setSelectedKey(question.key)}
                    >
                      <span className="question-order">{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{question.label}</strong>
                        <small>
                          {ROLE_LABELS[question.ownerRole]} ·{' '}
                          {question.required ? '제출 전 필수' : '선택'}
                        </small>
                      </div>
                      <Icon name="arrow" width={16} height={16} />
                    </button>
                  ))}
              </div>
              {!policy.questions.length && (
                <Empty
                  title="추가 질문이 없습니다"
                  description="기본 질문에 더해 기관의 확인 항목을 추가할 수 있습니다."
                />
              )}
              <p className="role-caption">
                사업 목적·이용 대상·처리 정보 등 기본 질문은 공통 기준으로 유지됩니다.
              </p>
            </section>
            <section className="sf-panel question-editor">
              {selected ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <span className="overline">질문 설정</span>
                      <h2>{selected.label}</h2>
                    </div>
                    <Badge tone="amber">수정 초안</Badge>
                  </div>
                  <div className="sf-field">
                    <label htmlFor="question-title">
                      질문 문구 <span className="required">필수</span>
                    </label>
                    <input
                      id="question-title"
                      required
                      maxLength={160}
                      value={selected.label}
                      disabled={locked}
                      onChange={(event) => editQuestion({ label: event.target.value })}
                    />
                  </div>
                  <div className="sf-field">
                    <label htmlFor="question-key">
                      저장 키 <span className="required">필수</span>
                    </label>
                    <p className="field-hint">
                      기존 질문의 키는 유지됩니다. 다른 항목으로 바꾸려면 새 질문을 추가해 주세요.
                    </p>
                    <input id="question-key" className="mono" value={selected.key} readOnly />
                  </div>
                  <div className="sf-field">
                    <label htmlFor="question-description">
                      작성 이유와 도움말 <span className="required">필수</span>
                    </label>
                    <textarea
                      id="question-description"
                      rows={3}
                      maxLength={500}
                      disabled={locked}
                      value={selected.reason}
                      onChange={(event) => editQuestion({ reason: event.target.value })}
                      placeholder="왜 필요한지와 모르는 경우 누가 확인할지 안내해 주세요."
                    />
                  </div>
                  <div className="field-grid">
                    <div className="sf-field">
                      <label htmlFor="question-type">응답 형식</label>
                      <input id="question-type" value="텍스트 답변" readOnly />
                    </div>
                    <div className="sf-field">
                      <label htmlFor="question-role">작성 역할</label>
                      <select
                        id="question-role"
                        value={selected.ownerRole}
                        disabled={locked}
                        onChange={(event) =>
                          editQuestion({
                            ownerRole: event.target.value as ExtraQuestion['ownerRole'],
                          })
                        }
                      >
                        <option value="APPLICANT">일반 사용자</option>
                        <option value="SECURITY">정보보안</option>
                        <option value="INFRA">ICT인프라</option>
                      </select>
                    </div>
                  </div>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={selected.required}
                      disabled={locked}
                      onChange={(event) => editQuestion({ required: event.target.checked })}
                    />
                    최종 제출 전 필수 확인 질문
                  </label>
                  <Notice>
                    질문 추가·수정·삭제는 초안에 저장됩니다. 게시 이후 생성한 신청에만 반영됩니다.
                    기존 신청의 질문과 답변은 유지됩니다.
                  </Notice>
                  <button
                    className="text-button"
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      onChange?.({
                        ...policy,
                        questions: policy.questions.filter(
                          (question) => question.key !== selected.key,
                        ),
                      });
                      setSelectedKey('');
                    }}
                  >
                    이 질문을 설정 초안에서 삭제
                  </button>
                </>
              ) : (
                <Empty
                  title="편집할 질문을 선택해 주세요"
                  description="왼쪽의 더하기 버튼으로 기관 추가 질문을 만들 수 있습니다."
                />
              )}
            </section>
          </div>
        </>
      )}
      {tab === 'workflow' && (
        <section className="sf-panel workflow-panel">
          <h2>기관 검토 절차</h2>
          <p>
            현재 게시 절차:{' '}
            <strong>
              {settings.published.reviewMode === 'PARALLEL' ? '병렬 검토' : '순차 검토'}
            </strong>
          </p>
          <fieldset disabled={locked}>
            <legend>새 신청에 적용할 절차</legend>
            <div className="workflow-options">
              {[
                [
                  'PARALLEL',
                  '병렬 검토',
                  '두 담당 분야가 함께 검토하고 필수 분야를 마치면 제출합니다.',
                ],
                [
                  'SEQUENTIAL',
                  '순차 검토',
                  '정보보안 검토를 완료한 후 ICT인프라 검토를 진행합니다.',
                ],
              ].map(([value, label, description]) => (
                <label key={value} className={policy.reviewMode === value ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="workflow"
                    value={value}
                    checked={policy.reviewMode === value}
                    onChange={() =>
                      onChange?.({ ...policy, reviewMode: value as Policy['reviewMode'] })
                    }
                  />
                  <div>
                    <strong>{label}</strong>
                    <p>{description}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="check-row">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={policy.requireSecurity}
                  onChange={(event) =>
                    onChange?.({ ...policy, requireSecurity: event.target.checked })
                  }
                />
                정보보안 검토 필수
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={policy.requireInfra}
                  onChange={(event) =>
                    onChange?.({ ...policy, requireInfra: event.target.checked })
                  }
                />
                ICT인프라 검토 필수
              </label>
            </div>
          </fieldset>
          <div className="workflow-preview">
            <span>신청 등록</span>
            <Icon name="arrow" />
            <span>
              {policy.reviewMode === 'PARALLEL' ? '정보보안 + ICT인프라' : '정보보안 → ICT인프라'}
            </span>
            <Icon name="arrow" />
            <span>사용자 보완·제출</span>
          </div>
          <div className="sf-field">
            <label htmlFor="document-footer">생성 문서의 안내 문구</label>
            <textarea
              id="document-footer"
              rows={3}
              value={policy.documentFooter}
              maxLength={1000}
              disabled={locked}
              onChange={(event) => onChange?.({ ...policy, documentFooter: event.target.value })}
            />
          </div>
          <Notice>
            게시 후 새로 생성하는 신청부터 적용됩니다. 기존 신청은 생성 시점의 게시 버전과 절차를
            유지합니다.
          </Notice>
        </section>
      )}
      {tab === 'versions' && (
        <section className="sf-panel">
          <div className="panel-heading">
            <h2>게시 이력</h2>
            <Icon name="clock" />
          </div>
          <div className="table-scroll">
            <table className="sf-table">
              <caption className="sr-only">기관 설정 게시 버전과 적용 범위</caption>
              <thead>
                <tr>
                  <th scope="col">버전</th>
                  <th scope="col">상태</th>
                  <th scope="col">게시 시각</th>
                  <th scope="col">게시 담당자</th>
                  <th scope="col">적용 범위</th>
                </tr>
              </thead>
              <tbody>
                {settings.history.map((history) => (
                  <tr key={history.version}>
                    <td>v{history.version}</td>
                    <td>
                      <Badge
                        tone={history.version === settings.publishedVersion ? 'green' : 'gray'}
                      >
                        {history.version === settings.publishedVersion
                          ? '현재 게시본'
                          : '이전 게시본'}
                      </Badge>
                    </td>
                    <td>{formatDate(history.publishedAt, true)}</td>
                    <td>{history.publishedBy}</td>
                    <td>해당 게시본으로 생성한 신청</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Notice>
            과거 버전의 질문·절차는 기존 신청에 고정됩니다. 초안 저장과 설정 게시는 별도 작업입니다.
          </Notice>
        </section>
      )}
      {tab === 'models' && (
        <section className="sf-panel form-panel">
          <div className="panel-heading">
            <div>
              <span className="overline">연결 설정</span>
              <h2>AI 분석 모델</h2>
            </div>
            <Badge tone={policy.model.provider === 'EXAMPLE' ? 'gray' : 'blue'}>
              {policy.model.provider === 'EXAMPLE' ? '예시 분석' : '실제 연결 설정'}
            </Badge>
          </div>
          <Notice>
            여기에서는 연결 구성을 저장합니다. 실제 모델 응답의 성공 여부는 신청의 자료·AI 제안
            화면에서 명시적으로 분석을 실행한 뒤 이력으로 확인합니다.
          </Notice>
          <div className="field-grid">
            <div className="sf-field">
              <label htmlFor="model-provider">모델 제공 방식</label>
              <select
                id="model-provider"
                value={policy.model.provider}
                disabled={locked}
                onChange={(event) => {
                  const provider = event.target.value as Policy['model']['provider'];
                  onChange?.({
                    ...policy,
                    model: {
                      ...policy.model,
                      provider,
                      endpoint: provider === 'EXAMPLE' ? '' : policy.model.endpoint,
                      model: provider === 'EXAMPLE' ? 'extractive-demo' : '',
                      keyReference:
                        provider === 'OPENAI'
                          ? 'BOAN_OPENAI_API_KEY'
                          : provider === 'GEMMA'
                            ? 'BOAN_GEMMA_API_KEY'
                            : '',
                    },
                  });
                }}
              >
                <option value="EXAMPLE">예시 분석 · 외부 LLM 호출 없음</option>
                <option value="OPENAI">OpenAI 어댑터</option>
                <option value="GEMMA">Gemma · Google Gemini API</option>
              </select>
            </div>
            <div className="sf-field">
              <label htmlFor="model-name">모델 식별자</label>
              <input
                id="model-name"
                value={policy.model.model}
                maxLength={120}
                disabled={locked}
                onChange={(event) =>
                  onChange?.({ ...policy, model: { ...policy.model, model: event.target.value } })
                }
              />
            </div>
          </div>
          <div className="sf-field">
            <label htmlFor="model-endpoint">HTTPS 엔드포인트</label>
            <p className="field-hint">
              서버 운영자가 허용 목록에 등록한 주소만 연결할 수 있습니다.
            </p>
            <input
              id="model-endpoint"
              type="url"
              value={policy.model.endpoint}
              maxLength={500}
              disabled={locked || policy.model.provider === 'EXAMPLE'}
              onChange={(event) =>
                onChange?.({ ...policy, model: { ...policy.model, endpoint: event.target.value } })
              }
            />
          </div>
          <div className="sf-field">
            <label htmlFor="model-reference">비밀값 참조 이름</label>
            <p className="field-hint">
              실제 API 키를 입력하지 마세요. 서버 환경변수의 이름만 저장합니다.
            </p>
            <input id="model-reference" value={policy.model.keyReference} readOnly />
          </div>
          <div className="field-grid">
            {(
              [
                ['temperature', '온도', 0, 1, 0.1],
                ['maxTokens', '최대 출력 토큰', 256, 4096, 1],
                ['timeoutSeconds', '요청 제한 시간(초)', 5, 60, 1],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <div className="sf-field" key={key}>
                <label htmlFor={`model-${key}`}>{label}</label>
                <input
                  id={`model-${key}`}
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={policy.model[key]}
                  disabled={locked}
                  onChange={(event) =>
                    onChange?.({
                      ...policy,
                      model: { ...policy.model, [key]: Number(event.target.value) },
                    })
                  }
                />
              </div>
            ))}
          </div>
          <Notice>
            Gemma는 Google Gemini API 연결입니다. 연결 실패를 예시 분석 성공으로 바꾸지 않습니다.
            기관의 비공개 컨텍스트는 외부 AI에 전달하지 않습니다.
          </Notice>
        </section>
      )}
      {children}
      {tab !== 'context' && (
        <div className="admin-save">
          <div>
            <strong>
              {localDirty
                ? '저장하지 않은 변경이 있습니다.'
                : publishedDiff
                  ? '게시하지 않은 설정 초안이 있습니다.'
                  : '게시된 설정과 동일합니다.'}
            </strong>
            <p>
              {localDirty
                ? '초안 저장 후 변경 내용을 확인하고 게시해 주세요.'
                : '게시한 설정은 이후 새 신청부터 적용됩니다.'}
            </p>
          </div>
          <div className="form-actions compact">
            <button
              className="button primary"
              type="button"
              disabled={preview || busy || localDirty || !publishedDiff}
              onClick={onPublish}
            >
              변경 검토·게시
              <Icon name="arrow" />
            </button>
            <button
              className="button"
              type="button"
              disabled={preview || busy || !localDirty}
              onClick={onSave}
            >
              초안 저장
            </button>
          </div>
        </div>
      )}
    </>
  );
}
/** 기관 설정은 서버 세션의 관리자 역할에서만 조회를 시도하며 서버 권한 검증을 따른다. */
export function SettingsPage({ tab }: { tab: string }) {
  const session = useSession();
  const query = useQuery({
    queryKey: ['settings', session.user.institutionId, session.user.userId],
    queryFn: ({ signal }) => requestJson('/institution/settings', settingsSchema, { signal }),
    enabled: session.user.role === 'ADMIN',
  });
  if (session.user.role !== 'ADMIN')
    return <Notice>기관 설정은 기관 관리자 계정에서 관리합니다.</Notice>;
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  return <SettingsEditor settings={query.data} tab={tab} onRefresh={() => query.refetch()} />;
}
function SettingsEditor({
  settings,
  tab,
  onRefresh,
}: {
  settings: Settings;
  tab: string;
  onRefresh: () => Promise<{ data?: Settings }>;
}) {
  const session = useSession();
  const client = useQueryClient();
  const [draft, setDraft, clear] = useMemoryDraft(
    'institution-settings',
    createVersionedDraft(settings.revision, settings.draft),
  );
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const key = useRef<string | undefined>(undefined);
  const synchronized = reconcileVersionedDraft(draft, settings.revision, settings.draft);
  if (synchronized !== draft) setDraft(synchronized);
  const queryKey = ['settings', session.user.institutionId, session.user.userId];
  const localDirty = JSON.stringify(draft.value) !== JSON.stringify(settings.draft);
  const publishedDiff = JSON.stringify(settings.draft) !== JSON.stringify(settings.published);
  const save = useMutation({
    mutationFn: () =>
      requestJson('/institution/settings', settingsSchema, {
        method: 'PUT',
        body: JSON.stringify({ expectedRevision: draft.revision, policy: draft.value }),
      }),
    onSuccess: (response) => {
      client.setQueryData(queryKey, response);
      setDraft(createVersionedDraft(response.revision, response.draft));
      clear();
      setMessage('설정 초안을 저장했습니다. 게시하기 전까지 새 신청에 적용되지 않습니다.');
    },
  });
  const publish = useMutation({
    mutationFn: () => {
      key.current ??= crypto.randomUUID();
      return requestJson('/institution/settings/publish', settingsSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': key.current },
        body: JSON.stringify({ expectedRevision: settings.revision }),
      });
    },
    onSuccess: (response) => {
      client.setQueryData(queryKey, response);
      setDraft(createVersionedDraft(response.revision, response.draft));
      clear();
      key.current = undefined;
      setOpen(false);
      setMessage(`설정 v${response.publishedVersion}을 게시했습니다. 이후 새 신청부터 적용됩니다.`);
    },
  });
  return (
    <>
      {message && (
        <p className="action-feedback" role="status">
          {message}
        </p>
      )}
      <AdminView
        settings={settings}
        policy={draft.value}
        tab={tab}
        busy={save.isPending || publish.isPending}
        error={save.error ?? publish.error}
        localDirty={localDirty}
        publishedDiff={publishedDiff}
        onChange={(policy) => {
          setDraft({ ...draft, value: policy });
          setMessage('');
        }}
        onSave={() => save.mutate()}
        onPublish={() => setOpen(true)}
      />
      {save.error && (
        <button
          className="text-button"
          type="button"
          onClick={() =>
            void onRefresh().then((response) => {
              if (response.data) {
                setDraft((current) => ({ ...current, revision: response.data!.revision }));
                setMessage(
                  `최신 설정 초안 r${response.data.revision}을 불러왔습니다. 입력은 유지했으니 게시본·현재 초안과 비교 후 저장해 주세요.`,
                );
              }
            })
          }
        >
          최신 설정 버전 확인 · 입력 유지
        </button>
      )}
      <Modal open={open} title="기관 설정 변경 검토·게시" onClose={() => setOpen(false)}>
        <Notice>
          설정 게시본 v{settings.publishedVersion + 1}을 만듭니다. 기존 신청의 설정은 바뀌지
          않습니다.
        </Notice>
        <div className="table-scroll">
          <table className="sf-table">
            <caption className="sr-only">현재 게시본과 저장된 수정 초안 비교</caption>
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">현재 게시본</th>
                <th scope="col">게시할 초안</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">검토 절차</th>
                <td>{settings.published.reviewMode}</td>
                <td>{settings.draft.reviewMode}</td>
              </tr>
              <tr>
                <th scope="row">정보보안 필수</th>
                <td>{String(settings.published.requireSecurity)}</td>
                <td>{String(settings.draft.requireSecurity)}</td>
              </tr>
              <tr>
                <th scope="row">인프라 필수</th>
                <td>{String(settings.published.requireInfra)}</td>
                <td>{String(settings.draft.requireInfra)}</td>
              </tr>
              <tr>
                <th scope="row">기관 추가 질문</th>
                <td>
                  {settings.published.questions.map((question) => question.label).join(', ') ||
                    '없음'}
                </td>
                <td>
                  {settings.draft.questions
                    .map(
                      (question) =>
                        `${question.label} (${ROLE_LABELS[question.ownerRole]}·${question.required ? '필수' : '선택'})`,
                    )
                    .join(', ') || '없음'}
                </td>
              </tr>
              <tr>
                <th scope="row">AI 제공 방식</th>
                <td>{settings.published.model.provider}</td>
                <td>
                  {settings.draft.model.provider} · {settings.draft.model.model}
                </td>
              </tr>
              <tr>
                <th scope="row">문서 안내</th>
                <td>{settings.published.documentFooter}</td>
                <td>{settings.draft.documentFooter}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ErrorNotice error={publish.error} />
        <div className="dialog-actions">
          <button className="button" type="button" onClick={() => setOpen(false)}>
            돌아가서 수정
          </button>
          <button
            className="button primary"
            type="button"
            disabled={publish.isPending}
            onClick={() => publish.mutate()}
          >
            {publish.isPending ? '게시 확인 중…' : '새 신청에 적용하도록 게시'}
          </button>
        </div>
      </Modal>
    </>
  );
}
