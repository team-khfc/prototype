package kr.securityadvisor.common.domain;

/** 협의 컨텍스트가 공개하는 제출 조건이며 다른 애그리거트 엔티티는 포함하지 않는다. */
public record ReviewReadiness(
    boolean allocationCompleted,
    boolean infraComplete,
    boolean securityComplete,
    boolean unresolvedSupplements) {
  public boolean complete() {
    return allocationCompleted && infraComplete && securityComplete && !unresolvedSupplements;
  }
}
