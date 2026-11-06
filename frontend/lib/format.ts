import type { Procedure } from '@/features/procedure';
/** 업무 일시는 서버의 UTC 값과 무관하게 한국 시간으로 일관되게 표시한다. */
export function formatDate(value: string, time = false): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '확인 필요';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(date);
}
/** 긴 UUID를 화면에서 식별하기 쉽게 축약하되 API에는 원본 식별자를 사용한다. */
export function shortId(id: string): string {
  return `SF-${id.slice(0, 8).toUpperCase()}`;
}
/** 초안·협의·제출·접수와 미해소 보완의 업무 의미를 분리한다. */
export function statusLabel(item: Procedure): string {
  if (item.status === 'DRAFT') return '작성 중';
  if (item.status === 'SUBMITTED') return '제출 완료';
  if (item.status === 'RECEIVED') return '접수 완료';
  if (item.supplements.some((entry) => entry.status !== 'RESOLVED')) return '보완 요청';
  if (item.allowedActions.includes('SUBMIT')) return '제출 준비';
  return '사전 협의 중';
}
/** 계약의 두 문서 유형을 사용자가 이해하는 서류 이름으로 표시한다. */
export function documentLabel(type: Procedure['documentType']): string {
  return type === 'FIREWALL' ? '방화벽 신청서' : '보안성검토 신청서';
}
/** 목록의 다음 화면을 안내할 뿐 서버 업무 상태나 권한을 바꾸지 않는다. */
export function stepPath(item: Procedure, role: string): string {
  const step =
    item.status === 'DRAFT'
      ? 'analysis'
      : item.status === 'SUBMITTED' || item.status === 'RECEIVED'
        ? 'receipt'
        : role === 'SECURITY'
          ? 'security'
          : role === 'INFRA'
            ? 'infra'
            : item.supplements.some((entry) => entry.status !== 'RESOLVED')
              ? 'supplement'
              : 'submit';
  return `/requests/${item.id}/${step}`;
}

/** 저장된 코드 값은 유지하고 사용자가 읽는 외부 전송 답변만 한국어로 표시한다. */
export function formatAnswerValue(key: string, value: string): string {
  if (!value) return '담당자 확인 필요';
  if (key !== 'externalTransfer') return value;
  const labels: Record<string, string> = { NO: '아니요', YES: '예', UNKNOWN: '잘 모름' };
  return labels[value] ?? value;
}

/** 조회 기간 필터도 화면 날짜와 같은 한국 시간대를 사용하도록 맞춘다. */
export function localDateKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
