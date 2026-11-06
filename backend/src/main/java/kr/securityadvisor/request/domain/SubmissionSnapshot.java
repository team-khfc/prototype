package kr.securityadvisor.request.domain;

import java.util.List;
import kr.securityadvisor.common.domain.AnswerValue;

/** 제출 당시 공통값까지 복사하여 이후 사업 건 변경과 격리한다. */
public record SubmissionSnapshot(
    String caseTitle,
    String department,
    String ownerName,
    String docType,
    long publicationVersion,
    long caseRevision,
    long requestRevision,
    List<AnswerValue> commonAnswers,
    List<AnswerValue> answers) {
  public SubmissionSnapshot {
    commonAnswers = List.copyOf(commonAnswers);
    answers = List.copyOf(answers);
  }
}
