package kr.securityadvisor.common.model;

import java.util.UUID;

/** 업무 기능에는 기관별 게시본 식별자만 공개한다. */
public interface PolicyProvider {
  /** 새 사업 건과 하위 신청에 함께 고정할 현재 게시본 버전을 반환한다. */
  long currentVersion(UUID institutionId);
}
