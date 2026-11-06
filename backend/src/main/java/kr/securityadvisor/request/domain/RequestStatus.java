package kr.securityadvisor.request.domain;

/** 문서의 확정과 장비 적용을 혼동하지 않는 신청 상태다. */
public enum RequestStatus {
  DRAFT,
  CONSULTING,
  SUPPLEMENT_REQUESTED,
  FINAL_REVIEW,
  SUBMITTED,
  FINALIZED,
  CLOSED,
  WITHDRAWN;

  public boolean terminal() {
    return this == FINALIZED || this == CLOSED || this == WITHDRAWN;
  }
}
