'use client';

import { useEffect, useState } from 'react';
import { ErrorNotice, Icon } from '@/components/ui';
import type { Role } from '@/lib/sharedTypes';
import { ROLE_LABELS } from '@/lib/sharedTypes';
import { readDraft, removeDraft, writeDraft } from '@/lib/draft';
import { AnswerReadout, SourceBadge } from './RequestComponents';
import type { Answer, AnswerInput } from './types';

/** 미저장 입력을 서버 revision과 묶어 충돌 때 자동으로 덮어쓰지 않는다. */
export function AnswerEditor({
  answers,
  actorRole,
  revision,
  save,
  disabled,
  highlightedFields = [],
  reasons = {},
  memory,
}: {
  answers: Answer[];
  actorRole: Role;
  revision: number;
  save: (revision: number, inputs: AnswerInput[]) => Promise<void>;
  disabled?: boolean;
  highlightedFields?: string[];
  reasons?: Record<string, string>;
  memory?: { scope: string; key: string };
}) {
  const [initial] = useState(() => {
    const empty = { base: { revision, answers }, inputs: {} as Record<string, AnswerInput> };
    return memory ? readDraft(memory.scope, memory.key, empty) : empty;
  });
  const [base, setBase] = useState(initial.base);
  const [inputs, setInputs] = useState<Record<string, AnswerInput>>(initial.inputs);
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const dirty = Object.keys(inputs).length > 0;
  const memoryScope = memory?.scope;
  const memoryKey = memory?.key;
  useEffect(() => {
    if (!memoryScope || !memoryKey) return;
    if (dirty) writeDraft(memoryScope, memoryKey, { base, inputs });
    else removeDraft(memoryScope, memoryKey);
  }, [base, dirty, inputs, memoryKey, memoryScope]);
  if (!dirty && base.revision !== revision) setBase({ revision, answers });
  const shown = dirty ? base.answers : answers;
  const canEdit = (answer: Answer) =>
    !disabled &&
    (answer.ownerRole === actorRole ||
      (['INFRA', 'SECURITY'].includes(actorRole) && answer.source === 'AI_INFERRED'));
  const editable = shown.filter(canEdit);
  function change(answer: Answer, patch: Partial<AnswerInput>) {
    setInputs((current) => ({
      ...current,
      [answer.key]: {
        ...(current[answer.key] ?? {
          key: answer.key,
          value: answer.value,
          confirmed: answer.confirmed,
          notApplicable: answer.notApplicable,
        }),
        ...patch,
      },
    }));
    setMessage('');
  }
  return (
    <form
      className="sa-answer-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(undefined);
        setMessage('');
        try {
          await save(base.revision, Object.values(inputs));
          setInputs({});
          setMessage('입력 내용을 저장했습니다.');
        } catch (failure) {
          setError(failure);
        } finally {
          setPending(false);
        }
      }}
    >
      {dirty && base.revision !== revision && (
        <div className="sa-callout sa-warning">
          <Icon name="info" />
          <p>
            다른 변경이 먼저 저장되었습니다. 입력은 유지했습니다. 최신 값을 확인한 뒤 다시 작성해
            주세요.
          </p>
          <button
            type="button"
            className="sa-text-button"
            onClick={() => {
              setInputs({});
              setBase({ revision, answers });
              setError(undefined);
            }}
          >
            최신 값 불러오기
          </button>
        </div>
      )}
      <ErrorNotice error={error} />
      {shown.map((answer) => {
        if (!canEdit(answer))
          return (
            <AnswerReadout
              key={answer.key}
              answer={answer}
              highlighted={highlightedFields.includes(answer.key)}
              reason={reasons[answer.key]}
            />
          );
        const input = inputs[answer.key] ?? {
          key: answer.key,
          value: answer.value,
          confirmed: answer.confirmed,
          notApplicable: answer.notApplicable,
        };
        const id = `edit-${answer.scope}-${answer.key}`;
        return (
          <div
            className={`sa-edit-field${highlightedFields.includes(answer.key) ? ' sa-answer-highlight' : ''}`}
            key={answer.key}
            id={`answer-${answer.scope.toLowerCase()}-${answer.key}`}
          >
            <div className="sa-edit-label">
              <label htmlFor={id}>
                {answer.label}
                {answer.required && <span className="sa-required">필수</span>}
              </label>
              <SourceBadge answer={answer} />
            </div>
            <p className="sa-field-help">
              {answer.scope === 'CASE'
                ? '사업 건 공통 · 여러 서류에 함께 사용'
                : '이 서류에서만 사용'}{' '}
              · {ROLE_LABELS[answer.ownerRole]} 입력
            </p>
            {highlightedFields.includes(answer.key) && (
              <p className="sa-return-reason">
                <Icon name="info" width={16} height={16} />
                보완 필요: {reasons[answer.key] ?? '담당자가 지정한 항목을 확인해 주세요.'}
              </p>
            )}
            <textarea
              id={id}
              rows={
                answer.key.includes('Ip') || ['protocol', 'port', 'period'].includes(answer.key)
                  ? 1
                  : 3
              }
              maxLength={4000}
              value={input.value}
              disabled={pending || input.notApplicable}
              readOnly={answer.ownerRole !== actorRole}
              onChange={(event) => change(answer, { value: event.target.value, confirmed: false })}
              aria-describedby={`${id}-confirmation`}
            />
            {answer.evidence && (
              <details className="sa-evidence">
                <summary>AI 추론 근거</summary>
                <p>{answer.evidence}</p>
              </details>
            )}
            <div className="sa-answer-checks" id={`${id}-confirmation`}>
              <label>
                <input
                  type="checkbox"
                  checked={input.confirmed}
                  disabled={pending || (!input.value.trim() && !input.notApplicable)}
                  onChange={(event) => change(answer, { confirmed: event.target.checked })}
                />
                {answer.source === 'AI_INFERRED' ? 'AI 제안을 읽고 내용 확인' : '내용 확인'}
              </label>
              {!answer.required && answer.ownerRole === actorRole && (
                <label>
                  <input
                    type="checkbox"
                    checked={input.notApplicable}
                    disabled={pending}
                    onChange={(event) =>
                      change(answer, {
                        notApplicable: event.target.checked,
                        confirmed: event.target.checked,
                      })
                    }
                  />
                  해당 없음
                </label>
              )}
            </div>
          </div>
        );
      })}
      {editable.length > 0 && (
        <div className="sa-form-actions">
          <span role="status">
            {message ||
              (dirty ? '아직 저장하지 않은 변경이 있습니다.' : '저장된 입력을 표시하고 있습니다.')}
          </span>
          <button
            className="sa-button sa-primary"
            type="submit"
            disabled={!dirty || pending || disabled}
          >
            {pending ? '저장 중…' : '입력 내용 저장'}
          </button>
        </div>
      )}
    </form>
  );
}
