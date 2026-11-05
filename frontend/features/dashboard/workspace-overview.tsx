'use client';

import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Inbox,
  MessageSquareText,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Heading } from '@/components/ui/v3';
import type { Role } from '@/lib/domain';
import { roleName, type Case, type Phase, type State } from '@/lib/prototype';

interface WorkspaceOverviewProps {
  data: State;
  role: Role;
  onOpen: (id: string) => void;
  onList: (phase?: Phase) => void;
  onNew: () => void;
  onSettings: () => void;
}

function nextAction(item: Case, role: Role): string {
  if (item.phase === '제출됨') return '제출본과 후속 절차 확인';
  if (role === 'APPLICANT') {
    if (item.supplements.some((s) => !s.resolved)) return '담당자 보완 요청에 답변해 주세요';
    if (item.phase === '제출 준비') return '미확정 정보를 확인하고 최종 제출';
    return '담당자 협의 진행 상황 확인';
  }
  if (role === 'ADMIN') return `신청 시점 설정 ${item.configVersion} 확인`;
  if (item.workflow === '순차 검토' && role === 'INFRA' && !item.reviews.SECURITY.done) {
    return '정보보안 협의 완료 후 검토 가능';
  }
  if (item.supplements.some((s) => s.role === role && !s.resolved)) return '신청자 보완 답변 대기';
  return item.reviews[role].done ? '담당 분야 협의 완료' : '근거·체크리스트 검토 필요';
}

export function WorkspaceOverview({
  data,
  role,
  onOpen,
  onList,
  onNew,
  onSettings,
}: WorkspaceOverviewProps) {
  const own = data.requests.filter((r) => role !== 'APPLICANT' || r.applicant === '이민주');
  const pending = own
    .filter(
      (r) =>
        r.phase !== '제출됨' &&
        (role === 'SECURITY' || role === 'INFRA' ? !r.reviews[role].done : true),
    )
    .sort((a, b) => a.due.localeCompare(b.due));
  const metrics: { label: string; phase: Phase; icon: typeof Inbox; tone: string }[] = [
    { label: '사전 협의 중', phase: '사전 협의 중', icon: Inbox, tone: 'blue' },
    { label: '보완 요청', phase: '보완 중', icon: MessageSquareText, tone: 'amber' },
    { label: '제출 준비', phase: '제출 준비', icon: CheckCircle2, tone: 'green' },
    { label: '제출 완료', phase: '제출됨', icon: FileText, tone: 'gray' },
  ];
  const recent = own
    .flatMap((item) => item.events.slice(0, 2).map((event) => ({ item, event })))
    .sort((a, b) => b.event.time.localeCompare(a.event.time))
    .slice(0, 4);

  return (
    <>
      <div className="workspace-context">
        <span>디지털혁신기관</span>
        <span>업무 공간</span>
      </div>
      <Heading
        title="업무 한눈에 보기"
        description={`${roleName[role]} 역할에서 확인할 업무와 다음 단계를 모았습니다.`}
      >
        <button
          type="button"
          className="button primary"
          onClick={role === 'APPLICANT' ? onNew : role === 'ADMIN' ? onSettings : () => onList()}
        >
          {role === 'APPLICANT' ? <Plus size={19} /> : <ArrowRight size={19} />}
          {role === 'APPLICANT'
            ? '새 신청 작성'
            : role === 'ADMIN'
              ? '기관 설정 관리'
              : '협의 검토 시작'}
        </button>
      </Heading>
      <section className="workspace-intro" aria-label="업무 안내">
        <div className="workspace-intro-icon">
          <ShieldCheck size={30} />
        </div>
        <div>
          <h2>정보는 함께 확인하고, 판단은 담당자가.</h2>
          <p>
            AI가 정리한 내용을 근거와 함께 확인해 주세요. 두 담당 분야의 사전 협의를 마친 뒤 최종
            제출합니다.
          </p>
        </div>
        <Badge tone="blue">합성 데이터 시연</Badge>
      </section>
      <div className="stat-grid">
        {metrics.map((metric) => (
          <button
            type="button"
            key={metric.phase}
            className="stat-card"
            onClick={() => onList(metric.phase)}
          >
            <div className="row-between">
              <span>{metric.label}</span>
              <span className={`stat-icon ${metric.tone}`}>
                <metric.icon size={22} />
              </span>
            </div>
            <strong>
              {own.filter((r) => r.phase === metric.phase).length}
              <small>건</small>
            </strong>
            <p>
              해당 신청 보기
              <ArrowRight size={17} />
            </p>
          </button>
        ))}
      </div>
      <div className="overview-columns">
        <section className="sf-panel queue-panel">
          <div className="panel-heading">
            <div>
              <span className="overline">나의 업무</span>
              <h2>먼저 확인할 신청</h2>
            </div>
            <button className="text-button" type="button" onClick={() => onList()}>
              전체 보기
              <ArrowRight size={17} />
            </button>
          </div>
          <p className="muted queue-description">
            검토 기한순 · {pending.length}건 {role === 'APPLICANT' ? '진행 중' : '확인 필요'}
          </p>
          {pending.length ? (
            <ul className="work-queue">
              {pending.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <div className="queue-top">
                    <Badge tone={item.phase === '보완 중' ? 'amber' : 'blue'}>{item.phase}</Badge>
                    <span>{item.id}</span>
                    <span className="queue-due">기한 {item.due}</span>
                  </div>
                  <a
                    href={`#detail/${item.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onOpen(item.id);
                    }}
                  >
                    <h3>{item.title}</h3>
                    <ArrowRight size={20} />
                  </a>
                  <p>{nextAction(item, role)}</p>
                  <div className="queue-reviews">
                    {(['SECURITY', 'INFRA'] as const).map((reviewer) => (
                      <span key={reviewer}>
                        {item.reviews[reviewer].done && <CheckCircle2 size={15} />}
                        {roleName[reviewer]} {item.reviews[reviewer].done ? '완료' : '검토 중'}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <CheckCircle2 size={32} />
              <h3>지금 확인할 신청이 없습니다.</h3>
              <p>전체 목록에서 완료한 업무를 확인할 수 있습니다.</p>
            </div>
          )}
        </section>
        <div className="overview-side">
          <section className="sf-panel journey-panel">
            <span className="overline">진행 안내</span>
            <h2>신청부터 제출까지</h2>
            <ol className="journey-list">
              {[
                ['사업 등록·인터뷰', '신청자', '자료와 답변으로 사업 정보를 정리합니다.'],
                [
                  '담당자 사전 협의',
                  '정보보안 · ICT인프라',
                  '분야별 검토와 보완 요청을 진행합니다.',
                ],
                ['사용자 보완·제출', '신청자', '정보를 확인하고 제출본을 확정합니다.'],
                ['최종 검토·처리', '후속 운영 단계', '실제 기관 처리 연동은 준비 중입니다.'],
              ].map(([title, owner, description], index) => (
                <li key={title}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <small>{owner}</small>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="config-summary">
            <div>
              <strong>현재 게시 설정</strong>
              <Badge tone="blue">v2.{data.config.version}</Badge>
            </div>
            <p>
              {data.config.publishedWorkflow} · 활성 질문{' '}
              {data.config.published.filter((q) => q.enabled).length}개
            </p>
            <small>새 신청에 적용됩니다. 기존 신청은 이전 설정을 유지합니다.</small>
          </section>
        </div>
      </div>
      <section className="sf-panel recent-panel">
        <div className="panel-heading">
          <h2>최근 협의 기록</h2>
          <span className="muted">현재 역할의 조회 범위</span>
        </div>
        <ul className="recent-events">
          {recent.map(({ item, event }, index) => (
            <li key={`${item.id}-${index}`}>
              <span className="event-mark" />
              <div>
                <a
                  href={`#detail/${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpen(item.id);
                  }}
                >
                  {item.title}
                </a>
                <p>{event.text}</p>
                <small>
                  {event.who} · {event.time}
                </small>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
