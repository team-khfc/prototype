package kr.securityadvisor.document.service;

import kr.securityadvisor.document.dto.DocumentRenderRequest;
import kr.securityadvisor.document.dto.RenderedDocumentResponse;

/** 문서 출력은 공개 자료형만 받아 신청 애그리거트를 직접 조회하지 않는다. */
public interface DocumentRenderer {

  /** 이미 접근이 허용된 스냅샷을 출처와 미확정 표시를 보존하여 출력한다. */
  RenderedDocumentResponse render(DocumentRenderRequest request);
}
