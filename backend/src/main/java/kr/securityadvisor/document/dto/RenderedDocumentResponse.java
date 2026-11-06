package kr.securityadvisor.document.dto;

/** 저장소나 웹 계층에 의존하지 않는 다운로드 결과다. */
public record RenderedDocumentResponse(String filename, String html) {}
