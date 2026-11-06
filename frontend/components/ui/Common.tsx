'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ApiError } from '@/lib/http';
import { Icon } from './Icon';

/** 업무 상태 안내와 실패 안내를 구분하고 실패는 보조기기에도 알린다. */
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`sa-notice${error ? ' sa-error' : ''}`} role={error ? 'alert' : undefined}>
      <Icon name="info" />
      <div>{children}</div>
    </div>
  );
}
/** 실패·충돌을 성공처럼 표시하지 않고 문의 번호와 입력 유지 사실을 전달한다. */
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  const conflict = error instanceof ApiError && error.status === 409;
  return (
    <Notice error>
      <strong>
        {conflict ? '다른 변경이 먼저 저장되었습니다.' : '요청을 완료하지 못했습니다.'}
      </strong>
      <p>{error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'}</p>
      {conflict && <p>현재 입력은 유지했습니다. 최신 저장 내용을 확인한 뒤 다시 저장해 주세요.</p>}
      {error instanceof ApiError && error.requestId && <small>문의 번호: {error.requestId}</small>}
      {retry && (
        <button type="button" className="sa-text-button" onClick={retry}>
          다시 불러오기
        </button>
      )}
    </Notice>
  );
}
/** 서버 확인 중인 상태가 빈 데이터나 처리 완료로 오해되지 않게 한다. */
export function Loading({ label = '업무 내용을 불러오고 있습니다.' }: { label?: string }) {
  return (
    <section className="sa-loading" role="status">
      <span className="sa-loading-dot" />
      <p>{label}</p>
    </section>
  );
}
/** 허용된 데이터가 없는 경우 검색 변경이나 다음 행동을 안내한다. */
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="sa-empty">
      <Icon name="file" width={40} height={40} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
/** native dialog의 포커스 격리·복귀를 사용하며 재인증 안내만 임의 닫기를 제한한다. */
export function Modal({
  open,
  title,
  children,
  onClose,
  locked = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  locked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      className="sa-dialog"
      onCancel={(event) => {
        if (locked) event.preventDefault();
        else onClose();
      }}
      onClose={() => {
        if (!locked) onClose();
      }}
    >
      <div className="sa-dialog-heading">
        <h2 id={headingId}>{title}</h2>
        {!locked && (
          <button
            className="sa-icon-button"
            type="button"
            onClick={onClose}
            aria-label="대화상자 닫기"
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
}
