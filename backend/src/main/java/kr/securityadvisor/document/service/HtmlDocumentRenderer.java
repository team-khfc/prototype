package kr.securityadvisor.document.service;

import kr.securityadvisor.document.dto.DocumentRenderRequest;
import kr.securityadvisor.document.dto.DocumentRenderRequest.FieldResponse;
import kr.securityadvisor.document.dto.RenderedDocumentResponse;
import org.springframework.stereotype.Service;

/** 다운로드 파일에서도 사용자·AI 문자열을 실행 가능한 마크업으로 해석하지 않는다. */
@Service
public class HtmlDocumentRenderer implements DocumentRenderer {

  /** 외부 리소스 없이 열 수 있는 HTML에 원출처·근거와 사람의 확인 여부를 함께 남긴다. */
  @Override
  public RenderedDocumentResponse render(DocumentRenderRequest request) {
    StringBuilder html =
        new StringBuilder(
            """
            <!doctype html><html lang="ko"><head><meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>보안길잡이 서류</title>
            <style>body{font-family:system-ui,sans-serif;line-height:1.6;margin:2rem;color:#172b4d}
            main{max-width:70rem;margin:auto}table{border-collapse:collapse;width:100%}
            th,td{border:1px solid #abb8c9;padding:.7rem;text-align:left;vertical-align:top}
            th{background:#edf2f7}td{white-space:pre-wrap;overflow-wrap:anywhere}
            small{display:block}caption{text-align:left;font-weight:bold;margin:1rem 0}
            @media print{body{margin:0}thead{display:table-header-group}tr{break-inside:avoid}}</style>
            </head><body><main>
            """);
    html.append("<h1>")
        .append(escape(request.caseTitle()))
        .append("</h1><p><strong>")
        .append(escape(request.copyType().label()))
        .append("</strong> · ")
        .append(escape(documentName(request.docType())))
        .append("</p><p>신청 부서: ")
        .append(escape(request.department()))
        .append(" · 신청자: ")
        .append(escape(request.applicantName()))
        .append("</p><p>기관 설정 게시본 v")
        .append(request.publicationVersion())
        .append(" · 사업 건 버전 ")
        .append(request.caseRevision())
        .append(" · 신청 버전 ")
        .append(request.requestRevision())
        .append("</p><p>AI는 제안만 하며, 미확정 값은 사람이 확인해야 합니다. ")
        .append("서류 확정은 방화벽 적용 완료를 뜻하지 않습니다.</p>")
        .append("<table><caption>신청 내용과 항목별 출처</caption><thead><tr>")
        .append("<th scope=\"col\">항목</th><th scope=\"col\">값</th>")
        .append("<th scope=\"col\">출처·근거</th><th scope=\"col\">사람 확인</th>")
        .append("</tr></thead><tbody>");
    for (FieldResponse field : request.fields()) appendField(html, field);
    html.append("</tbody></table></main></body></html>");
    return new RenderedDocumentResponse(
        "security-request-" + request.requestId() + "-" + request.copyType().fileSuffix() + ".html",
        html.toString());
  }

  private void appendField(StringBuilder html, FieldResponse field) {
    html.append("<tr><th scope=\"row\">").append(escape(field.label())).append("</th><td>");
    if (field.notApplicable()) html.append("미해당 · 사유: ");
    html.append(escape(field.value())).append("</td><td>").append(sourceName(field.source()));
    if (field.evidence() != null && !field.evidence().isBlank())
      html.append("<small>근거: ").append(escape(field.evidence())).append("</small>");
    html.append("</td><td>");
    if (field.confirmed() && field.confirmedAt() != null) {
      html.append("확인됨<small>")
          .append(escape(field.confirmerName()))
          .append(" · ")
          .append(roleName(field.confirmerRole()))
          .append(" · ")
          .append(field.confirmedAt())
          .append("</small>");
    } else html.append("미확정 · 담당자 확인 필요");
    html.append("</td></tr>");
  }

  private String sourceName(String source) {
    if (source == null) return "담당자 확인 필요";
    return switch (source) {
      case "USER_ANSWER" -> "사용자 답변";
      case "AI_INFERRED" -> "AI 추론";
      case "STAFF_INPUT" -> "담당자 입력";
      case "STAFF_CONFIRMED" -> "담당자 확인";
      default -> "담당자 확인 필요";
    };
  }

  private String roleName(String role) {
    if (role == null) return "확인 역할 기록 없음";
    return switch (role) {
      case "APPLICANT" -> "일반 사용자";
      case "INFRA" -> "ICT인프라 담당자";
      case "SECURITY" -> "정보보안 담당자";
      default -> "확인 역할 기록 없음";
    };
  }

  private String documentName(String docType) {
    return switch (docType) {
      case "FIREWALL" -> "방화벽신청서";
      case "SECURITY_REVIEW" -> "보안성검토 신청서";
      default -> "보안 서류";
    };
  }

  private static String escape(String value) {
    if (value == null) return "";
    return value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;");
  }
}
