package kr.securityadvisor.request.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.domain.ReviewReadiness;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Role;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 서류 한 건의 단계·상태·반환·제출만 전이시키는 애그리거트다. */
@Entity
@Table(name = "security_requests")
public class SecurityRequest extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "business_case_id", nullable = false, updatable = false)
  private UUID caseId;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(name = "owner_id", nullable = false, updatable = false)
  private UUID ownerId;

  @Enumerated(EnumType.STRING)
  @Column(name = "doc_type", nullable = false, length = 32, updatable = false)
  private DocType docType;

  @Column(nullable = false)
  private int stage;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private RequestStatus status;

  @Column(nullable = false)
  private long revision;

  @Version
  @Column(name = "lock_version", nullable = false)
  private long lockVersion;

  @Column(name = "current_submission_id")
  private UUID currentSubmissionId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "terminal_snapshot", columnDefinition = "jsonb")
  private SubmissionSnapshot terminalSnapshot;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<AnswerValue> answers;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private RequestData data;

  protected SecurityRequest() {}

  public SecurityRequest(UUID id, UUID caseId, UUID institutionId, UUID ownerId, DocType docType) {
    this.id = id;
    this.caseId = caseId;
    this.institutionId = institutionId;
    this.ownerId = ownerId;
    this.docType = docType;
    stage = 1;
    status = RequestStatus.DRAFT;
    answers = SeedQuestions.specific(docType);
    data = RequestData.empty();
  }

  public void requireRevision(long expected) {
    if (expected != revision)
      throw new DomainException(409, "REVISION_CONFLICT", "신청이 변경되었습니다. 최신 내용을 비교해 주세요.", revision);
  }

  public void requireOpen() {
    if (status.terminal())
      throw new DomainException(409, "TERMINAL_REQUEST", "종료된 신청은 변경할 수 없습니다.");
  }

  public void requireStage(int expected) {
    requireOpen();
    if (stage != expected) throw new DomainException(409, "WRONG_STAGE", "현재 단계에서는 수행할 수 없습니다.");
  }

  public void answer(List<AnswerValue> next) {
    requireOpen();
    if (stage == 4) throw new DomainException(409, "SUBMISSION_IMMUTABLE", "제출본을 반환한 뒤 보완해 주세요.");
    if (answers.size() != next.size()
        || java.util.stream.IntStream.range(0, answers.size())
            .anyMatch(index -> !answers.get(index).sameDefinition(next.get(index)))) {
      throw new DomainException(422, "QUESTION_SCHEMA_CHANGED", "게시된 질문 구조는 바꿀 수 없습니다.");
    }
    answers = List.copyOf(next);
    revision++;
  }

  public void requestReview() {
    requireStage(1);
    stage = 2;
    status = RequestStatus.CONSULTING;
    revision++;
  }

  public void recordReviewProgress(ReviewReadiness readiness) {
    requireStage(2);
    if (readiness.complete()) {
      stage = 3;
      status = RequestStatus.FINAL_REVIEW;
      data = new RequestData(List.of(), List.of(), data.returns(), data.terminalReason());
    }
    revision++;
  }

  public void requestSupplement() {
    requireOpen();
    if (stage != 2 && stage != 3)
      throw new DomainException(409, "WRONG_STAGE", "협의 또는 최종 검토 중에 보완을 요청해 주세요.");
    status = RequestStatus.SUPPLEMENT_REQUESTED;
    revision++;
  }

  public void answerSupplement(boolean hasOpen) {
    requireOpen();
    if (stage != 2 && stage != 3)
      throw new DomainException(409, "WRONG_STAGE", "현재 단계에서는 보완 답변을 할 수 없습니다.");
    status =
        hasOpen
            ? RequestStatus.SUPPLEMENT_REQUESTED
            : stage == 2 ? RequestStatus.CONSULTING : RequestStatus.FINAL_REVIEW;
    revision++;
  }

  public void recordProgress() {
    requireOpen();
    revision++;
  }

  /** 공통 정보 변경은 현재 신청 상태를 바꾸지 않고 영향 표지만 추가한다. */
  public void commonChanged(List<String> fields) {
    if (status.terminal()) return;
    var changed = new LinkedHashSet<>(data.changedCommonFields());
    changed.addAll(fields);
    var highlighted = new LinkedHashSet<>(data.highlightedFields());
    if (stage < 4) highlighted.addAll(fields);
    data =
        new RequestData(
            List.copyOf(highlighted), List.copyOf(changed), data.returns(), data.terminalReason());
    revision++;
  }

  /** 사유와 지정 항목을 남기며 값과 과거 제출본은 삭제하지 않는다. */
  public void returnToStage(int target, List<String> fields, String reason, String actorName) {
    requireOpen();
    boolean allowed =
        stage == 2 && target == 1
            || stage == 3 && (target == 1 || target == 2)
            || stage == 4 && target == 3;
    if (!allowed) throw new DomainException(422, "INVALID_RETURN", "허용된 이전 단계로만 반환할 수 있습니다.");
    String why = requireReason(reason);
    if (fields == null || fields.isEmpty())
      throw new DomainException(422, "RETURN_FIELDS_REQUIRED", "보완할 항목을 선택해 주세요.");
    var history = new ArrayList<>(data.returns());
    history.add(
        new RequestData.StageReturn(
            UUID.randomUUID(), stage, target, fields, why, actorName, Instant.now()));
    var highlighted = new LinkedHashSet<>(data.highlightedFields());
    highlighted.addAll(fields);
    data = new RequestData(List.copyOf(highlighted), data.changedCommonFields(), history, "");
    stage = target;
    status =
        target == 1
            ? RequestStatus.DRAFT
            : target == 2 ? RequestStatus.CONSULTING : RequestStatus.FINAL_REVIEW;
    currentSubmissionId = null;
    revision++;
  }

  public void submit(UUID submissionId, List<AnswerValue> common, ReviewReadiness readiness) {
    requireStage(3);
    if (!readiness.complete())
      throw new DomainException(422, "REVIEW_REQUIRED", "보완 해결과 두 분야 협의 완료가 필요합니다.");
    if (java.util.stream.Stream.concat(common.stream(), answers.stream())
        .anyMatch(a -> !a.ready())) {
      throw new DomainException(422, "UNCONFIRMED_ANSWERS", "필수값과 AI 미확정 값을 사람이 확인해 주세요.");
    }
    stage = 4;
    status = RequestStatus.SUBMITTED;
    currentSubmissionId = submissionId;
    data = new RequestData(List.of(), List.of(), data.returns(), "");
    revision++;
  }

  public void finalizeRequest(UUID verifiedSubmissionId, Role confirmer, boolean bothConfirmed) {
    requireStage(4);
    if (status != RequestStatus.SUBMITTED
        || confirmer != Role.SECURITY
        || !java.util.Objects.equals(currentSubmissionId, verifiedSubmissionId)
        || !bothConfirmed)
      throw new DomainException(
          422, "FINAL_CONFIRMATIONS_REQUIRED", "같은 제출본에 대한 두 분야 최종 확인이 필요합니다.");
    status = RequestStatus.FINALIZED;
    revision++;
  }

  public void close(String reason, SubmissionSnapshot snapshot) {
    end(RequestStatus.CLOSED, reason, snapshot);
  }

  public void withdraw(String reason, SubmissionSnapshot snapshot) {
    end(RequestStatus.WITHDRAWN, reason, snapshot);
  }

  private void end(RequestStatus next, String reason, SubmissionSnapshot snapshot) {
    requireOpen();
    if (snapshot == null)
      throw new DomainException(
          422, "TERMINAL_SNAPSHOT_REQUIRED", "종료 시점의 공통 정보와 신청 답변을 함께 보존해야 합니다.");
    String why = requireReason(reason);
    terminalSnapshot = snapshot;
    data =
        new RequestData(data.highlightedFields(), data.changedCommonFields(), data.returns(), why);
    status = next;
    revision++;
  }

  public static String requireReason(String reason) {
    String value = AnswerValue.clean(reason, 1000);
    if (value.isBlank()) throw new DomainException(422, "REASON_REQUIRED", "사유를 입력해 주세요.");
    return value;
  }

  public UUID getId() {
    return id;
  }

  public UUID getCaseId() {
    return caseId;
  }

  public UUID getInstitutionId() {
    return institutionId;
  }

  public UUID getOwnerId() {
    return ownerId;
  }

  public DocType getDocType() {
    return docType;
  }

  public int getStage() {
    return stage;
  }

  public RequestStatus getStatus() {
    return status;
  }

  public long getRevision() {
    return revision;
  }

  public UUID getCurrentSubmissionId() {
    return currentSubmissionId;
  }

  public SubmissionSnapshot getTerminalSnapshot() {
    return terminalSnapshot;
  }

  public List<AnswerValue> getAnswers() {
    return List.copyOf(answers);
  }

  public RequestData getData() {
    return data;
  }
}
