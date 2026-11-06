package kr.securityadvisor.procedure.domain;

/** 접수는 서류 수신 기록이며 실제 장비 적용 상태가 아니다. */
public enum ProcedureStatus {
  DRAFT,
  COLLABORATING,
  SUBMITTED,
  RECEIVED
}
