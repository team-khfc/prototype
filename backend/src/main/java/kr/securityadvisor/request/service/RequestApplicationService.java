package kr.securityadvisor.request.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;
import kr.securityadvisor.assignment.service.AssignmentOperations;
import kr.securityadvisor.audit.dto.AuditEventResponse;
import kr.securityadvisor.audit.service.AuditTrail;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.domain.ReviewReadiness;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import kr.securityadvisor.common.service.DeadlineOperations;
import kr.securityadvisor.request.domain.BusinessCase;
import kr.securityadvisor.request.domain.RequestStatus;
import kr.securityadvisor.request.domain.SecurityRequest;
import kr.securityadvisor.request.domain.SecuritySubmission;
import kr.securityadvisor.request.domain.SubmissionSnapshot;
import kr.securityadvisor.request.dto.WorkflowCommands.AnswerPatch;
import kr.securityadvisor.request.dto.WorkflowCommands.CompleteReview;
import kr.securityadvisor.request.dto.WorkflowCommands.Reason;
import kr.securityadvisor.request.dto.WorkflowCommands.Reassign;
import kr.securityadvisor.request.dto.WorkflowCommands.Revision;
import kr.securityadvisor.request.dto.WorkflowCommands.StageReturn;
import kr.securityadvisor.request.dto.WorkflowCommands.Supplement;
import kr.securityadvisor.request.dto.WorkflowCommands.SupplementAnswer;
import kr.securityadvisor.request.dto.WorkflowResponses.AnswerResponse;
import kr.securityadvisor.request.dto.WorkflowResponses.DocumentResponse;
import kr.securityadvisor.request.dto.WorkflowResponses.SecurityRequestResponse;
import kr.securityadvisor.request.dto.WorkflowResponses.StageReturnResponse;
import kr.securityadvisor.request.dto.WorkflowResponses.SubmissionResponse;
import kr.securityadvisor.request.repository.BusinessCaseRepository;
import kr.securityadvisor.request.repository.SecurityRequestRepository;
import kr.securityadvisor.request.repository.SecuritySubmissionRepository;
import kr.securityadvisor.review.service.ReviewOperations;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 사업 건 잠금 아래 신청·배정·검토·기한·감사를 한 트랜잭션으로 조율한다. */
@Service
@Transactional(readOnly = true)
public class RequestApplicationService {
  private final BusinessCaseRepository cases;
  private final SecurityRequestRepository requests;
  private final SecuritySubmissionRepository submissions;
  private final AssignmentOperations assignments;
  private final ReviewOperations reviews;
  private final DeadlineOperations deadlines;
  private final AuditTrail audit;
  private final WorkflowAccess access;

  public RequestApplicationService(
      BusinessCaseRepository cases,
      SecurityRequestRepository requests,
      SecuritySubmissionRepository submissions,
      AssignmentOperations assignments,
      ReviewOperations reviews,
      DeadlineOperations deadlines,
      AuditTrail audit,
      WorkflowAccess access) {
    this.cases = cases;
    this.requests = requests;
    this.submissions = submissions;
    this.assignments = assignments;
    this.reviews = reviews;
    this.deadlines = deadlines;
    this.audit = audit;
    this.access = access;
  }

  public List<SecurityRequestResponse> list(Actor actor) {
    var found =
        actor.role() == Role.APPLICANT
            ? requests.findByInstitutionIdAndOwnerIdOrderByUpdatedAtDesc(
                actor.institutionId(), actor.userId(), PageRequest.of(0, 100))
            : requests.findByInstitutionIdOrderByUpdatedAtDesc(
                actor.institutionId(), PageRequest.of(0, 100));
    return found.stream()
        .filter(request -> canRead(actor, request))
        .map(request -> response(actor, caseFor(actor, request), request))
        .toList();
  }

  public SecurityRequestResponse get(Actor actor, UUID id) {
    SecurityRequest request = find(actor, id);
    access.requireRead(canRead(actor, request));
    return response(actor, caseFor(actor, request), request);
  }

  @Transactional
  public SecurityRequestResponse answer(
      Actor actor, UUID id, AnswerPatch command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    requireEditor(actor, locked.request());
    List<AnswerValue> before = locked.request().getAnswers();
    List<AnswerValue> next = BusinessCaseService.applyInputs(actor, before, command.answers());
    List<String> changed = new ArrayList<>();
    for (int i = 0; i < next.size(); i++)
      if (before.get(i).contentDiffers(next.get(i))) changed.add(before.get(i).key());
    locked.request().answer(next);
    if (!changed.isEmpty()) reviews.invalidate(actor.institutionId(), id, false);
    return finish(
        actor,
        locked,
        "ANSWERS_CHANGED",
        "",
        command.answers().stream().map(a -> a.key()).toList(),
        requestId);
  }

  @Transactional
  public SecurityRequestResponse consult(Actor actor, UUID id, Revision command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    access.requireOwner(actor, locked.request().getOwnerId());
    if (!fieldsReady(locked, Role.APPLICANT))
      throw new DomainException(
          422, "APPLICANT_ANSWERS_REQUIRED", "사용자 입력 항목을 작성하고 확인한 뒤 협의를 요청해 주세요.");
    locked.request().requestReview();
    reviews.initialize(actor.institutionId(), id);
    assignments.assignDefaults(
        actor.institutionId(), locked.businessCase().getId(), id, locked.request().getOwnerId());
    deadlines.close(actor.institutionId(), id, null);
    openConsultationDeadlines(locked);
    return finish(actor, locked, "CONSULTATION_REQUESTED", "", List.of(), requestId);
  }

  @Transactional
  public SecurityRequestResponse allocate(
      Actor actor, UUID id, Revision command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    locked.request().requireStage(2);
    assignments.requireAssigned(actor, id);
    if (actor.role() != Role.INFRA)
      throw new DomainException(403, "INFRA_REQUIRED", "인프라 담당자가 할당을 완료해 주세요.");
    if (!fieldsReady(locked, Role.INFRA))
      throw new DomainException(
          422, "INFRA_FACTS_REQUIRED", "시스템·IP·프로토콜·포트·기간을 담당자가 입력하고 확인해 주세요.");
    reviews.allocate(actor.institutionId(), id);
    locked.request().recordProgress();
    return finish(actor, locked, "ALLOCATION_COMPLETED", "할당 완료이며 협의 완료는 아님", List.of(), requestId);
  }

  @Transactional
  public SecurityRequestResponse completeReview(
      Actor actor, UUID id, CompleteReview command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    locked.request().requireStage(2);
    assignments.requireAssigned(actor, id);
    reviews.complete(
        actor,
        id,
        command.comment(),
        fieldsReady(locked, actor.role()) && fieldsReady(locked, Role.APPLICANT));
    locked.request().recordReviewProgress(reviews.readiness(actor.institutionId(), id));
    if (locked.request().getStage() == 3)
      deadlines.close(actor.institutionId(), id, "CONSULTATION");
    return finish(actor, locked, "REVIEW_COMPLETED", command.comment(), List.of(), requestId);
  }

  @Transactional
  public SecurityRequestResponse requestSupplement(
      Actor actor, UUID id, Supplement command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    requireConsultationStage(locked.request());
    assignments.requireAssigned(actor, id);
    requireSecurityAfterAllocation(actor, locked.request());
    List<String> fields = validateFields(locked, command.fieldKeys());
    reviews.requestSupplement(actor, id, fields, command.reason());
    locked.request().requestSupplement();
    deadlines.open(
        actor.institutionId(),
        id,
        null,
        "SUPPLEMENT",
        locked.businessCase().getPolicy().supplementDays(),
        locked.businessCase().getPolicy().holidays(),
        locked.businessCase().getPublicationVersion());
    return finish(actor, locked, "SUPPLEMENT_REQUESTED", command.reason(), fields, requestId);
  }

  @Transactional
  public SecurityRequestResponse answerSupplement(
      Actor actor, UUID id, UUID supplementId, SupplementAnswer command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    access.requireOwner(actor, locked.request().getOwnerId());
    requireConsultationStage(locked.request());
    reviews.answerSupplement(actor.institutionId(), id, supplementId, command.answer());
    boolean open = reviews.hasOpenSupplements(actor.institutionId(), id);
    locked.request().answerSupplement(open);
    if (!open) deadlines.close(actor.institutionId(), id, "SUPPLEMENT");
    return finish(actor, locked, "SUPPLEMENT_ANSWERED", "보완 답변 등록", List.of(), requestId);
  }

  @Transactional
  public SecurityRequestResponse resolveSupplement(
      Actor actor, UUID id, UUID supplementId, Revision command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    requireConsultationStage(locked.request());
    assignments.requireAssigned(actor, id);
    if (reviews.supplementField(actor.institutionId(), id, supplementId) != actor.role()) {
      throw new DomainException(
          403, "SUPPLEMENT_REVIEWER_REQUIRED", "보완 요청을 한 분야의 배정 담당자가 확인해 주세요.");
    }
    reviews.resolveSupplement(actor, id, supplementId);
    locked.request().answerSupplement(reviews.hasOpenSupplements(actor.institutionId(), id));
    return finish(actor, locked, "SUPPLEMENT_RESOLVED", "배정 담당자 보완 확인", List.of(), requestId);
  }

  @Transactional
  public SecurityRequestResponse returnToStage(
      Actor actor, UUID id, StageReturn command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    int from = locked.request().getStage();
    if (from == 3) access.requireOwner(actor, locked.request().getOwnerId());
    else assignments.requireAssigned(actor, id);
    List<String> fields = validateFields(locked, command.fieldKeys());
    SubmissionSnapshot previousSubmission =
        from == 4 ? currentSnapshot(actor, locked.request()) : null;
    locked
        .request()
        .returnToStage(command.targetStage(), fields, command.reason(), actor.displayName());
    if (from < 4) {
      boolean allocationChanged =
          locked.businessCase().getAnswers().stream()
              .anyMatch(
                  answer -> answer.ownerRole() == Role.INFRA && fields.contains(answer.key()));
      reviews.invalidate(actor.institutionId(), id, allocationChanged);
    }
    if (previousSubmission != null) {
      List<String> commonChanges =
          previousSubmission.commonAnswers().stream()
              .filter(
                  previous ->
                      locked.businessCase().getAnswers().stream()
                          .anyMatch(
                              current ->
                                  current.key().equals(previous.key())
                                      && previous.contentDiffers(current)))
              .map(AnswerValue::key)
              .toList();
      if (!commonChanges.isEmpty()) {
        locked.request().commonChanged(commonChanges);
        boolean allocationChanged =
            locked.businessCase().getAnswers().stream()
                .anyMatch(
                    answer ->
                        answer.ownerRole() == Role.INFRA && commonChanges.contains(answer.key()));
        reviews.invalidate(actor.institutionId(), id, allocationChanged);
      }
    }
    deadlines.close(actor.institutionId(), id, null);
    if (command.targetStage() == 2) openConsultationDeadlines(locked);
    else
      deadlines.open(
          actor.institutionId(),
          id,
          null,
          "SUPPLEMENT",
          locked.businessCase().getPolicy().supplementDays(),
          locked.businessCase().getPolicy().holidays(),
          locked.businessCase().getPublicationVersion());
    return finish(actor, locked, "STAGE_RETURNED", command.reason(), fields, requestId);
  }

  @Transactional
  public SecurityRequestResponse submit(
      Actor actor, UUID id, Revision command, String idempotencyKey, String requestId) {
    Locked locked = lock(actor, id, null);
    access.requireOwner(actor, locked.request().getOwnerId());
    String key = AnswerValue.clean(idempotencyKey, 100);
    if (!key.matches("[A-Za-z0-9_-]{8,100}"))
      throw new DomainException(422, "IDEMPOTENCY_KEY_REQUIRED", "8~100자의 제출 요청 식별자가 필요합니다.");
    submissions.lockIdempotencyKey(actor.institutionId() + ":" + actor.userId() + ":" + key);
    var previous =
        submissions.findByInstitutionIdAndOwnerIdAndIdempotencyKey(
            actor.institutionId(), actor.userId(), key);
    if (previous.isPresent()) {
      SecuritySubmission saved = previous.get();
      if (!saved.getRequestId().equals(id)
          || saved.getRequestRevision() != command.expectedRevision()) {
        throw new DomainException(409, "IDEMPOTENCY_KEY_REUSED", "다른 제출 요청에 사용된 식별자입니다.");
      }
      return response(actor, locked.businessCase(), locked.request());
    }
    locked.request().requireRevision(command.expectedRevision());
    requireBothAssigned(locked.request());
    UUID submissionId = UUID.randomUUID();
    SubmissionSnapshot snapshot = snapshot(locked);
    locked
        .request()
        .submit(
            submissionId,
            locked.businessCase().getAnswers(),
            reviews.readiness(actor.institutionId(), id));
    int number =
        submissions.findByRequestIdAndInstitutionIdOrderByNumber(id, actor.institutionId()).size()
            + 1;
    submissions.saveAndFlush(
        new SecuritySubmission(
            submissionId,
            id,
            actor.institutionId(),
            actor.userId(),
            number,
            key,
            command.expectedRevision(),
            snapshot));
    deadlines.close(actor.institutionId(), id, null);
    deadlines.open(
        actor.institutionId(),
        id,
        null,
        "FINALIZATION",
        locked.businessCase().getPolicy().finalizationDays(),
        locked.businessCase().getPolicy().holidays(),
        locked.businessCase().getPublicationVersion());
    return finish(actor, locked, "SUBMISSION_CREATED", "사람이 확인한 불변 제출본 생성", List.of(), requestId);
  }

  @Transactional
  public SecurityRequestResponse confirmFinal(
      Actor actor, UUID id, Revision command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    locked.request().requireStage(4);
    assignments.requireAssigned(actor, id);
    reviews.confirmFinal(actor, id, locked.request().getCurrentSubmissionId());
    locked.request().recordProgress();
    return finish(actor, locked, "FINAL_CONFIRMED", "제출본 최종 확인", List.of(), requestId);
  }

  @Transactional
  public SecurityRequestResponse finalizeRequest(
      Actor actor, UUID id, Revision command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    assignments.requireAssigned(actor, id);
    requireBothAssigned(locked.request());
    UUID submissionId = locked.request().getCurrentSubmissionId();
    locked
        .request()
        .finalizeRequest(
            submissionId,
            actor.role(),
            reviews.bothFinalConfirmed(actor.institutionId(), submissionId));
    deadlines.close(actor.institutionId(), id, null);
    return finish(
        actor, locked, "REQUEST_FINALIZED", "서류 확정이며 방화벽 적용 완료는 아님", List.of(), requestId);
  }

  @Transactional
  public SecurityRequestResponse close(Actor actor, UUID id, Reason command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    assignments.requireAssigned(actor, id);
    locked.request().close(command.reason(), snapshotForEnd(actor, locked));
    deadlines.close(actor.institutionId(), id, null);
    return finish(actor, locked, "REQUEST_CLOSED", command.reason(), List.of(), requestId);
  }

  @Transactional
  public SecurityRequestResponse withdraw(Actor actor, UUID id, Reason command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    access.requireOwner(actor, locked.request().getOwnerId());
    locked.request().withdraw(command.reason(), snapshotForEnd(actor, locked));
    deadlines.close(actor.institutionId(), id, null);
    return finish(actor, locked, "REQUEST_WITHDRAWN", command.reason(), List.of(), requestId);
  }

  @Transactional
  public SecurityRequestResponse reassign(
      Actor actor, UUID id, String fieldName, Reassign command, String requestId) {
    Locked locked = lock(actor, id, command.expectedRevision());
    Role field;
    try {
      field = Role.valueOf(fieldName);
    } catch (IllegalArgumentException exception) {
      throw new DomainException(422, "INVALID_REVIEW_FIELD", "INFRA 또는 SECURITY 분야를 선택해 주세요.");
    }
    if (field != Role.INFRA && field != Role.SECURITY)
      throw new DomainException(422, "INVALID_REVIEW_FIELD", "검토 분야가 아닙니다.");
    locked.request().requireOpen();
    if (locked.request().getStage() == 1 && reviews.list(actor.institutionId(), id).isEmpty()) {
      throw new DomainException(409, "REVIEW_NOT_STARTED", "협의를 요청한 신청만 배정할 수 있습니다.");
    }
    boolean hadAssignee = assignments.hasAssigned(actor.institutionId(), id, field);
    assignments.reassign(
        actor,
        locked.businessCase().getId(),
        id,
        locked.request().getOwnerId(),
        field,
        command.assigneeId(),
        command.reason());
    locked.request().recordProgress();
    if (!hadAssignee
        && locked.request().getStage() == 2
        && deadlines.list(actor.institutionId(), id).stream()
            .noneMatch(
                deadline ->
                    deadline.active()
                        && "CONSULTATION".equals(deadline.kind())
                        && field.name().equals(deadline.field()))) {
      openConsultationDeadline(locked, field);
    }
    return finish(actor, locked, "REVIEWER_REASSIGNED", command.reason(), List.of(), requestId);
  }

  public List<AuditEventResponse> auditEvents(Actor actor, UUID id) {
    SecurityRequest request = find(actor, id);
    access.requireRead(canRead(actor, request));
    return audit.requestEvents(actor.institutionId(), id);
  }

  @Transactional
  public DocumentResponse document(Actor actor, UUID id, String requestId) {
    SecurityRequest request = find(actor, id);
    access.requireRead(canRead(actor, request));
    BusinessCase businessCase = caseFor(actor, request);
    SubmissionSnapshot stored = currentSnapshot(actor, request);
    boolean submitted = request.getCurrentSubmissionId() != null;
    SubmissionSnapshot content =
        stored != null ? stored : snapshot(new Locked(businessCase, request));
    String label =
        request.getStatus() == RequestStatus.FINALIZED
            ? "확정본"
            : submitted
                ? "제출본"
                : request.getStatus() == RequestStatus.CLOSED
                    ? "종결(반려) 당시 초안 · 미제출"
                    : request.getStatus() == RequestStatus.WITHDRAWN
                        ? "철회 당시 초안 · 미제출"
                        : "초안 · 미확정";
    StringBuilder html =
        new StringBuilder(
            "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\"><title>보안길잡이 서류</title></head><body>");
    html.append("<h1>")
        .append(escape(content.caseTitle()))
        .append("</h1><p>")
        .append(label)
        .append(" · ")
        .append(escape(content.docType()))
        .append("</p><p>서류 확정은 방화벽 적용 완료를 뜻하지 않습니다.</p>")
        .append(
            "<table><thead><tr><th>항목</th><th>값</th><th>출처</th><th>사람 확인</th></tr></thead><tbody>");
    Stream.concat(content.commonAnswers().stream(), content.answers().stream())
        .forEach(
            answer ->
                html.append("<tr><th>")
                    .append(escape(answer.label()))
                    .append("</th><td>")
                    .append(escape(answer.value()))
                    .append("</td><td>")
                    .append(answer.source() == null ? "담당자 확인 필요" : answer.source().name())
                    .append("</td><td>")
                    .append(answer.confirmed() ? "확인됨" : "미확정")
                    .append("</td></tr>"));
    html.append("</tbody></table></body></html>");
    audit.record(
        actor,
        "SECURITY_REQUEST",
        id,
        request.getRevision(),
        "DOCUMENT_DOWNLOADED",
        label,
        List.of(),
        requestId);
    return new DocumentResponse(
        "security-request-" + id + (submitted ? "-submission.html" : "-draft.html"),
        html.toString());
  }

  private Locked lock(Actor actor, UUID id, Long expectedRevision) {
    UUID caseId =
        requests
            .findCaseId(id, actor.institutionId())
            .orElseThrow(
                () -> new DomainException(404, "REQUEST_NOT_FOUND", "접근 가능한 신청을 찾을 수 없습니다."));
    BusinessCase businessCase =
        cases
            .lockByIdAndInstitutionId(caseId, actor.institutionId())
            .orElseThrow(() -> new DomainException(404, "CASE_NOT_FOUND", "사업 건을 찾을 수 없습니다."));
    SecurityRequest request =
        requests
            .lockByIdAndInstitutionId(id, actor.institutionId())
            .orElseThrow(() -> new DomainException(404, "REQUEST_NOT_FOUND", "신청을 찾을 수 없습니다."));
    access.requireRead(canRead(actor, request));
    if (expectedRevision != null) request.requireRevision(expectedRevision);
    return new Locked(businessCase, request);
  }

  private SecurityRequest find(Actor actor, UUID id) {
    return requests
        .findByIdAndInstitutionId(id, actor.institutionId())
        .orElseThrow(() -> new DomainException(404, "REQUEST_NOT_FOUND", "접근 가능한 신청을 찾을 수 없습니다."));
  }

  private BusinessCase caseFor(Actor actor, SecurityRequest request) {
    return cases
        .findByIdAndInstitutionId(request.getCaseId(), actor.institutionId())
        .orElseThrow(() -> new DomainException(404, "CASE_NOT_FOUND", "접근 가능한 사업 건을 찾을 수 없습니다."));
  }

  private boolean canRead(Actor actor, SecurityRequest request) {
    return access.canReadRequest(
            actor, request.getInstitutionId(), request.getOwnerId(), request.getId())
        || actor.institutionId().equals(request.getInstitutionId())
            && request.getStage() >= 2
            && (actor.role() == Role.INFRA || actor.role() == Role.SECURITY);
  }

  private void requireEditor(Actor actor, SecurityRequest request) {
    if (actor.role() == Role.APPLICANT) access.requireOwner(actor, request.getOwnerId());
    else assignments.requireAssigned(actor, request.getId());
    request.requireOpen();
  }

  private void requireConsultationStage(SecurityRequest request) {
    request.requireOpen();
    if (request.getStage() != 2 && request.getStage() != 3)
      throw new DomainException(409, "WRONG_STAGE", "협의 또는 최종 검토 중에만 보완할 수 있습니다.");
  }

  private void requireSecurityAfterAllocation(Actor actor, SecurityRequest request) {
    if (actor.role() == Role.SECURITY
        && !reviews.readiness(actor.institutionId(), request.getId()).allocationCompleted()) {
      throw new DomainException(422, "ALLOCATION_REQUIRED", "인프라 할당이 완료된 뒤 정보보안 검토를 시작해 주세요.");
    }
  }

  private boolean fieldsReady(Locked locked, Role role) {
    return Stream.concat(
            locked.businessCase().getAnswers().stream(), locked.request().getAnswers().stream())
        .filter(answer -> answer.ownerRole() == role)
        .allMatch(AnswerValue::ready);
  }

  private List<String> validateFields(Locked locked, List<String> fields) {
    var known =
        Stream.concat(
                locked.businessCase().getAnswers().stream(), locked.request().getAnswers().stream())
            .map(AnswerValue::key)
            .toList();
    if (fields == null
        || fields.isEmpty()
        || fields.size() > 40
        || new HashSet<>(fields).size() != fields.size()
        || !known.containsAll(fields))
      throw new DomainException(422, "UNKNOWN_OR_DUPLICATE_FIELD", "이 신청의 보완 항목을 중복 없이 선택해 주세요.");
    return List.copyOf(fields);
  }

  private void requireBothAssigned(SecurityRequest request) {
    if (!assignments.hasAssigned(request.getInstitutionId(), request.getId(), Role.INFRA)
        || !assignments.hasAssigned(request.getInstitutionId(), request.getId(), Role.SECURITY)) {
      throw new DomainException(422, "REVIEWER_UNASSIGNED", "두 분야의 활성 담당자 배정이 필요합니다.");
    }
  }

  private void openConsultationDeadlines(Locked locked) {
    for (Role role : List.of(Role.INFRA, Role.SECURITY)) {
      if (assignments.hasAssigned(
          locked.request().getInstitutionId(), locked.request().getId(), role))
        openConsultationDeadline(locked, role);
    }
  }

  private void openConsultationDeadline(Locked locked, Role role) {
    deadlines.open(
        locked.request().getInstitutionId(),
        locked.request().getId(),
        role,
        "CONSULTATION",
        locked.businessCase().getPolicy().consultationDays(),
        locked.businessCase().getPolicy().holidays(),
        locked.businessCase().getPublicationVersion());
  }

  private SecurityRequestResponse finish(
      Actor actor,
      Locked locked,
      String action,
      String reason,
      List<String> fieldKeys,
      String requestId) {
    requests.saveAndFlush(locked.request());
    audit.record(
        actor,
        "SECURITY_REQUEST",
        locked.request().getId(),
        locked.request().getRevision(),
        action,
        reason,
        fieldKeys,
        requestId);
    return response(actor, locked.businessCase(), locked.request());
  }

  private SubmissionSnapshot snapshot(Locked locked) {
    BusinessCase businessCase = locked.businessCase();
    SecurityRequest request = locked.request();
    return new SubmissionSnapshot(
        businessCase.getTitle(),
        businessCase.getDepartment(),
        businessCase.getOwnerName(),
        request.getDocType().name(),
        businessCase.getPublicationVersion(),
        businessCase.getRevision(),
        request.getRevision(),
        businessCase.getAnswers(),
        request.getAnswers());
  }

  private SubmissionSnapshot currentSnapshot(Actor actor, SecurityRequest request) {
    if (request.getCurrentSubmissionId() == null) return request.getTerminalSnapshot();
    return submissions
        .findByIdAndInstitutionId(request.getCurrentSubmissionId(), actor.institutionId())
        .filter(value -> value.getRequestId().equals(request.getId()))
        .map(SecuritySubmission::getSnapshot)
        .orElseThrow(() -> new DomainException(409, "SUBMISSION_NOT_FOUND", "제출본 연결을 확인해 주세요."));
  }

  private SubmissionSnapshot snapshotForEnd(Actor actor, Locked locked) {
    SubmissionSnapshot stored = currentSnapshot(actor, locked.request());
    return stored == null ? snapshot(locked) : stored;
  }

  private SecurityRequestResponse response(
      Actor actor, BusinessCase businessCase, SecurityRequest request) {
    SubmissionSnapshot stored = currentSnapshot(actor, request);
    var common = stored == null ? businessCase.getAnswers() : stored.commonAnswers();
    var specific = stored == null ? request.getAnswers() : stored.answers();
    List<String> changedCommon =
        stored != null && request.getCurrentSubmissionId() != null
            ? stored.commonAnswers().stream()
                .filter(
                    previous ->
                        businessCase.getAnswers().stream()
                            .anyMatch(
                                current ->
                                    previous.key().equals(current.key())
                                        && previous.contentDiffers(current)))
                .map(AnswerValue::key)
                .toList()
            : request.getData().changedCommonFields();
    ReviewReadiness readiness = reviews.readiness(actor.institutionId(), request.getId());
    return new SecurityRequestResponse(
        request.getId(),
        businessCase.getId(),
        businessCase.getTitle(),
        request.getDocType().name(),
        request.getOwnerId(),
        businessCase.getOwnerName(),
        request.getStage(),
        request.getStatus().name(),
        request.getRevision(),
        stored == null ? businessCase.getRevision() : stored.caseRevision(),
        businessCase.getPublicationVersion(),
        common.stream().map(AnswerResponse::from).toList(),
        specific.stream().map(AnswerResponse::from).toList(),
        reviews.list(actor.institutionId(), request.getId()),
        assignments.list(actor.institutionId(), request.getId()),
        reviews.supplements(actor.institutionId(), request.getId()),
        request.getData().returns().stream().map(StageReturnResponse::from).toList(),
        deadlines.list(actor.institutionId(), request.getId()),
        submissions
            .findByRequestIdAndInstitutionIdOrderByNumber(request.getId(), actor.institutionId())
            .stream()
            .map(
                value ->
                    new SubmissionResponse(
                        value.getId(),
                        value.getNumber(),
                        value.getRequestRevision(),
                        value.getSnapshot().caseRevision(),
                        value.getCreatedAt()))
            .toList(),
        reviews.finalConfirmations(actor.institutionId(), request.getId()),
        request.getCurrentSubmissionId(),
        changedCommon,
        request.getData().highlightedFields(),
        blockers(request, common, specific, readiness),
        allowedActions(actor, request, readiness),
        request.getCreatedAt(),
        request.getUpdatedAt());
  }

  private List<String> blockers(
      SecurityRequest request,
      List<AnswerValue> common,
      List<AnswerValue> specific,
      ReviewReadiness state) {
    if (request.getStatus().terminal()) return List.of();
    List<String> values = new ArrayList<>();
    if (request.getStage() < 4)
      Stream.concat(common.stream(), specific.stream())
          .filter(answer -> !answer.ready())
          .forEach(answer -> values.add(answer.label() + ": 담당 역할의 입력·확인 필요"));
    if (request.getStage() == 2 || request.getStage() == 3) {
      for (Role field : List.of(Role.INFRA, Role.SECURITY))
        if (!assignments.hasAssigned(request.getInstitutionId(), request.getId(), field))
          values.add(field.name() + ": 담당자 미배정");
      if (!state.allocationCompleted()) values.add("인프라 할당 완료 필요");
      if (!state.infraComplete()) values.add("인프라 협의 완료 필요");
      if (!state.securityComplete()) values.add("정보보안 협의 완료 필요");
      if (state.unresolvedSupplements()) values.add("담당자의 보완 해결 확인 필요");
      if (request.getStage() == 3 && !state.complete()) values.add("내용이 바뀌었다면 2단계로 재검토를 요청해 주세요.");
    }
    if (request.getStage() == 4
        && !reviews.bothFinalConfirmed(
            request.getInstitutionId(), request.getCurrentSubmissionId()))
      values.add("같은 제출본에 대한 인프라 → 정보보안 최종 확인 필요");
    return List.copyOf(values);
  }

  private List<String> allowedActions(Actor actor, SecurityRequest request, ReviewReadiness state) {
    List<String> actions = new ArrayList<>();
    actions.add("DOWNLOAD");
    if (request.getStatus().terminal()) return List.copyOf(actions);
    boolean owner = actor.role() == Role.APPLICANT && actor.userId().equals(request.getOwnerId());
    boolean assigned = assignments.isAssigned(actor, request.getId());
    if (request.getStage() < 4 && (owner || assigned)) {
      actions.add("EDIT_CASE");
      actions.add("EDIT_ANSWERS");
    }
    if (owner) {
      actions.add("WITHDRAW");
      if (request.getStage() == 1) actions.add("CONSULT");
      if (request.getStage() == 2 || request.getStage() == 3) actions.add("ANSWER_SUPPLEMENT");
      if (request.getStage() == 3) {
        actions.add("RETURN");
        actions.add("SUBMIT");
      }
    }
    if (assigned) {
      actions.add("CLOSE");
      if (request.getStage() == 2 || request.getStage() == 4) actions.add("RETURN");
      if (request.getStage() == 2) {
        if (actor.role() == Role.INFRA) actions.add("ALLOCATE");
        if (state.allocationCompleted()) actions.add("COMPLETE_REVIEW");
      }
      if ((request.getStage() == 2 || request.getStage() == 3)
          && (actor.role() == Role.INFRA || state.allocationCompleted())) {
        actions.add("REQUEST_SUPPLEMENT");
        actions.add("RESOLVE_SUPPLEMENT");
      }
      if (request.getStage() == 4) {
        var confirmations = reviews.finalConfirmations(actor.institutionId(), request.getId());
        boolean done =
            confirmations.stream()
                .anyMatch(
                    value ->
                        Objects.equals(value.submissionId(), request.getCurrentSubmissionId())
                            && value.field().equals(actor.role().name()));
        boolean infra =
            confirmations.stream()
                .anyMatch(
                    value ->
                        Objects.equals(value.submissionId(), request.getCurrentSubmissionId())
                            && value.field().equals("INFRA"));
        if (!done && (actor.role() == Role.INFRA || infra)) actions.add("FINAL_CONFIRM");
        if (actor.role() == Role.SECURITY
            && reviews.bothFinalConfirmed(actor.institutionId(), request.getCurrentSubmissionId()))
          actions.add("FINALIZE");
      }
    }
    if (actor.role() == Role.ADMIN
        && (request.getStage() > 1
            || !reviews.list(actor.institutionId(), request.getId()).isEmpty()))
      actions.add("REASSIGN");
    return List.copyOf(actions);
  }

  private static String escape(String value) {
    return value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;");
  }

  private record Locked(BusinessCase businessCase, SecurityRequest request) {}
}
