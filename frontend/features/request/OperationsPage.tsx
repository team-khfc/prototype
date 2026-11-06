'use client';

import Link from 'next/link';
import { Icon, Loading, ErrorNotice } from '@/components/ui';
import { useWorkspace, workspacePath } from './WorkspaceContext';
import { PageHeading, DeadlineBadge, StageProgress } from './RequestComponents';
import { AuditTimeline } from './RequestDetail';
import { DOCUMENT_LABELS, FIELD_LABELS } from './types';

/** P1 운영 조회와 후속 기능을 구분하고 구현되지 않은 편집을 완료처럼 표시하지 않는다. */
export function OperationsPage({ section = 'overview' }: { section?: string }) {
  const workspace = useWorkspace();
  if (section === 'roadmap')
    return (
      <>
        <PageHeading
          title="후속 기능"
          description="1차 범위의 전체 시연을 검증한 뒤 순서대로 연결할 기능입니다."
        />
        <div className="sa-roadmap-grid">
          {[
            {
              title: '방화벽 정책 수명주기',
              icon: 'server' as const,
              description:
                '서류 확정 후 규칙을 생성하고, 실제 적용 여부는 ICT인프라 담당자가 기록합니다.',
            },
            {
              title: '업무 지표',
              icon: 'list' as const,
              description:
                '처리 시간과 기관 전체의 진행 상황을 읽기 전용으로 제공합니다. 개인별 순위는 만들지 않습니다.',
            },
            {
              title: '화면 안 알림',
              icon: 'info' as const,
              description:
                '배정·보완·기한 소식을 알려 줍니다. 읽음 여부는 업무 상태를 바꾸지 않습니다.',
            },
          ].map((item) => (
            <article className="sa-card" key={item.title}>
              <Icon name={item.icon} width={30} height={30} />
              <span className="sa-badge sa-neutral">설계 완료 · 구현 예정</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
        <div className="sa-callout">
          <Icon name="clock" />
          <p>기관별 검토 순서 변경, 부서장 확인, 추가 서류 유형은 1차 범위에 포함되지 않습니다.</p>
        </div>
      </>
    );
  if (section === 'configuration')
    return (
      <>
        <PageHeading
          title="업무 기준"
          description="현재 개발 시작점에 적용한 공통 업무 규칙과 작성 안내입니다."
        />
        <section className="sa-card">
          <div className="sa-section-heading">
            <h2>1차 처리 절차</h2>
            <span className="sa-badge sa-info">고정 정책 · 읽기 전용</span>
          </div>
          <StageProgress stage={1} expanded />
          <div className="sa-rules-grid">
            <article>
              <Icon name="file" />
              <h3>서류 2종</h3>
              <p>
                방화벽 신청과 보안성검토를 함께 선택합니다. 공통 질문은 사업 건에 한 번만
                저장합니다.
              </p>
            </article>
            <article>
              <Icon name="building" />
              <h3>담당자 2분야</h3>
              <p>
                ICT인프라 할당 후 정보보안 검토가 시작됩니다. 할당과 각 분야의 협의 완료는
                별개입니다.
              </p>
            </article>
            <article>
              <Icon name="shield" />
              <h3>사람의 확인</h3>
              <p>AI는 근거가 있는 미확정 후보를 제안합니다. 신청자가 내용을 확인하고 제출합니다.</p>
            </article>
            <article>
              <Icon name="check" />
              <h3>제출본 최종 확정</h3>
              <p>
                같은 제출본에서 INFRA → SECURITY가 확인하고 배정된 SECURITY가 서류를 확정합니다.
              </p>
            </article>
          </div>
        </section>
        <section className="sa-card">
          <h2>게시본·초안·제출본</h2>
          <p>
            기관 설정의 게시본은 신청 생성 시 고정됩니다. 공통 정보와 신청 수정본은 별도로 관리하며,
            제출할 때 내용 전체를 불변 제출본으로 보존합니다.
          </p>
          <div className="sa-callout">
            <Icon name="info" />
            <p>
              현재 P1은 seed 게시본을 사용합니다. 설정 게시·LLM 구성 편집 UI는 이 신규 흐름에서
              제공하지 않습니다.
            </p>
          </div>
        </section>
        <section className="sa-card">
          <h2>자료 입력 안내</h2>
          <ul className="sa-bullet-list">
            <li>합성 사업·합성 인물·문서용 예약 IP만 사용합니다.</li>
            <li>분석은 파일 선택 후 ‘자료 분석 요청’을 눌러야 시작합니다.</li>
            <li>내부 IP·시스템명은 AI가 추측하지 않고 담당자가 작성합니다.</li>
            <li>반환·종결·철회는 사유를 남기며 기존 값과 이력을 보존합니다.</li>
          </ul>
        </section>
      </>
    );
  return (
    <>
      <PageHeading
        title="담당자·처리 이력"
        description="배정된 분야별 담당자와 처리 기한, 업무 행위의 기록을 확인합니다."
      />
      {workspace.loading ? (
        <Loading />
      ) : workspace.error ? (
        <ErrorNotice error={workspace.error} retry={workspace.refresh} />
      ) : (
        <>
          <div className="sa-operations-grid">
            <section className="sa-card">
              <div className="sa-section-heading">
                <h2>기본 담당자 풀</h2>
                <span className="sa-badge sa-neutral">기관 단위</span>
              </div>
              {workspace.actor.role !== 'ADMIN' ? (
                <p className="sa-muted">
                  기관 관리자에게 보이는 운영 정보입니다. 각 신청의 담당자는 신청 상세에서 확인할 수
                  있습니다.
                </p>
              ) : workspace.operationsLoading ? (
                <Loading />
              ) : workspace.operationsError ? (
                <ErrorNotice error={workspace.operationsError} />
              ) : (
                workspace.pools.map((pool) => (
                  <div className="sa-reviewer-pool" key={pool.field}>
                    <h3>{FIELD_LABELS[pool.field]}</h3>
                    {pool.reviewers.map((reviewer) => (
                      <p key={reviewer.userId}>
                        <span className="sa-avatar">{reviewer.displayName.slice(0, 1)}</span>
                        <strong>{reviewer.displayName}</strong>
                        {pool.defaultReviewerId === reviewer.userId && (
                          <span className="sa-badge sa-info">기본 배정</span>
                        )}
                      </p>
                    ))}
                  </div>
                ))
              )}
              <p className="sa-panel-footnote">
                담당자 재배정은 신청 상세에서 사유와 함께 수행합니다. 자기 신청은 담당할 수
                없습니다.
              </p>
            </section>
            <section className="sa-card">
              <h2>진행 중 처리 기한</h2>
              <div className="sa-deadline-list">
                {workspace.requests
                  .filter((request) => request.deadlines.some((item) => item.active))
                  .map((request) => (
                    <Link
                      key={request.id}
                      href={workspacePath(workspace.mode, `/security-requests/${request.id}`)}
                    >
                      <div>
                        <strong>{request.caseTitle}</strong>
                        <span>{DOCUMENT_LABELS[request.docType]}</span>
                      </div>
                      <DeadlineBadge request={request} preview={workspace.mode === 'preview'} />
                    </Link>
                  ))}
              </div>
              <p className="sa-panel-footnote">
                기한을 넘겨도 업무 상태는 유지됩니다. 반환된 이전 기한 기록도 삭제하지 않습니다.
              </p>
            </section>
          </div>
          <section className="sa-card">
            <div className="sa-section-heading">
              <h2>기관 감사 이력</h2>
              <span className="sa-badge sa-neutral">추가 전용 · 읽기 전용</span>
            </div>
            {workspace.actor.role === 'ADMIN' ? (
              workspace.operationsError ? (
                <ErrorNotice error={workspace.operationsError} />
              ) : (
                <AuditTimeline events={workspace.auditEvents} />
              )
            ) : (
              <p className="sa-muted">
                기관 전체 감사 이력은 관리자에게만 표시됩니다. 신청별 처리 이력은 해당 신청에서
                확인하세요.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
