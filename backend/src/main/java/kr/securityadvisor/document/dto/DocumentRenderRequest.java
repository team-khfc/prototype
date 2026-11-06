package kr.securityadvisor.document.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** 신청 컨텍스트가 권한과 스냅샷을 판단한 뒤 전달하는 불변 출력 자료다. */
public record DocumentRenderRequest(
    UUID requestId,
    String caseTitle,
    String docType,
    String department,
    String applicantName,
    long publicationVersion,
    long caseRevision,
    long requestRevision,
    CopyType copyType,
    List<FieldResponse> fields) {

  public DocumentRenderRequest {
    fields = List.copyOf(fields);
  }

  /** 업무 상태와 실제 제출 여부를 함께 표현해 종료 초안을 제출본으로 오인하지 않게 한다. */
  public enum CopyType {
    DRAFT("초안 · 미확정", "draft"),
    SUBMISSION("제출본", "submission"),
    FINALIZED("확정본", "submission"),
    CLOSED_DRAFT("종결(반려) 당시 초안 · 미제출", "draft"),
    WITHDRAWN_DRAFT("철회 당시 초안 · 미제출", "draft"),
    CLOSED_SUBMISSION("종결(반려) 당시 제출본", "submission"),
    WITHDRAWN_SUBMISSION("철회 당시 제출본", "submission");

    private final String label;
    private final String fileSuffix;

    CopyType(String label, String fileSuffix) {
      this.label = label;
      this.fileSuffix = fileSuffix;
    }

    public String label() {
      return label;
    }

    public String fileSuffix() {
      return fileSuffix;
    }
  }

  /** 출력용 값·원출처·확인 기록을 분리하며 엔티티나 저장소를 공유하지 않는다. */
  public record FieldResponse(
      String label,
      String value,
      String source,
      String evidence,
      boolean confirmed,
      boolean notApplicable,
      String confirmerName,
      String confirmerRole,
      Instant confirmedAt) {}
}
