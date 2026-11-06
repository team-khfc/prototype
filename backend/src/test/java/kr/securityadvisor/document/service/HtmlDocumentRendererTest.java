package kr.securityadvisor.document.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.document.dto.DocumentRenderRequest;
import kr.securityadvisor.document.dto.DocumentRenderRequest.CopyType;
import kr.securityadvisor.document.dto.DocumentRenderRequest.FieldResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class HtmlDocumentRendererTest {
  private final DocumentRenderer renderer = new HtmlDocumentRenderer();

  @Test
  @DisplayName("내려받은 문서의 사용자·AI·확인자 문자열은 모두 실행되지 않는 텍스트다")
  void escapesUntrustedValuesAndEvidence() {
    String payload = "<script>alert(\"합성\")</script>&'";
    var rendered =
        renderer.render(
            request(
                payload,
                CopyType.DRAFT,
                List.of(
                    new FieldResponse(
                        payload,
                        payload,
                        "AI_INFERRED",
                        payload,
                        true,
                        false,
                        payload,
                        "SECURITY",
                        Instant.parse("2026-11-07T00:00:00Z")))));
    assertThat(rendered.html())
        .contains("&lt;script&gt;alert(&quot;합성&quot;)&lt;/script&gt;&amp;&#39;")
        .contains("AI 추론", "근거:", "확인됨", "정보보안 담당자")
        .doesNotContain("<script>", payload);
    assertThat(rendered.filename()).endsWith("-draft.html").doesNotContain(payload);
  }

  @Test
  @DisplayName("원출처 네 종류와 근거·미확정·미해당 사유를 문서에서 구분한다")
  void displaysProvenanceAndUnconfirmedValuesHonestly() {
    var rendered =
        renderer.render(
            request(
                "합성 사업",
                CopyType.DRAFT,
                List.of(
                    field("USER_ANSWER", false, false),
                    field("AI_INFERRED", false, false),
                    field("STAFF_INPUT", true, true),
                    field("STAFF_CONFIRMED", true, false),
                    field(null, false, false))));
    assertThat(rendered.html())
        .contains("사용자 답변", "AI 추론", "담당자 입력", "담당자 확인", "담당자 확인 필요")
        .contains("미확정 · 담당자 확인 필요", "미해당 · 사유: 합성 값", "근거: 합성 문서 1절")
        .contains("서류 확정은 방화벽 적용 완료를 뜻하지 않습니다.")
        .doesNotContain("USER_ANSWER", "AI_INFERRED", "STAFF_INPUT", "STAFF_CONFIRMED");
  }

  @Test
  @DisplayName("종료 초안과 종료 제출본의 표시 및 파일명을 구분한다")
  void distinguishesTerminalDraftFromSubmission() {
    for (CopyType type : List.of(CopyType.CLOSED_DRAFT, CopyType.WITHDRAWN_DRAFT)) {
      var result = renderer.render(request("합성 사업", type, List.of()));
      assertThat(result.html()).contains("당시 초안 · 미제출").doesNotContain("당시 제출본");
      assertThat(result.filename()).endsWith("-draft.html");
    }
    for (CopyType type : List.of(CopyType.CLOSED_SUBMISSION, CopyType.WITHDRAWN_SUBMISSION)) {
      var result = renderer.render(request("합성 사업", type, List.of()));
      assertThat(result.html()).contains("당시 제출본").doesNotContain("당시 초안 · 미제출");
      assertThat(result.filename()).endsWith("-submission.html");
    }
  }

  private DocumentRenderRequest request(String title, CopyType type, List<FieldResponse> fields) {
    return new DocumentRenderRequest(
        UUID.randomUUID(), title, "FIREWALL", title, title, 1, 2, 3, type, fields);
  }

  private FieldResponse field(String source, boolean confirmed, boolean notApplicable) {
    return new FieldResponse(
        "합성 항목",
        "합성 값",
        source,
        "합성 문서 1절",
        confirmed,
        notApplicable,
        "합성 확인자",
        "INFRA",
        confirmed ? Instant.parse("2026-11-07T00:00:00Z") : null);
  }
}
