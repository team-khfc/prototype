package kr.securityadvisor.request.domain;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** 반환과 공통 정보 변경 표시를 보존하되 제출본은 별도 불변 행에 둔다. */
public record RequestData(
    List<String> highlightedFields,
    List<String> changedCommonFields,
    List<StageReturn> returns,
    String terminalReason) {
  public RequestData {
    highlightedFields = List.copyOf(highlightedFields);
    changedCommonFields = List.copyOf(changedCommonFields);
    returns = List.copyOf(returns);
  }

  public static RequestData empty() {
    return new RequestData(List.of(), List.of(), List.of(), "");
  }

  public record StageReturn(
      UUID id,
      int fromStage,
      int targetStage,
      List<String> fieldKeys,
      String reason,
      String actorName,
      Instant createdAt) {
    public StageReturn {
      fieldKeys = List.copyOf(fieldKeys);
    }
  }
}
