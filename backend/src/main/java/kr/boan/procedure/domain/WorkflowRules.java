package kr.boan.procedure.domain;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import kr.boan.common.error.DomainException;
import kr.boan.common.model.ExtraQuestion;
import kr.boan.common.model.OrganizationPolicy;
import kr.boan.common.security.Role;

/** 표시용 단계와 실제 업무 전이의 선행 조건을 서버에서 일관되게 계산한다. */
public final class WorkflowRules {
  private WorkflowRules() {}

  /** 기본 질문과 게시된 기관 추가 질문을 신청 시점에 고정한다. */
  public static List<ProcedureData.Answer> initialAnswers(
      DocumentType documentType, OrganizationPolicy policy) {
    List<ProcedureData.Answer> answers = new ArrayList<>();
    answers.add(
        question(
            "purpose",
            "서비스 목적",
            "어떤 업무를 돕는지 알아야 필요한 보안 항목을 정할 수 있습니다.",
            Role.APPLICANT,
            "CONSULT"));
    answers.add(
        question("audience", "이용 대상", "외부 이용자와 내부 직원은 접근 범위가 다릅니다.", Role.APPLICANT, "CONSULT"));
    answers.add(
        question(
            "dataTypes", "처리하는 정보", "개인정보·업무자료 여부를 담당자가 판단하는 근거가 됩니다.", Role.APPLICANT, "SUBMIT"));
    answers.add(
        question(
            "externalTransfer",
            "외부 전송 여부",
            "기관 밖으로 정보를 보내는지 직접 확인해야 합니다.",
            Role.APPLICANT,
            "SUBMIT"));
    answers.add(question("period", "운영 기간", "신청 목적에 필요한 적용 기간을 정합니다.", Role.APPLICANT, "SUBMIT"));
    answers.add(
        question(
            "dataFlow",
            "정보가 이동하는 흐름",
            "사용자부터 처리·보관 위치까지 담당자가 통신 경로를 확인합니다.",
            Role.APPLICANT,
            "SUBMIT"));
    answers.add(
        question(
            "operatingEnvironment",
            "운영 환경",
            "기관의 서버·서비스 구성은 인프라 담당자가 직접 확인합니다.",
            Role.INFRA,
            "SUBMIT"));
    answers.add(
        question(
            "accessControl",
            "접근 통제 방안",
            "누가 어떤 권한으로 접근하는지 보안 담당자가 확인합니다.",
            Role.SECURITY,
            "SUBMIT"));
    String securityRequired = documentType == DocumentType.SECURITY_REVIEW ? "SUBMIT" : "OPTIONAL";
    answers.add(
        question(
            "retention",
            "보관·파기 방안",
            "정보를 언제까지 보관하고 어떻게 파기할지 확인합니다.",
            Role.SECURITY,
            securityRequired));
    answers.add(
        question(
            "logging", "접속 기록 관리", "접근과 변경을 추적할 수 있는지 확인합니다.", Role.SECURITY, securityRequired));
    Set<String> keys = new HashSet<>(answers.stream().map(ProcedureData.Answer::key).toList());
    for (ExtraQuestion extra : policy.questions()) {
      if (!keys.add(extra.key()) || extra.ownerRole().equals("ADMIN")) {
        throw new DomainException(422, "INVALID_QUESTION_POLICY", "기관 질문의 식별자와 담당 역할을 확인해 주세요.");
      }
      answers.add(
          question(
              extra.key(),
              extra.label(),
              extra.reason(),
              Role.valueOf(extra.ownerRole()),
              extra.required() ? "SUBMIT" : "OPTIONAL"));
    }
    return List.copyOf(answers);
  }

  /** AI 제안이나 출처·사람 확인이 빠진 값은 해결된 것으로 취급하지 않는다. */
  public static boolean resolved(ProcedureData.Answer answer) {
    return (answer.status() == ProcedureData.AnswerStatus.CONFIRMED
            || answer.status() == ProcedureData.AnswerStatus.NOT_APPLICABLE)
        && answer.source() != null
        && answer.confirmation() != null
        && !answer.value().isBlank()
        && !(answer.key().equals("externalTransfer") && answer.value().equals("UNKNOWN"));
  }

  /** 협의를 시작하는 데 필요한 최소한의 사업 설명을 확인한다. */
  public static List<String> consultationBlockers(Procedure procedure) {
    return procedure.getData().answers().stream()
        .filter(answer -> answer.requiredAt().equals("CONSULT") && !resolved(answer))
        .map(answer -> answer.label() + ": 신청자의 확인이 필요합니다.")
        .toList();
  }

  /** 필수 정보뿐 아니라 입력해 둔 미확정 선택 정보도 제출 전에 확인한다. */
  public static List<String> submissionBlockers(Procedure procedure) {
    if (procedure.getStatus() == ProcedureStatus.SUBMITTED
        || procedure.getStatus() == ProcedureStatus.RECEIVED) {
      return List.of();
    }
    List<String> blockers = new ArrayList<>();
    if (procedure.getStatus() != ProcedureStatus.COLLABORATING) {
      blockers.add("전문 담당자 협의를 먼저 요청해 주세요.");
    }
    for (ProcedureData.Answer answer : procedure.getData().answers()) {
      if (needsResolution(answer) && !resolved(answer)) {
        blockers.add(answer.label() + ": 값과 출처를 사람이 확인해야 합니다.");
      }
    }
    if (procedure.getDocumentType() == DocumentType.FIREWALL
        && procedure.getData().rules().isEmpty()) {
      blockers.add("인프라 담당자가 통신 규칙을 입력·확인해야 합니다.");
    }
    if (procedure.getData().rules().stream()
        .anyMatch(rule -> rule.source() == null || rule.confirmation() == null)) {
      blockers.add("통신 규칙의 출처 또는 사람 확인이 없습니다.");
    }
    if (procedure.getData().supplements().stream()
        .anyMatch(item -> !item.status().equals("RESOLVED"))) {
      blockers.add("담당자가 해결 확인하지 않은 보완 요청이 있습니다.");
    }
    if (procedure.getPolicy().requireInfra() && !currentReview(procedure, Role.INFRA)) {
      blockers.add("현재 내용 버전에 대한 ICT인프라 검토가 필요합니다.");
    }
    if (procedure.getPolicy().requireSecurity() && !currentReview(procedure, Role.SECURITY)) {
      blockers.add("현재 내용 버전에 대한 정보보안 검토가 필요합니다.");
    }
    return List.copyOf(blockers);
  }

  /** 담당자의 책임 정보·보완 해결·순차 정책을 검토 시점에도 검사한다. */
  public static List<String> reviewBlockers(Procedure procedure, Role role) {
    List<String> blockers = new ArrayList<>();
    if (procedure.getStatus() != ProcedureStatus.COLLABORATING) {
      blockers.add("협의 중인 신청에서 검토할 수 있습니다.");
    }
    for (ProcedureData.Answer answer : procedure.getData().answers()) {
      if ((answer.ownerRole() == role || answer.ownerRole() == Role.APPLICANT)
          && needsResolution(answer)
          && !resolved(answer)) {
        blockers.add(answer.label() + ": 확인이 필요합니다.");
      }
    }
    if (role == Role.INFRA
        && procedure.getDocumentType() == DocumentType.FIREWALL
        && procedure.getData().rules().isEmpty()) {
      blockers.add("통신 규칙을 먼저 입력해 주세요.");
    }
    if (procedure.getData().supplements().stream()
        .anyMatch(item -> !item.status().equals("RESOLVED"))) {
      blockers.add("보완 요청의 답변과 담당자 해결 확인을 마쳐 주세요.");
    }
    if (role == Role.INFRA
        && procedure.getPolicy().reviewMode().equals("SEQUENTIAL")
        && procedure.getPolicy().requireSecurity()
        && !currentReview(procedure, Role.SECURITY)) {
      blockers.add("기관의 순차 검토 설정에 따라 정보보안 검토가 먼저 필요합니다.");
    }
    return List.copyOf(blockers);
  }

  /** 이전 내용에 대한 검토 기록은 남기되 현재 유효한 승인으로 사용하지 않는다. */
  public static List<ProcedureData.Review> invalidateReviews(List<ProcedureData.Review> reviews) {
    return reviews.stream()
        .map(
            review ->
                review.status().equals("COMPLETE")
                    ? new ProcedureData.Review(
                        review.role(),
                        "INVALIDATED",
                        review.revision(),
                        review.comment(),
                        review.actorName(),
                        review.at())
                    : review)
        .toList();
  }

  /** 완료 표시와 검토 내용 버전이 모두 맞아야 현재 검토로 인정한다. */
  public static boolean currentReview(Procedure procedure, Role role) {
    return procedure.getData().reviews().stream()
        .anyMatch(
            review ->
                review.role() == role
                    && review.status().equals("COMPLETE")
                    && review.revision() != null
                    && review.revision() == procedure.getRevision());
  }

  private static boolean needsResolution(ProcedureData.Answer answer) {
    return !answer.requiredAt().equals("OPTIONAL")
        || !answer.value().isBlank()
        || answer.status() != ProcedureData.AnswerStatus.EMPTY;
  }

  private static ProcedureData.Answer question(
      String key, String label, String reason, Role role, String requiredAt) {
    return new ProcedureData.Answer(
        key, label, reason, role, requiredAt, "", ProcedureData.AnswerStatus.EMPTY, null, null);
  }
}
