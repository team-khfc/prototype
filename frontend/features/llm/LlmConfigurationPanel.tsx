'use client';

import { useState } from 'react';
import { useSession } from '@/features/auth';
import { Empty, ErrorNotice, Icon, Loading } from '@/components/ui';
import { useLlmConfigurations, useRegisterLlmConfiguration } from './useLlmConfiguration';
import {
  MODEL_PURPOSE_LABELS,
  type LlmConfiguration,
  type RegisterLlmConfigurationInput,
} from './types';

const INITIAL_CONNECTION: RegisterLlmConfigurationInput['connection'] = {
  provider: 'OPENAI',
  endpoint: '',
  model: '',
  keyReference: 'SA_OPENAI_API_KEY',
  temperature: 0.2,
  maxTokens: 2048,
  timeoutSeconds: 30,
};
/** 비밀값 입력 없이 환경변수 참조와 허용된 모델 연결을 등록한다. */
export function LlmConfigurationForm({
  pending,
  register,
  template,
}: {
  pending: boolean;
  register: (input: RegisterLlmConfigurationInput) => Promise<unknown>;
  template?: LlmConfiguration;
}) {
  const [connection, setConnection] = useState<RegisterLlmConfigurationInput['connection']>(() =>
    template && template.connection.provider !== 'EXAMPLE'
      ? { ...template.connection, provider: template.connection.provider }
      : INITIAL_CONNECTION,
  );
  const [purpose, setPurpose] = useState<RegisterLlmConfigurationInput['purpose']>(
    template?.purpose ?? 'INTERVIEW',
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="sa-card sa-settings-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(undefined);
        setSaved(false);
        try {
          if (!reason.trim()) throw new Error('모델 구성 등록 사유를 입력해 주세요.');
          await register({
            connection: {
              ...connection,
              endpoint: connection.endpoint.trim(),
              model: connection.model.trim(),
            },
            purpose,
            reason: reason.trim(),
          });
          setSaved(true);
          setReason('');
        } catch (failure) {
          setError(failure);
        }
      }}
    >
      <div className="sa-section-heading">
        <h2>모델 연결 등록</h2>
        <Icon name="sparkle" />
      </div>
      <p className="sa-muted">
        기존 구성을 바꾸지 않고 새 연결을 등록합니다. 실제 연결 주소와 사용 권한은 서버가
        검증합니다.
      </p>
      <ErrorNotice error={error} />
      {saved && (
        <p className="sa-save-feedback" role="status">
          서버에 모델 연결을 등록했습니다. 자료 분석에서 모델을 선택할 수 있습니다.
        </p>
      )}
      <div className="sa-settings-grid">
        <div className="sa-field">
          <label htmlFor="model-provider">
            공급자 <span className="sa-required">필수</span>
          </label>
          <select
            id="model-provider"
            value={connection.provider}
            disabled={pending}
            onChange={(event) => {
              const provider = event.target.value === 'GEMMA' ? 'GEMMA' : 'OPENAI';
              setConnection({
                ...connection,
                provider,
                endpoint: '',
                model: '',
                keyReference: provider === 'OPENAI' ? 'SA_OPENAI_API_KEY' : 'SA_GEMMA_API_KEY',
              });
            }}
          >
            <option value="OPENAI">OpenAI</option>
            <option value="GEMMA">Gemma</option>
          </select>
        </div>
        <div className="sa-field">
          <label htmlFor="model-purpose">
            용도 <span className="sa-required">필수</span>
          </label>
          <select
            id="model-purpose"
            value={purpose}
            disabled={pending}
            onChange={(event) =>
              setPurpose(event.target.value as RegisterLlmConfigurationInput['purpose'])
            }
          >
            {Object.entries(MODEL_PURPOSE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="sa-field">
        <label htmlFor="model-name">
          모델명 <span className="sa-required">필수</span>
        </label>
        <input
          id="model-name"
          required
          maxLength={160}
          value={connection.model}
          disabled={pending}
          onChange={(event) => setConnection({ ...connection, model: event.target.value })}
          placeholder="서버에서 허용한 모델명"
        />
      </div>
      <div className="sa-field">
        <label htmlFor="model-endpoint">
          연결 주소 <span className="sa-required">필수</span>
        </label>
        <input
          id="model-endpoint"
          type="url"
          required
          maxLength={500}
          value={connection.endpoint}
          disabled={pending}
          onChange={(event) => setConnection({ ...connection, endpoint: event.target.value })}
          aria-describedby="model-endpoint-help"
        />
        <small id="model-endpoint-help">
          서버 허용 목록에 등록된 HTTPS 주소만 사용할 수 있습니다.
        </small>
      </div>
      <div className="sa-field">
        <label htmlFor="model-key-reference">환경변수 키 참조</label>
        <input
          id="model-key-reference"
          readOnly
          value={connection.keyReference}
          aria-describedby="model-key-help"
        />
        <small id="model-key-help">
          API 키 값은 입력하지 않습니다. 서버 환경변수에 설정된 값을 사용합니다.
        </small>
      </div>
      <div className="sa-settings-grid sa-three-columns">
        <div className="sa-field">
          <label htmlFor="model-temperature">응답 다양성</label>
          <input
            id="model-temperature"
            type="number"
            min={0}
            max={1}
            step={0.1}
            required
            value={connection.temperature}
            disabled={pending}
            onChange={(event) =>
              setConnection({ ...connection, temperature: Number(event.target.value) })
            }
          />
          <small>0~1</small>
        </div>
        <div className="sa-field">
          <label htmlFor="model-tokens">최대 출력 토큰</label>
          <input
            id="model-tokens"
            type="number"
            min={256}
            max={4096}
            step={1}
            required
            value={connection.maxTokens}
            disabled={pending}
            onChange={(event) =>
              setConnection({ ...connection, maxTokens: Number(event.target.value) })
            }
          />
          <small>256~4,096</small>
        </div>
        <div className="sa-field">
          <label htmlFor="model-timeout">대기 시간(초)</label>
          <input
            id="model-timeout"
            type="number"
            min={5}
            max={60}
            step={1}
            required
            value={connection.timeoutSeconds}
            disabled={pending}
            onChange={(event) =>
              setConnection({ ...connection, timeoutSeconds: Number(event.target.value) })
            }
          />
          <small>5~60초</small>
        </div>
      </div>
      <div className="sa-field">
        <label htmlFor="model-reason">
          등록 사유 <span className="sa-required">필수</span>
        </label>
        <textarea
          id="model-reason"
          required
          maxLength={500}
          rows={3}
          value={reason}
          disabled={pending}
          onChange={(event) => setReason(event.target.value)}
          placeholder="새 구성을 등록하는 이유를 작성해 주세요."
        />
      </div>
      <div className="sa-form-actions">
        <p className="sa-meta">구성 저장은 실제 모델 호출 성공을 의미하지 않습니다.</p>
        <button className="sa-button sa-primary" type="submit" disabled={pending || !reason.trim()}>
          {pending ? '등록 중…' : '모델 연결 등록'}
        </button>
      </div>
    </form>
  );
}
/** 모델 관리 UI는 실제 관리자 세션 안에서만 운영 API를 조회한다. */
export function LlmConfigurationPanel() {
  const { user } = useSession();
  const configurations = useLlmConfigurations();
  const registration = useRegisterLlmConfiguration();
  const [template, setTemplate] = useState<LlmConfiguration>();
  if (user.role !== 'ADMIN')
    return (
      <Empty
        title="기관 관리자만 모델을 관리할 수 있습니다"
        description="사용할 수 있는 모델은 자료 분석 화면에서 선택할 수 있습니다."
      />
    );
  return (
    <div className="sa-settings-stack">
      <section className="sa-card">
        <div className="sa-section-heading">
          <h2>등록된 모델 연결</h2>
          <span className="sa-badge sa-neutral">기관 단위 · 서버 저장</span>
        </div>
        {configurations.isPending ? (
          <Loading />
        ) : configurations.error ? (
          <ErrorNotice error={configurations.error} retry={() => void configurations.refetch()} />
        ) : !configurations.data?.length ? (
          <Empty
            title="등록된 모델 연결이 없습니다"
            description="예시 추출기는 기본으로 제공됩니다. 실제 모델을 사용하려면 아래에서 연결을 등록해 주세요."
          />
        ) : (
          <div className="sa-model-list">
            {configurations.data.map((item) => (
              <article key={item.id} className="sa-model-item">
                <div>
                  <span className="sa-badge sa-info">{MODEL_PURPOSE_LABELS[item.purpose]}</span>
                  <h3>
                    {item.connection.provider} · {item.connection.model}
                  </h3>
                  <p>{item.connection.endpoint || '예시 추출기 · 실제 AI 호출 없음'}</p>
                  <small>
                    키 참조: {item.connection.keyReference || '사용 안 함'} · 최대{' '}
                    {item.connection.maxTokens.toLocaleString('ko-KR')} 토큰 ·{' '}
                    {item.connection.timeoutSeconds}초
                  </small>
                </div>
                {item.connection.provider !== 'EXAMPLE' && (
                  <button className="sa-button sa-tertiary" onClick={() => setTemplate(item)}>
                    이 구성으로 새 등록
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <LlmConfigurationForm
        key={template?.id ?? 'new'}
        template={template}
        pending={registration.isPending}
        register={(input) => registration.mutateAsync(input)}
      />
    </div>
  );
}
