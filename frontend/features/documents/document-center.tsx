'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Download, FileText, LockKeyhole, Search } from 'lucide-react';
import { Badge, Dialog, Heading, Notice, formatBytes } from '@/components/ui/v3';
import { downloadFile, type Role } from '@/lib/domain';
import { documentText, type Case } from '@/lib/prototype';

interface DocumentRecord {
  item: Case;
  content: string;
  bytes: number;
  filename: string;
}

export function DocumentCenter({
  requests,
  role,
  onOpen,
}: {
  requests: Case[];
  role: Role;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('전체');
  const [preview, setPreview] = useState<DocumentRecord | null>(null);
  const documents = useMemo(
    () =>
      requests
        .filter((item) => role !== 'APPLICANT' || item.applicant === '이민주')
        .map((item) => {
          const content = documentText(item);
          return {
            item,
            content,
            bytes: new Blob(['\ufeff' + content]).size,
            filename: `${item.id}_${item.submission ? '제출본_v1' : `초안_v${item.version}`}.txt`,
          };
        }),
    [requests, role],
  );
  const filtered = documents.filter(
    ({ item }) =>
      (status === '전체' || (status === '제출본' ? !!item.submission : !item.submission)) &&
      `${item.title} ${item.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <>
      <Heading
        title="문서함"
        description="진행 중인 검토 초안과 제출 시점에 확정한 문서를 확인하세요."
      />
      <Notice>
        TXT 형식의 시연 문서를 제공합니다. 공식 양식·PDF·DOCX 발급과 기관 전송은 연결되지
        않았습니다.
      </Notice>
      <section className="sf-panel document-search" aria-label="문서 검색">
        <div className="filter-field">
          <label htmlFor="document-query">사업명·신청번호</label>
          <div className="search-input">
            <Search size={20} />
            <input
              id="document-query"
              placeholder="문서를 검색해 주세요"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="filter-field">
          <label htmlFor="document-status">문서 구분</label>
          <select id="document-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {['전체', '검토 초안', '제출본'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => {
            setQuery('');
            setStatus('전체');
          }}
        >
          검색 초기화
        </button>
      </section>
      <p className="document-count" role="status">
        문서 <strong>{filtered.length}</strong>건 · 초안은 저장한 최신 내용으로 표시됩니다.
      </p>
      <div className="document-grid">
        {filtered.map((doc) => {
          const { item } = doc;
          const answers = item.submission?.answers ?? item.answers;
          const unconfirmed = answers.filter((answer) => !answer.confirmed).length;
          return (
            <section className="sf-panel document-card" key={item.id}>
              <div className="row-between">
                <span className="document-symbol">
                  <FileText size={27} />
                </span>
                <Badge tone={item.submission ? 'green' : 'gray'}>
                  {item.submission ? '제출본 v1' : `검토 초안 v${item.version}`}
                </Badge>
              </div>
              <h2>{item.submission?.title ?? item.title}</h2>
              <p>{item.id}</p>
              <dl className="document-facts">
                <div>
                  <dt>적용 설정</dt>
                  <dd>{item.configVersion}</dd>
                </div>
                <div>
                  <dt>확인 상태</dt>
                  <dd>
                    {!answers.length
                      ? '등록된 답변 없음'
                      : unconfirmed
                        ? `미확정 ${unconfirmed}개`
                        : '모든 답변 확인됨'}
                  </dd>
                </div>
                <div>
                  <dt>문서 형식</dt>
                  <dd>TXT · {formatBytes(doc.bytes)}</dd>
                </div>
              </dl>
              <div className="document-state">
                {item.submission ? <LockKeyhole size={17} /> : <FileText size={17} />}
                <span>
                  {item.submission
                    ? `${item.submittedAt} 제출 · 읽기 전용`
                    : '검토 중 변경될 수 있는 초안입니다.'}
                </span>
              </div>
              <div className="document-card-actions">
                <button type="button" className="button" onClick={() => setPreview(doc)}>
                  문서 미리보기
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => downloadFile(doc.filename, doc.content)}
                  aria-label={`${item.title} TXT ${formatBytes(doc.bytes)} 다운로드`}
                >
                  <Download size={18} />
                  TXT 다운로드
                </button>
              </div>
              <a
                className="document-detail-link"
                href={`#detail/${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(item.id);
                }}
              >
                협의 내용과 원문 근거
                <ArrowRight size={17} />
              </a>
            </section>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="sf-panel empty-state">
          <Search size={32} />
          <h2>조건에 맞는 문서가 없습니다.</h2>
          <p>사업명·신청번호를 확인하거나 문서 구분을 변경해 주세요.</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setQuery('');
              setStatus('전체');
            }}
          >
            전체 문서 보기
          </button>
        </div>
      )}
      {preview && (
        <Dialog
          title="문서 미리보기"
          onClose={() => setPreview(null)}
          actions={
            <>
              <button type="button" className="button" onClick={() => setPreview(null)}>
                닫기
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => downloadFile(preview.filename, preview.content)}
              >
                <Download size={18} />
                TXT · {formatBytes(preview.bytes)} 다운로드
              </button>
            </>
          }
        >
          <p className="preview-filename">{preview.filename}</p>
          <pre className="document-preview">{preview.content}</pre>
        </Dialog>
      )}
    </>
  );
}
