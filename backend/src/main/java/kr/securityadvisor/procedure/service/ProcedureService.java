package kr.securityadvisor.procedure.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.PolicyProvider;
import kr.securityadvisor.common.model.PolicySnapshot;
import kr.securityadvisor.common.model.Suggestion;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;
import kr.securityadvisor.procedure.domain.DocumentType;
import kr.securityadvisor.procedure.domain.NetworkPolicy;
import kr.securityadvisor.procedure.domain.Procedure;
import kr.securityadvisor.procedure.domain.ProcedureData;
import kr.securityadvisor.procedure.domain.ProcedureStatus;
import kr.securityadvisor.procedure.domain.Submission;
import kr.securityadvisor.procedure.domain.SubmissionSnapshot;
import kr.securityadvisor.procedure.domain.WorkflowRules;
import kr.securityadvisor.procedure.dto.AnswerPatchRequest;
import kr.securityadvisor.procedure.dto.CreateProcedureRequest;
import kr.securityadvisor.procedure.dto.DocumentDownloadResponse;
import kr.securityadvisor.procedure.dto.NetworkRequest;
import kr.securityadvisor.procedure.dto.ProcedureResponse;
import kr.securityadvisor.procedure.dto.ReviewRequest;
import kr.securityadvisor.procedure.dto.SupplementAnswerRequest;
import kr.securityadvisor.procedure.dto.SupplementQuestionRequest;
import kr.securityadvisor.procedure.repository.ProcedureRepository;
import kr.securityadvisor.procedure.repository.SubmissionRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 화면의 역할 값과 무관하게 기관·소유권·자료 버전·업무 전이를 최종 판단한다. */
@Service
@Transactional(readOnly = true)
public class ProcedureService {
  private static final Set<String> AI_KEYS =
      Set.of("purpose", "audience", "dataTypes", "externalTransfer", "period", "dataFlow");
  private final ProcedureRepository procedures;
  private final SubmissionRepository submissions;
  private final PolicyProvider policies;
  private final DocumentRenderer documents;

  /** 공개 정책 조회 경계만 참조해 기관 기능과 순환 의존하지 않는다. */
  public ProcedureService(
      ProcedureRepository procedures,
      SubmissionRepository submissions,
      PolicyProvider policies,
      DocumentRenderer documents) {
    this.procedures = procedures;
    this.submissions = submissions;
    this.policies = policies;
    this.documents = documents;
  }

  /**
   * 작성자는 본인 신청, 전문 담당자는 협의 이후 같은 기관 신청만 조회한다.
   *
   * @throws DomainException 기관 관리자에게 업무 조회 권한이 없는 경우
   */
  public List<ProcedureResponse> list(Actor actor) {
    requireBusinessActor(actor);
    List<Procedure> found =
        actor.role() == Role.APPLICANT
            ? procedures.findByInstitutionIdAndOwnerIdOrderByUpdatedAtDesc(
                actor.institutionId(), actor.userId(), PageRequest.of(0, 100))
            : procedures.findByInstitutionIdAndStatusNotOrderByUpdatedAtDesc(
                actor.institutionId(), ProcedureStatus.DRAFT, PageRequest.of(0, 100));
    return found.stream().map(item -> response(item, actor)).toList();
  }

  /**
   * 특정 신청과 연결된 분석·문서에도 같은 조회 경계를 적용한다.
   *
   * @throws DomainException 신청이 없거나 해당 신원으로 열람할 수 없는 경우
   */
  public ProcedureResponse get(Actor actor, UUID id) {
    return response(load(actor, id, false), actor);
  }

  /**
   * 게시된 기관 정책을 복사하여 새로운 설정이 진행 중인 신청을 바꾸지 않게 한다.
   *
   * @throws DomainException 신청자 역할이 아니거나 기본 입력이 잘못된 경우
   */
  @Transactional
  public ProcedureResponse create(Actor actor, CreateProcedureRequest input) {
    requireRole(actor, Role.APPLICANT);
    String title = text(input.title(), 160, true);
    String department = text(input.department(), 100, true);
    String description = text(input.description(), 20000, false);
    DocumentType documentType;
    try {
      documentType = DocumentType.valueOf(input.documentType());
    } catch (IllegalArgumentException | NullPointerException exception) {
      throw new DomainException(422, "INVALID_DOCUMENT_TYPE", "방화벽 또는 보안성검토 서류를 선택해 주세요.");
    }
    PolicySnapshot snapshot = policies.current(actor.institutionId());
    ProcedureData initial =
        new ProcedureData(
            WorkflowRules.initialAnswers(documentType, snapshot.policy()),
            List.of(),
            List.of(
                new ProcedureData.Review(Role.INFRA, "PENDING", null, "", null, null),
                new ProcedureData.Review(Role.SECURITY, "PENDING", null, "", null, null)),
            List.of(),
            List.of(event(actor, "CREATED", "새 신청을 작성하기 시작했습니다.")));
    Procedure procedure =
        new Procedure(
            UUID.randomUUID(),
            actor.institutionId(),
            actor.userId(),
            actor.displayName(),
            title,
            documentType,
            department,
            description,
            snapshot.version(),
            snapshot.policy(),
            initial);
    return response(procedures.saveAndFlush(procedure), actor);
  }

  /**
   * 각 역할이 맡은 값만 변경하고 원출처와 사람 확인을 별도로 기록한다.
   *
   * @throws DomainException 역할 위반·오래된 버전·제출 후 편집·잘못된 확인 요청인 경우
   */
  @Transactional
  public ProcedureResponse updateAnswers(Actor actor, UUID id, AnswerPatchRequest input) {
    Procedure procedure = editable(actor, id, input.expectedRevision());
    if (input.answers() == null || input.answers().isEmpty() || input.answers().size() > 100) {
      throw new DomainException(422, "INVALID_ANSWERS", "저장할 질문을 1~100개 선택해 주세요.");
    }
    Map<String, ProcedureData.Answer> existing = answerMap(procedure);
    Map<String, ProcedureData.Answer> replacements = new HashMap<>();
    for (AnswerPatchRequest.AnswerInput item : input.answers()) {
      if (item == null || replacements.containsKey(item.key())) {
        throw new DomainException(422, "DUPLICATE_ANSWER", "질문 식별자는 한 번만 보낼 수 있습니다.");
      }
      ProcedureData.Answer old = existing.get(item.key());
      if (old == null) {
        throw new DomainException(422, "UNKNOWN_QUESTION", "이 신청에 없는 질문은 저장할 수 없습니다.");
      }
      if (old.ownerRole() != actor.role()) {
        throw new DomainException(403, "FIELD_OWNER_REQUIRED", "해당 질문의 담당 역할만 값을 입력·확인할 수 있습니다.");
      }
      replacements.put(item.key(), updateAnswer(actor, old, item));
    }
    List<ProcedureData.Answer> answers =
        procedure.getData().answers().stream()
            .map(answer -> replacements.getOrDefault(answer.key(), answer))
            .toList();
    if (answers.equals(procedure.getData().answers())) return response(procedure, actor);
    changeContent(
        procedure,
        actor,
        answers,
        procedure.getData().rules(),
        procedure.getData().supplements(),
        "ANSWERS_SAVED",
        "담당 질문 " + input.answers().size() + "개의 값과 확인 상태를 저장했습니다.");
    return save(procedure, actor);
  }

  /**
   * 저장된 AI 후보를 한 버전에서 일괄 적용하되 사람이 확인한 값은 덮어쓰지 않는다.
   *
   * @throws DomainException 신청자·버전·후보 필드·근거·미확정 조건이 맞지 않는 경우
   */
  @Transactional
  public ProcedureResponse propose(
      Actor actor, UUID id, long expectedRevision, List<Suggestion> suggestions) {
    requireRole(actor, Role.APPLICANT);
    Procedure procedure = editable(actor, id, expectedRevision);
    if (suggestions == null || suggestions.isEmpty() || suggestions.size() > AI_KEYS.size()) {
      throw new DomainException(422, "INVALID_SUGGESTIONS", "적용할 분석 후보를 확인해 주세요.");
    }
    Map<String, ProcedureData.Answer> existing = answerMap(procedure);
    Map<String, ProcedureData.Answer> replacements = new HashMap<>();
    for (Suggestion suggestion : suggestions) {
      if (suggestion == null
          || !AI_KEYS.contains(suggestion.key())
          || replacements.containsKey(suggestion.key())) {
        throw new DomainException(
            422, "INVALID_SUGGESTION_FIELD", "AI는 허용된 현업 질문에만 후보를 제안할 수 있습니다.");
      }
      ProcedureData.Answer old = existing.get(suggestion.key());
      if (old == null || old.ownerRole() != Role.APPLICANT) {
        throw new DomainException(422, "INVALID_SUGGESTION_FIELD", "제안 대상 질문을 찾을 수 없습니다.");
      }
      if (old.status() == ProcedureData.AnswerStatus.CONFIRMED
          || old.status() == ProcedureData.AnswerStatus.NOT_APPLICABLE) {
        throw new DomainException(
            409,
            "CONFIRMED_VALUE_PROTECTED",
            "이미 사람이 확인한 값은 AI 후보로 덮어쓸 수 없습니다.",
            procedure.getRevision());
      }
      String value = text(suggestion.value(), 4000, true);
      validateExternalTransfer(old.key(), value);
      String evidence = text(suggestion.evidence(), 4000, true);
      replacements.put(
          old.key(),
          new ProcedureData.Answer(
              old.key(),
              old.label(),
              old.reason(),
              old.ownerRole(),
              old.requiredAt(),
              value,
              ProcedureData.AnswerStatus.PROPOSED,
              new ProcedureData.Source(
                  ProcedureData.SourceKind.AI_INFERENCE, evidence, "AI 제안", Instant.now()),
              null));
    }
    List<ProcedureData.Answer> answers =
        procedure.getData().answers().stream()
            .map(answer -> replacements.getOrDefault(answer.key(), answer))
            .toList();
    changeContent(
        procedure,
        actor,
        answers,
        procedure.getData().rules(),
        procedure.getData().supplements(),
        "AI_PROPOSALS_APPLIED",
        "근거가 있는 후보를 미확정 답변으로 적용했습니다. 사람의 확인이 필요합니다.");
    return save(procedure, actor);
  }

  /**
   * 인프라 담당자가 검증한 주소·포트·기간으로 통신 규칙 전체를 갱신한다.
   *
   * @throws DomainException 인프라 역할·방화벽 서류·주소 범위·버전 조건이 맞지 않는 경우
   */
  @Transactional
  public ProcedureResponse updateNetwork(Actor actor, UUID id, NetworkRequest input) {
    requireRole(actor, Role.INFRA);
    Procedure procedure = editable(actor, id, input.expectedRevision());
    if (procedure.getDocumentType() != DocumentType.FIREWALL) {
      throw new DomainException(422, "NETWORK_NOT_APPLICABLE", "방화벽 신청에서 통신 규칙을 입력할 수 있습니다.");
    }
    if (input.rules() == null || input.rules().size() > 50) {
      throw new DomainException(422, "INVALID_RULE_COUNT", "통신 규칙은 최대 50개까지 입력할 수 있습니다.");
    }
    Set<UUID> existingIds =
        new HashSet<>(
            procedure.getData().rules().stream().map(ProcedureData.NetworkRule::id).toList());
    Set<UUID> usedIds = new HashSet<>();
    Set<String> signatures = new HashSet<>();
    List<ProcedureData.NetworkRule> rules = new ArrayList<>();
    Instant now = Instant.now();
    for (NetworkRequest.RuleInput item : input.rules()) {
      if (item == null || (item.id() != null && !existingIds.contains(item.id()))) {
        throw new DomainException(422, "UNKNOWN_NETWORK_RULE", "이 신청의 통신 규칙 식별자를 확인해 주세요.");
      }
      UUID ruleId = item.id() == null ? UUID.randomUUID() : item.id();
      if (!usedIds.add(ruleId))
        throw new DomainException(422, "DUPLICATE_NETWORK_RULE", "같은 통신 행을 중복해서 저장할 수 없습니다.");
      ProcedureData.NetworkRule rule =
          new ProcedureData.NetworkRule(
              ruleId,
              text(item.sourceName(), 100, true),
              text(item.sourceIp(), 64, true),
              text(item.destinationName(), 100, true),
              text(item.destinationIp(), 64, true),
              text(item.port(), 20, false),
              text(item.protocol(), 10, true),
              text(item.direction(), 20, true),
              item.startsOn(),
              item.endsOn(),
              text(item.purpose(), 1000, true),
              new ProcedureData.Source(
                  ProcedureData.SourceKind.SPECIALIST_INPUT,
                  "인프라 담당자가 입력한 통신 범위와 적용 기간",
                  actor.displayName(),
                  now),
              new ProcedureData.Confirmation(actor.displayName(), actor.role(), now));
      NetworkPolicy.validate(rule);
      String signature =
          rule.sourceIp()
              + "|"
              + rule.destinationIp()
              + "|"
              + rule.protocol()
              + "|"
              + rule.port()
              + "|"
              + rule.direction()
              + "|"
              + rule.startsOn()
              + "|"
              + rule.endsOn();
      if (!signatures.add(signature))
        throw new DomainException(422, "DUPLICATE_NETWORK_RULE", "동일한 통신 범위와 기간이 중복되었습니다.");
      rules.add(rule);
    }
    changeContent(
        procedure,
        actor,
        procedure.getData().answers(),
        rules,
        procedure.getData().supplements(),
        "NETWORK_CONFIRMED",
        "인프라 담당자가 통신 규칙 " + rules.size() + "개를 입력·확인했습니다.");
    return save(procedure, actor);
  }

  /**
   * 신청자가 기본 설명을 확인한 뒤에만 전문 담당자에게 공개한다.
   *
   * @throws DomainException 작성자·버전·필수 설명·현재 상태가 맞지 않는 경우
   */
  @Transactional
  public ProcedureResponse consult(Actor actor, UUID id, long expectedRevision) {
    requireRole(actor, Role.APPLICANT);
    Procedure procedure = editable(actor, id, expectedRevision);
    if (procedure.getStatus() != ProcedureStatus.DRAFT) {
      throw new DomainException(
          409, "ALREADY_COLLABORATING", "이미 담당자 협의를 요청한 신청입니다.", procedure.getRevision());
    }
    rejectBlockers(WorkflowRules.consultationBlockers(procedure), "CONSULTATION_BLOCKED");
    ProcedureData old = procedure.getData();
    procedure.openConsultation(
        new ProcedureData(
            old.answers(),
            old.rules(),
            old.reviews(),
            old.supplements(),
            appendEvent(
                old.timeline(), event(actor, "CONSULTATION_REQUESTED", "전문 담당자에게 협의를 요청했습니다."))));
    return save(procedure, actor);
  }

  /**
   * 해당 담당자의 현재 내용 버전 검토를 기록하고 순차 정책을 검사한다.
   *
   * @throws DomainException 전문 역할·보완 해결·선행 검토 조건이 맞지 않는 경우
   */
  @Transactional
  public ProcedureResponse review(Actor actor, UUID id, ReviewRequest input) {
    requireSpecialist(actor);
    Procedure procedure = editable(actor, id, input.expectedRevision());
    rejectBlockers(WorkflowRules.reviewBlockers(procedure, actor.role()), "REVIEW_BLOCKED");
    String comment = text(input.comment(), 2000, false);
    ProcedureData old = procedure.getData();
    List<ProcedureData.Review> reviews =
        old.reviews().stream()
            .map(
                review ->
                    review.role() == actor.role()
                        ? new ProcedureData.Review(
                            actor.role(),
                            "COMPLETE",
                            procedure.getRevision(),
                            comment,
                            actor.displayName(),
                            Instant.now())
                        : review)
            .toList();
    procedure.recordProgress(
        new ProcedureData(
            old.answers(),
            old.rules(),
            reviews,
            old.supplements(),
            appendEvent(
                old.timeline(),
                event(actor, "REVIEW_COMPLETED", "현재 내용 버전에 대한 담당 검토를 마쳤습니다. 실제 처리는 별도입니다."))));
    return save(procedure, actor);
  }

  /**
   * 전문 담당자의 보완 질문은 새 검토가 필요한 업무 변경으로 기록한다.
   *
   * @throws DomainException 전문 역할·업무 상태·버전 조건이 맞지 않는 경우
   */
  @Transactional
  public ProcedureResponse requestSupplement(
      Actor actor, UUID id, SupplementQuestionRequest input) {
    requireSpecialist(actor);
    Procedure procedure = editable(actor, id, input.expectedRevision());
    if (procedure.getData().supplements().size() >= 100) {
      throw new DomainException(422, "SUPPLEMENT_LIMIT", "한 신청에는 최대 100개의 보완 요청을 기록할 수 있습니다.");
    }
    List<ProcedureData.Supplement> supplements = new ArrayList<>(procedure.getData().supplements());
    supplements.add(
        new ProcedureData.Supplement(
            UUID.randomUUID(),
            text(input.question(), 2000, true),
            "",
            actor.role(),
            actor.displayName(),
            "OPEN",
            Instant.now(),
            null));
    changeContent(
        procedure,
        actor,
        procedure.getData().answers(),
        procedure.getData().rules(),
        supplements,
        "SUPPLEMENT_REQUESTED",
        "신청자에게 필요한 정보의 보완을 요청했습니다.");
    return save(procedure, actor);
  }

  /**
   * 신청자가 답변해도 담당자의 해결 확인 전까지 제출을 허용하지 않는다.
   *
   * @throws DomainException 작성자·버전·보완 상태가 맞지 않는 경우
   */
  @Transactional
  public ProcedureResponse answerSupplement(
      Actor actor, UUID id, UUID supplementId, SupplementAnswerRequest input) {
    requireRole(actor, Role.APPLICANT);
    Procedure procedure = editable(actor, id, input.expectedRevision());
    ProcedureData.Supplement target = supplement(procedure, supplementId);
    if (target.status().equals("RESOLVED")) {
      throw new DomainException(
          409, "SUPPLEMENT_ALREADY_RESOLVED", "해결된 보완 요청의 답변을 바꿀 수 없습니다.", procedure.getRevision());
    }
    ProcedureData.Supplement changed =
        new ProcedureData.Supplement(
            target.id(),
            target.question(),
            text(input.answer(), 4000, true),
            target.requestedByRole(),
            target.requestedBy(),
            "ANSWERED",
            target.createdAt(),
            null);
    List<ProcedureData.Supplement> supplements = replaceSupplement(procedure, changed);
    changeContent(
        procedure,
        actor,
        procedure.getData().answers(),
        procedure.getData().rules(),
        supplements,
        "SUPPLEMENT_ANSWERED",
        "보완 답변을 저장했습니다. 요청 담당자의 해결 확인이 필요합니다.");
    return save(procedure, actor);
  }

  /**
   * 보완 요청을 만든 담당 분야가 답변을 재확인한 경우에만 해결 상태로 바꾼다.
   *
   * @throws DomainException 요청 역할이 아니거나 답변이 아직 없는 경우
   */
  @Transactional
  public ProcedureResponse resolveSupplement(
      Actor actor, UUID id, UUID supplementId, long expectedRevision) {
    requireSpecialist(actor);
    Procedure procedure = editable(actor, id, expectedRevision);
    ProcedureData.Supplement target = supplement(procedure, supplementId);
    if (target.requestedByRole() != actor.role()) {
      throw new DomainException(403, "REQUESTING_ROLE_REQUIRED", "보완을 요청한 담당 분야가 해결 여부를 확인해야 합니다.");
    }
    if (!target.status().equals("ANSWERED")) {
      throw new DomainException(
          409,
          "SUPPLEMENT_ANSWER_REQUIRED",
          "신청자의 답변을 받은 뒤 해결 확인할 수 있습니다.",
          procedure.getRevision());
    }
    ProcedureData.Supplement changed =
        new ProcedureData.Supplement(
            target.id(),
            target.question(),
            target.answer(),
            target.requestedByRole(),
            target.requestedBy(),
            "RESOLVED",
            target.createdAt(),
            Instant.now());
    changeContent(
        procedure,
        actor,
        procedure.getData().answers(),
        procedure.getData().rules(),
        replaceSupplement(procedure, changed),
        "SUPPLEMENT_RESOLVED",
        "요청 담당자가 보완 답변을 읽고 해결 여부를 확인했습니다.");
    return save(procedure, actor);
  }

  /**
   * 모든 제출 조건을 통과한 한 버전의 자료와 문서를 멱등하게 보존한다.
   *
   * @throws DomainException 미확정·미해결 보완·검토 미완료·중복 키 충돌이 있는 경우
   */
  @Transactional
  public ProcedureResponse submit(
      Actor actor, UUID id, long expectedRevision, String idempotencyKey) {
    requireRole(actor, Role.APPLICANT);
    if (idempotencyKey == null || !idempotencyKey.matches("[A-Za-z0-9._:-]{8,100}")) {
      throw new DomainException(400, "INVALID_IDEMPOTENCY_KEY", "제출 요청 식별자를 다시 생성해 주세요.");
    }
    Procedure procedure = load(actor, id, true);
    var previous =
        submissions.findByInstitutionIdAndOwnerIdAndIdempotencyKey(
            actor.institutionId(), actor.userId(), idempotencyKey);
    if (previous.isPresent()) {
      Submission submission = previous.get();
      if (!submission.getProcedureId().equals(id)
          || submission.getSnapshot().revision() != expectedRevision) {
        throw new DomainException(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "같은 요청 식별자를 다른 제출 내용에 사용할 수 없습니다.",
            procedure.getRevision());
      }
      return response(procedure, actor);
    }
    checkRevision(procedure, expectedRevision);
    requireMutable(procedure);
    rejectBlockers(WorkflowRules.submissionBlockers(procedure), "SUBMISSION_BLOCKED");
    ProcedureData old = procedure.getData();
    procedure.markSubmitted(
        new ProcedureData(
            old.answers(),
            old.rules(),
            old.reviews(),
            old.supplements(),
            appendEvent(
                old.timeline(), event(actor, "SUBMITTED", "신청자가 최종 내용을 확인하고 제출본을 보존했습니다."))));
    SubmissionSnapshot snapshot = snapshot(procedure, Instant.now());
    Submission submission =
        new Submission(
            id,
            actor.institutionId(),
            actor.userId(),
            idempotencyKey,
            snapshot,
            documents.render(snapshot, true));
    try {
      submissions.saveAndFlush(submission);
    } catch (DataIntegrityViolationException exception) {
      throw new DomainException(
          409,
          "SUBMISSION_CONFLICT",
          "동시에 처리된 제출 요청이 있습니다. 최신 상태를 확인해 주세요.",
          procedure.getRevision());
    }
    return save(procedure, actor);
  }

  /**
   * 정보보안 담당자가 문서를 접수한 사실만 기록하고 제출 내용을 수정하지 않는다.
   *
   * @throws DomainException 정보보안 역할·제출 상태·버전이 맞지 않는 경우
   */
  @Transactional
  public ProcedureResponse receive(Actor actor, UUID id, long expectedRevision) {
    requireRole(actor, Role.SECURITY);
    Procedure procedure = load(actor, id, true);
    checkRevision(procedure, expectedRevision);
    if (procedure.getStatus() != ProcedureStatus.SUBMITTED) {
      throw new DomainException(
          409, "SUBMITTED_DOCUMENT_REQUIRED", "최종 제출된 서류만 접수할 수 있습니다.", procedure.getRevision());
    }
    ProcedureData old = procedure.getData();
    procedure.markReceived(
        new ProcedureData(
            old.answers(),
            old.rules(),
            old.reviews(),
            old.supplements(),
            appendEvent(
                old.timeline(),
                event(actor, "RECEIVED", "정보보안 담당자가 제출 서류를 접수했습니다. 실제 처리는 별도입니다."))));
    return save(procedure, actor);
  }

  /**
   * 문서 다운로드에도 신청 조회와 동일한 권한 검사를 적용한다.
   *
   * @throws DomainException 문서를 열람할 수 없거나 제출본이 존재하지 않는 경우
   */
  public DocumentDownloadResponse download(Actor actor, UUID id) {
    Procedure procedure = load(actor, id, false);
    String content;
    if (procedure.getStatus() == ProcedureStatus.SUBMITTED
        || procedure.getStatus() == ProcedureStatus.RECEIVED) {
      content =
          submissions
              .findByProcedureIdAndInstitutionId(id, actor.institutionId())
              .orElseThrow(
                  () ->
                      new DomainException(
                          409, "SUBMISSION_NOT_FOUND", "보존된 제출본을 찾지 못했습니다. 담당자에게 문의해 주세요."))
              .getDocumentHtml();
    } else {
      content = documents.render(snapshot(procedure, null), false);
    }
    return new DocumentDownloadResponse("security-advisor-" + id + ".html", content);
  }

  /**
   * 명시적으로 켠 시연 환경에서만 호출하며 동일 작성자에게 합성 시나리오를 한 번 구성한다.
   *
   * @throws DomainException 합성 역할의 기관이 다르거나 시연 자료가 업무 규칙을 위반하는 경우
   */
  @Transactional
  public void seedDemo(Actor applicant, Actor infra, Actor security) {
    requireRole(applicant, Role.APPLICANT);
    requireRole(infra, Role.INFRA);
    requireRole(security, Role.SECURITY);
    if (!applicant.institutionId().equals(infra.institutionId())
        || !applicant.institutionId().equals(security.institutionId())) {
      throw new DomainException(422, "DEMO_INSTITUTION_MISMATCH", "시연 계정은 같은 합성 기관에 속해야 합니다.");
    }
    if (procedures.existsByInstitutionIdAndOwnerId(applicant.institutionId(), applicant.userId()))
      return;
    List<String> titles =
        List.of(
            "주택연금 안내 챗봇",
            "공공시설 예약 안내",
            "온라인 상담 예약 서비스",
            "민원 서식 안내 도우미",
            "디지털 자료 열람 서비스",
            "교육 신청 안내 도우미",
            "시설 점검 현황 서비스",
            "정책 정보 검색 도우미",
            "공개 통계 안내 서비스",
            "업무 일정 안내 도우미",
            "기관 방문 예약 서비스",
            "시민 이용 안내 도우미");
    for (int index = 0; index < titles.size(); index++) {
      String title = titles.get(index);
      ProcedureResponse current =
          create(
              applicant,
              new CreateProcedureRequest(
                  "[합성] " + title,
                  index % 2 == 0 ? "FIREWALL" : "SECURITY_REVIEW",
                  "가상 디지털사업팀",
                  "합성 시연 자료입니다. "
                      + title
                      + "의 사업 목적과 담당자 협의 절차를 연습합니다. 실제 기관 정보·개인정보·내부 자산은 사용하지 않습니다."));
      if (index == 0 || index == 10) continue;
      if (index == 1) {
        updateAnswers(
            applicant,
            current.id(),
            new AnswerPatchRequest(
                current.revision(),
                List.of(
                    new AnswerPatchRequest.AnswerInput(
                        "purpose", "합성 공개 안내 정보를 찾아보는 시연용 서비스입니다.", false, false))));
        continue;
      }
      current = fillDemoAnswers(applicant, current);
      current = consult(applicant, current.id(), current.revision());
      if (index == 2) continue;
      current = fillDemoAnswers(infra, get(infra, current.id()));
      if (current.documentType().equals("FIREWALL")) {
        current =
            updateNetwork(
                infra,
                current.id(),
                new NetworkRequest(
                    current.revision(),
                    List.of(
                        new NetworkRequest.RuleInput(
                            null,
                            "합성 안내 화면",
                            "192.0.2.10",
                            "합성 안내 API",
                            "198.51.100.20",
                            "443",
                            "TCP",
                            "ONE_WAY",
                            LocalDate.of(2026, 11, 10),
                            LocalDate.of(2026, 11, 30),
                            "공개 예제 주소 대역을 이용한 문서 작성 시연"))));
      }
      if (index == 3) continue;
      current = fillDemoAnswers(security, get(security, current.id()));
      if (index == 4 || index == 5) {
        current =
            requestSupplement(
                security,
                current.id(),
                new SupplementQuestionRequest(
                    current.revision(), "공개 안내 자료만 사용하며 실제 이용자 식별정보를 수집하지 않는지 확인해 주세요."));
        if (index == 5) {
          answerSupplement(
              applicant,
              current.id(),
              current.supplements().getFirst().id(),
              new SupplementAnswerRequest(
                  current.revision(), "합성 시연은 공개 예제 자료만 사용하며 실제 이용자 정보는 수집하지 않습니다."));
        }
        continue;
      }
      current =
          review(
              security,
              current.id(),
              new ReviewRequest(
                  current.revision(), "합성 서류의 정보 확인과 보안 검토를 마쳤습니다. 실제 처리 완료를 의미하지 않습니다."));
      if (index == 9) continue;
      current =
          review(
              infra,
              current.id(),
              new ReviewRequest(
                  current.revision(), "합성 운영 환경과 통신 범위를 확인했습니다. 실제 장비 적용은 수행하지 않았습니다."));
      if (index == 6) continue;
      current = submit(applicant, current.id(), current.revision(), "demo-" + current.id());
      if (index == 8 || index == 11) receive(security, current.id(), current.revision());
    }
  }

  private ProcedureResponse fillDemoAnswers(Actor actor, ProcedureResponse procedure) {
    List<AnswerPatchRequest.AnswerInput> answers =
        procedure.answers().stream()
            .filter(answer -> answer.ownerRole().equals(actor.role().name()))
            .map(
                answer ->
                    new AnswerPatchRequest.AnswerInput(
                        answer.key(), demoAnswer(answer.key()), true, false))
            .toList();
    return updateAnswers(
        actor, procedure.id(), new AnswerPatchRequest(procedure.revision(), answers));
  }

  private static String demoAnswer(String key) {
    return switch (key) {
      case "purpose" -> "공개된 예제 안내 정보를 쉽게 찾아보는 합성 시연 서비스입니다.";
      case "audience" -> "가상의 일반 이용자와 시연 담당자";
      case "dataTypes" -> "공개 예제 안내문과 가상 질문만 사용합니다. 실제 개인정보는 수집하지 않습니다.";
      case "externalTransfer" -> "NO";
      case "period" -> "합성 시연 기간: 2026년 11월 10일~11월 30일";
      case "dataFlow" -> "가상 이용자 → 합성 안내 화면 → 합성 안내 API → 공개 예제 자료 → 안내 화면";
      case "operatingEnvironment" -> "실제 기관 시스템과 분리된 합성 시연 환경입니다. 공개 문서용 예제 주소만 사용합니다.";
      case "accessControl" -> "가상 역할에 따라 신청 작성·담당 검토·기관 설정 권한을 구분합니다.";
      case "retention" -> "시연용 합성 입력은 시연 종료 후 삭제하는 가상 계획입니다.";
      case "logging" -> "합성 신청의 작성·보완·검토 이력을 기록하며 실제 개인정보는 기록하지 않습니다.";
      default -> "담당자가 확인한 합성 시연 답변입니다. 실제 기관 정책 또는 자산 정보가 아닙니다.";
    };
  }

  private Procedure load(Actor actor, UUID id, boolean lock) {
    requireBusinessActor(actor);
    Procedure found =
        (lock
                ? procedures.lockByIdAndInstitutionId(id, actor.institutionId())
                : procedures.findByIdAndInstitutionId(id, actor.institutionId()))
            .orElseThrow(ProcedureService::notFound);
    if ((actor.role() == Role.APPLICANT && !found.getOwnerId().equals(actor.userId()))
        || (actor.role() != Role.APPLICANT && found.getStatus() == ProcedureStatus.DRAFT)) {
      throw notFound();
    }
    return found;
  }

  private Procedure editable(Actor actor, UUID id, long expectedRevision) {
    Procedure procedure = load(actor, id, true);
    checkRevision(procedure, expectedRevision);
    requireMutable(procedure);
    return procedure;
  }

  private ProcedureResponse save(Procedure procedure, Actor actor) {
    return response(procedures.saveAndFlush(procedure), actor);
  }

  private ProcedureResponse response(Procedure procedure, Actor actor) {
    List<String> actions = new ArrayList<>();
    if (procedure.getStatus() == ProcedureStatus.DRAFT
        || procedure.getStatus() == ProcedureStatus.COLLABORATING) {
      actions.add("EDIT");
      if (actor.role() == Role.APPLICANT) {
        actions.add("ANALYZE");
        if (procedure.getStatus() == ProcedureStatus.DRAFT
            && WorkflowRules.consultationBlockers(procedure).isEmpty()) actions.add("CONSULT");
        if (procedure.getData().supplements().stream()
            .anyMatch(item -> !item.status().equals("RESOLVED"))) actions.add("ANSWER");
        if (WorkflowRules.submissionBlockers(procedure).isEmpty()) actions.add("SUBMIT");
      } else {
        actions.add("SUPPLEMENT");
        if (WorkflowRules.reviewBlockers(procedure, actor.role()).isEmpty()) actions.add("REVIEW");
        if (procedure.getData().supplements().stream()
            .anyMatch(
                item -> item.requestedByRole() == actor.role() && item.status().equals("ANSWERED")))
          actions.add("RESOLVE");
      }
    }
    if (actor.role() == Role.SECURITY && procedure.getStatus() == ProcedureStatus.SUBMITTED)
      actions.add("RECEIVE");
    return ProcedureResponse.from(procedure, WorkflowRules.submissionBlockers(procedure), actions);
  }

  private static ProcedureData.Answer updateAnswer(
      Actor actor, ProcedureData.Answer old, AnswerPatchRequest.AnswerInput input) {
    String value = text(input.value(), 4000, false);
    if (input.notApplicable()
        && (!old.requiredAt().equals("OPTIONAL") || !input.confirmed() || value.isBlank())) {
      throw new DomainException(
          422, "NOT_APPLICABLE_REASON_REQUIRED", "선택 질문만 해당 없음으로 지정할 수 있으며 사유와 사람 확인이 필요합니다.");
    }
    if (value.isBlank()) {
      if (input.confirmed())
        throw new DomainException(422, "EMPTY_ANSWER", "내용이 없는 값은 확인할 수 없습니다.");
      return new ProcedureData.Answer(
          old.key(),
          old.label(),
          old.reason(),
          old.ownerRole(),
          old.requiredAt(),
          "",
          ProcedureData.AnswerStatus.EMPTY,
          null,
          null);
    }
    validateExternalTransfer(old.key(), value);
    boolean unknown = old.key().equals("externalTransfer") && value.equals("UNKNOWN");
    ProcedureData.AnswerStatus status =
        input.notApplicable()
            ? ProcedureData.AnswerStatus.NOT_APPLICABLE
            : input.confirmed() && !unknown
                ? ProcedureData.AnswerStatus.CONFIRMED
                : ProcedureData.AnswerStatus.PROPOSED;
    if (old.value().equals(value)
        && old.status() == status
        && old.source() != null
        && (status == ProcedureData.AnswerStatus.PROPOSED || old.confirmation() != null))
      return old;
    ProcedureData.Source source =
        old.value().equals(value) && old.source() != null
            ? old.source()
            : new ProcedureData.Source(
                actor.role() == Role.APPLICANT
                    ? ProcedureData.SourceKind.USER_ANSWER
                    : ProcedureData.SourceKind.SPECIALIST_INPUT,
                actor.role() == Role.APPLICANT
                    ? "신청자가 직접 입력하거나 수정한 답변"
                    : "해당 분야 담당자가 직접 입력하거나 수정한 정보",
                actor.displayName(),
                Instant.now());
    ProcedureData.Confirmation confirmation =
        status == ProcedureData.AnswerStatus.PROPOSED
            ? null
            : new ProcedureData.Confirmation(actor.displayName(), actor.role(), Instant.now());
    return new ProcedureData.Answer(
        old.key(),
        old.label(),
        old.reason(),
        old.ownerRole(),
        old.requiredAt(),
        value,
        status,
        source,
        confirmation);
  }

  private static void changeContent(
      Procedure procedure,
      Actor actor,
      List<ProcedureData.Answer> answers,
      List<ProcedureData.NetworkRule> rules,
      List<ProcedureData.Supplement> supplements,
      String action,
      String description) {
    procedure.replaceContent(
        new ProcedureData(
            answers,
            rules,
            WorkflowRules.invalidateReviews(procedure.getData().reviews()),
            supplements,
            appendEvent(procedure.getData().timeline(), event(actor, action, description))));
  }

  private static List<ProcedureData.Event> appendEvent(
      List<ProcedureData.Event> timeline, ProcedureData.Event event) {
    if (timeline.size() >= 1000)
      throw new DomainException(422, "HISTORY_LIMIT", "한 신청의 기록 한도에 도달했습니다. 담당자에게 문의해 주세요.");
    List<ProcedureData.Event> next = new ArrayList<>(timeline);
    next.add(event);
    return List.copyOf(next);
  }

  private static ProcedureData.Event event(Actor actor, String action, String description) {
    return new ProcedureData.Event(
        UUID.randomUUID(), action, description, actor.displayName(), Instant.now());
  }

  private static Map<String, ProcedureData.Answer> answerMap(Procedure procedure) {
    Map<String, ProcedureData.Answer> answers = new HashMap<>();
    for (ProcedureData.Answer answer : procedure.getData().answers())
      answers.put(answer.key(), answer);
    return answers;
  }

  private static ProcedureData.Supplement supplement(Procedure procedure, UUID id) {
    return procedure.getData().supplements().stream()
        .filter(item -> item.id().equals(id))
        .findFirst()
        .orElseThrow(() -> new DomainException(404, "SUPPLEMENT_NOT_FOUND", "보완 요청을 찾을 수 없습니다."));
  }

  private static List<ProcedureData.Supplement> replaceSupplement(
      Procedure procedure, ProcedureData.Supplement changed) {
    return procedure.getData().supplements().stream()
        .map(item -> item.id().equals(changed.id()) ? changed : item)
        .toList();
  }

  private static SubmissionSnapshot snapshot(Procedure procedure, Instant submittedAt) {
    return new SubmissionSnapshot(
        procedure.getId(),
        procedure.getTitle(),
        procedure.getDocumentType(),
        procedure.getDepartment(),
        procedure.getDescription(),
        procedure.getOwnerName(),
        procedure.getRevision(),
        procedure.getPolicyVersion(),
        procedure.getPolicy(),
        procedure.getData(),
        submittedAt);
  }

  private static void checkRevision(Procedure procedure, long expectedRevision) {
    if (procedure.getRevision() != expectedRevision) {
      throw new DomainException(
          409,
          "REVISION_CONFLICT",
          "다른 작업에서 내용이 바뀌었습니다. 입력을 보존한 채 최신 내용과 비교해 주세요.",
          procedure.getRevision());
    }
  }

  private static void requireMutable(Procedure procedure) {
    if (procedure.getStatus() == ProcedureStatus.SUBMITTED
        || procedure.getStatus() == ProcedureStatus.RECEIVED) {
      throw new DomainException(
          409, "SUBMISSION_LOCKED", "최종 제출한 내용은 수정할 수 없습니다.", procedure.getRevision());
    }
  }

  private static void requireBusinessActor(Actor actor) {
    if (actor == null) throw new DomainException(401, "AUTHENTICATION_REQUIRED", "로그인 후 이용해 주세요.");
    if (actor.role() == Role.ADMIN)
      throw new DomainException(403, "BUSINESS_ROLE_REQUIRED", "기관 관리자는 업무 신청을 조회하거나 검토할 수 없습니다.");
  }

  private static void requireRole(Actor actor, Role role) {
    if (actor == null || actor.role() != role)
      throw new DomainException(403, "ROLE_REQUIRED", "이 작업을 수행할 담당 역할이 아닙니다.");
  }

  private static void requireSpecialist(Actor actor) {
    if (actor == null || (actor.role() != Role.INFRA && actor.role() != Role.SECURITY)) {
      throw new DomainException(403, "SPECIALIST_REQUIRED", "전문 담당자만 이 작업을 수행할 수 있습니다.");
    }
  }

  private static void validateExternalTransfer(String key, String value) {
    if (key.equals("externalTransfer") && !Set.of("NO", "YES", "UNKNOWN").contains(value)) {
      throw new DomainException(
          422, "INVALID_EXTERNAL_TRANSFER", "외부 전송 여부를 예·아니요·잘 모름 중에서 선택해 주세요.");
    }
  }

  private static void rejectBlockers(List<String> blockers, String code) {
    if (!blockers.isEmpty()) throw new DomainException(422, code, String.join(" ", blockers));
  }

  private static String text(String value, int limit, boolean required) {
    if (value == null || value.length() > limit || (required && value.isBlank())) {
      throw new DomainException(422, "INVALID_INPUT", "입력의 필수 여부와 최대 길이를 확인해 주세요.");
    }
    return value.strip();
  }

  private static DomainException notFound() {
    return new DomainException(404, "PROCEDURE_NOT_FOUND", "열람할 수 있는 신청을 찾지 못했습니다.");
  }
}
