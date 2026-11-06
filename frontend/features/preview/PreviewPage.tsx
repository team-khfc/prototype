'use client';
import { AppShell } from '@/components/layout';
import { Notice, Badge, Heading, Icon } from '@/components/ui';
import {
  WorkspaceView,
  RequestsView,
  AnalysisView,
  DetailView,
  PreviewReview,
  NetworkTable,
} from '@/features/procedure';
import { AdminView } from '@/features/institution';
import {
  previewProcedure,
  previewProcedures,
  previewPolicy,
  previewSettings,
  previewAnalyses,
} from './fixtures';
/** 이 화면은 합성 fixture만 주입하며 인증·업무 API 훅을 호출하지 않는 읽기전용 시안이다. */
export function PreviewPage({ screen, tab = 'questions' }: { screen: string; tab?: string }) {
  return (
    <AppShell
      preview
      institutionName={previewPolicy.institutionName}
      role={
        screen === 'admin'
          ? 'ADMIN'
          : screen === 'security'
            ? 'SECURITY'
            : screen === 'infra'
              ? 'INFRA'
              : 'APPLICANT'
      }
    >
      {screen === 'workspace' ? (
        <WorkspaceView
          items={previewProcedures}
          institutionName={previewPolicy.institutionName}
          role="APPLICANT"
          preview
        />
      ) : screen === 'requests' ? (
        <RequestsView items={previewProcedures} role="APPLICANT" preview />
      ) : screen === 'analysis' ? (
        <AnalysisView procedure={previewProcedure} analyses={previewAnalyses} preview />
      ) : screen === 'security' || screen === 'infra' ? (
        <DetailView
          procedure={previewProcedure}
          step={screen}
          preview
          aside={
            <PreviewReview
              procedure={previewProcedure}
              role={screen === 'infra' ? 'INFRA' : 'SECURITY'}
            />
          }
        >
          {screen === 'infra' && (
            <section className="sf-panel">
              <div className="panel-heading">
                <h2>통신 규칙</h2>
                <Badge tone="blue">담당자 입력 · 합성 예시</Badge>
              </div>
              <Notice>문서 예시 전용 IP 범위를 사용한 합성 통신 규칙입니다.</Notice>
              <NetworkTable procedure={previewProcedure} />
              <div className="analysis-actions">
                <button className="button" disabled>
                  <Icon name="plus" />
                  통신 규칙 추가
                </button>
                <button className="button" disabled>
                  통신 규칙 저장
                </button>
              </div>
            </section>
          )}
        </DetailView>
      ) : screen === 'admin' ? (
        <AdminView settings={previewSettings} policy={previewPolicy} tab={tab} preview>
          {tab === 'context' && (
            <section className="sf-panel">
              <h2>기관 컨텍스트</h2>
              <Notice>
                공개 자료와 기관 내부 참고 정보는 분리합니다. 읽기전용 시안에서는 합성 설명만
                표시합니다.
              </Notice>
              <article className="context-card">
                <Badge>합성 운영 안내</Badge>
                <h3>시연용 자료 관리</h3>
                <pre>
                  이 화면에는 공개 자료와 합성 입력만 사용합니다. 실제 내부 자산과 비공개 규정은
                  포함하지 않습니다.
                </pre>
                <p className="source-meta">담당자 입력 · 기관 관리자 (합성)</p>
              </article>
            </section>
          )}
        </AdminView>
      ) : (
        <>
          <Heading title="디자인 시안" />
          <Notice>왼쪽 메뉴에서 확인할 화면을 선택해 주세요.</Notice>
        </>
      )}
    </AppShell>
  );
}
