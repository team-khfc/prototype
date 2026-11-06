package kr.securityadvisor.request.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import kr.securityadvisor.assignment.service.AssignmentOperations;
import kr.securityadvisor.audit.service.AuditTrail;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.PolicyProvider;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import kr.securityadvisor.request.domain.BusinessCase;
import kr.securityadvisor.request.domain.DocType;
import kr.securityadvisor.request.domain.SecurityRequest;
import kr.securityadvisor.request.dto.AiAnswerProposal;
import kr.securityadvisor.request.dto.WorkflowCommands.AnswerInput;
import kr.securityadvisor.request.dto.WorkflowCommands.AnswerPatch;
import kr.securityadvisor.request.dto.WorkflowCommands.CreateCase;
import kr.securityadvisor.request.dto.WorkflowResponses.AnswerResponse;
import kr.securityadvisor.request.dto.WorkflowResponses.BusinessCaseResponse;
import kr.securityadvisor.request.dto.WorkflowResponses.SecurityRequestSummary;
import kr.securityadvisor.request.repository.BusinessCaseRepository;
import kr.securityadvisor.request.repository.SecurityRequestRepository;
import kr.securityadvisor.review.service.ReviewOperations;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 공통값은 한 번 수집하고 미제출 신청에만 재검토 영향을 전달한다. */
@Service
@Transactional(readOnly = true)
public class BusinessCaseService {
  private final BusinessCaseRepository cases;
  private final SecurityRequestRepository requests;
  private final AssignmentOperations assignments;
  private final ReviewOperations reviews;
  private final AuditTrail audit;
  private final PolicyProvider policies;
  private final WorkflowAccess access;

  public BusinessCaseService(
      BusinessCaseRepository cases,
      SecurityRequestRepository requests,
      AssignmentOperations assignments,
      ReviewOperations reviews,
      AuditTrail audit,
      PolicyProvider policies,
      WorkflowAccess access) {
    this.cases = cases;
    this.requests = requests;
    this.assignments = assignments;
    this.reviews = reviews;
    this.audit = audit;
    this.policies = policies;
    this.access = access;
  }

  public List<BusinessCaseResponse> list(Actor actor) {
    var found =
        actor.role() == Role.APPLICANT
            ? cases.findByInstitutionIdAndOwnerIdOrderByUpdatedAtDesc(
                actor.institutionId(), actor.userId(), PageRequest.of(0, 100))
            : cases.findByInstitutionIdOrderByUpdatedAtDesc(
                actor.institutionId(), PageRequest.of(0, 100));
    return found.stream().filter(value -> canRead(actor, value)).map(this::response).toList();
  }

  public BusinessCaseResponse get(Actor actor, UUID id) {
    BusinessCase value = find(actor, id, false);
    access.requireRead(canRead(actor, value));
    return response(value);
  }

  @Transactional
  public BusinessCaseResponse create(Actor actor, CreateCase command, String requestId) {
    if (actor.role() != Role.APPLICANT)
      throw new DomainException(403, "APPLICANT_REQUIRED", "일반 사용자만 사업 건을 작성할 수 있습니다.");
    List<DocType> types;
    try {
      types = command.docTypes().stream().map(DocType::valueOf).toList();
    } catch (IllegalArgumentException exception) {
      throw new DomainException(422, "UNSUPPORTED_DOCUMENT", "방화벽 또는 보안성검토 서류를 선택해 주세요.");
    }
    if (types.isEmpty() || types.size() > 2 || new HashSet<>(types).size() != types.size()) {
      throw new DomainException(422, "DUPLICATE_DOCUMENT", "서류 종류는 중복 없이 선택해 주세요.");
    }
    var value =
        new BusinessCase(
            UUID.randomUUID(),
            actor,
            command.title(),
            command.department(),
            command.description(),
            policies.current(actor.institutionId()).version());
    value = cases.saveAndFlush(value);
    for (DocType type : types) {
      var request =
          requests.save(
              new SecurityRequest(
                  UUID.randomUUID(), value.getId(), actor.institutionId(), actor.userId(), type));
      audit.record(
          actor,
          "SECURITY_REQUEST",
          request.getId(),
          0,
          "REQUEST_CREATED",
          "",
          List.of(),
          requestId);
    }
    requests.flush();
    audit.record(
        actor, "BUSINESS_CASE", value.getId(), 0, "CASE_CREATED", "", List.of(), requestId);
    return response(value);
  }

  @Transactional
  public BusinessCaseResponse answer(Actor actor, UUID id, AnswerPatch command, String requestId) {
    BusinessCase value = find(actor, id, true);
    requireEditable(actor, value);
    value.requireRevision(command.expectedRevision());
    List<AnswerValue> next = applyInputs(actor, value.getAnswers(), command.answers());
    update(value, next, actor, "COMMON_ANSWERS_CHANGED", requestId);
    return response(value);
  }

  /** 분석 어댑터는 출처를 위조하는 답변 API 대신 이 경계로 미확정 후보를 전달한다. */
  @Transactional
  public BusinessCaseResponse proposeAnswers(
      Actor actor,
      UUID caseId,
      long expectedRevision,
      List<AiAnswerProposal> proposals,
      String requestId) {
    BusinessCase value = find(actor, caseId, true);
    access.requireOwner(actor, value.getOwnerId());
    requireEditable(actor, value);
    value.requireRevision(expectedRevision);
    if (proposals == null || proposals.isEmpty() || proposals.size() > 4) {
      throw new DomainException(422, "INVALID_AI_PROPOSALS", "분석 후보는 공통 설명 항목 1~4개여야 합니다.");
    }
    Map<String, AiAnswerProposal> byKey = new HashMap<>();
    for (AiAnswerProposal proposal : proposals) {
      if (proposal == null
          || !List.of("purpose", "dataTypes", "externalTransfer", "dataFlow")
              .contains(proposal.key())
          || byKey.putIfAbsent(proposal.key(), proposal) != null) {
        throw new DomainException(422, "AI_FIELD_FORBIDDEN", "AI 후보는 중복 없는 공통 설명 항목에만 적용할 수 있습니다.");
      }
    }
    List<AnswerValue> next =
        value.getAnswers().stream()
            .map(
                answer -> {
                  AiAnswerProposal proposal = byKey.get(answer.key());
                  return proposal == null || answer.confirmed()
                      ? answer
                      : answer.propose(proposal.value(), proposal.evidence());
                })
            .toList();
    update(value, next, actor, "AI_ANSWERS_PROPOSED", requestId);
    return response(value);
  }

  static List<AnswerValue> applyInputs(
      Actor actor, List<AnswerValue> current, List<AnswerInput> inputs) {
    Map<String, AnswerInput> byKey = new HashMap<>();
    var valid = current.stream().map(AnswerValue::key).toList();
    for (AnswerInput input : inputs) {
      if (!valid.contains(input.key()) || byKey.putIfAbsent(input.key(), input) != null) {
        throw new DomainException(422, "UNKNOWN_OR_DUPLICATE_FIELD", "해당 범위의 항목을 중복 없이 선택해 주세요.");
      }
    }
    return current.stream()
        .map(
            answer -> {
              AnswerInput input = byKey.get(answer.key());
              return input == null
                  ? answer
                  : answer.answer(actor, input.value(), input.confirmed(), input.notApplicable());
            })
        .toList();
  }

  private void update(
      BusinessCase value, List<AnswerValue> next, Actor actor, String action, String requestId) {
    List<String> contentChanged = new ArrayList<>();
    List<String> touched = new ArrayList<>();
    boolean allocationChanged = false;
    for (int i = 0; i < next.size(); i++) {
      AnswerValue previous = value.getAnswers().get(i);
      if (!previous.equals(next.get(i))) touched.add(previous.key());
      if (previous.contentDiffers(next.get(i))) {
        contentChanged.add(previous.key());
        allocationChanged |= previous.ownerRole() == Role.INFRA;
      }
    }
    if (touched.isEmpty()) return;
    value.answer(next);
    cases.saveAndFlush(value);
    if (!contentChanged.isEmpty()) {
      for (SecurityRequest request :
          requests.findByCaseIdAndInstitutionIdOrderById(value.getId(), actor.institutionId())) {
        if (request.getStage() == 4 || request.getStatus().terminal()) continue;
        request.commonChanged(contentChanged);
        reviews.invalidate(actor.institutionId(), request.getId(), allocationChanged);
        audit.record(
            actor,
            "SECURITY_REQUEST",
            request.getId(),
            request.getRevision(),
            "COMMON_INFORMATION_RECHECK",
            "공통 정보 변경",
            contentChanged,
            requestId);
      }
      requests.flush();
    }
    audit.record(
        actor, "BUSINESS_CASE", value.getId(), value.getRevision(), action, "", touched, requestId);
  }

  private void requireEditable(Actor actor, BusinessCase value) {
    access.requireRead(canRead(actor, value));
    if (!(actor.role() == Role.APPLICANT && actor.userId().equals(value.getOwnerId()))
        && !assignments.isAssignedToCase(actor, value.getId())) {
      throw new DomainException(403, "CASE_EDITOR_REQUIRED", "신청자 또는 배정 담당자만 공통 정보를 입력할 수 있습니다.");
    }
    boolean editable =
        requests
            .findByCaseIdAndInstitutionIdOrderById(value.getId(), actor.institutionId())
            .stream()
            .anyMatch(request -> request.getStage() < 4 && !request.getStatus().terminal());
    if (!editable)
      throw new DomainException(409, "CASE_FROZEN", "모든 신청이 제출되었거나 종료되어 공통 정보를 수정할 수 없습니다.");
  }

  private boolean canRead(Actor actor, BusinessCase value) {
    return access.canReadCase(actor, value.getInstitutionId(), value.getOwnerId(), value.getId())
        || actor.institutionId().equals(value.getInstitutionId())
            && (actor.role() == Role.INFRA || actor.role() == Role.SECURITY)
            && requests
                .findByCaseIdAndInstitutionIdOrderById(value.getId(), actor.institutionId())
                .stream()
                .anyMatch(request -> request.getStage() >= 2);
  }

  private BusinessCase find(Actor actor, UUID id, boolean lock) {
    return (lock
            ? cases.lockByIdAndInstitutionId(id, actor.institutionId())
            : cases.findByIdAndInstitutionId(id, actor.institutionId()))
        .orElseThrow(() -> new DomainException(404, "CASE_NOT_FOUND", "접근 가능한 사업 건을 찾을 수 없습니다."));
  }

  private BusinessCaseResponse response(BusinessCase value) {
    return new BusinessCaseResponse(
        value.getId(),
        value.getTitle(),
        value.getDepartment(),
        value.getDescription(),
        value.getInstitutionId(),
        value.getOwnerId(),
        value.getOwnerName(),
        value.getRevision(),
        value.getPublicationVersion(),
        value.getAnswers().stream().map(AnswerResponse::from).toList(),
        requests
            .findByCaseIdAndInstitutionIdOrderById(value.getId(), value.getInstitutionId())
            .stream()
            .map(
                request ->
                    new SecurityRequestSummary(
                        request.getId(),
                        value.getId(),
                        value.getTitle(),
                        request.getDocType().name(),
                        request.getStage(),
                        request.getStatus().name(),
                        request.getRevision(),
                        request.getUpdatedAt()))
            .toList(),
        value.getCreatedAt(),
        value.getUpdatedAt());
  }
}
