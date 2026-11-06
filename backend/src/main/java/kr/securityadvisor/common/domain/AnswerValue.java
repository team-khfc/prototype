package kr.securityadvisor.common.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import kr.securityadvisor.common.security.Role;

/** 값의 원출처와 사람이 확인한 기록을 분리한 불변 답변이다. */
public record AnswerValue(
    String key,
    String label,
    Scope scope,
    Role ownerRole,
    boolean required,
    String value,
    Source source,
    String evidence,
    boolean confirmed,
    boolean notApplicable,
    Confirmation confirmation) {

  public enum Scope {
    CASE,
    REQUEST
  }

  public enum Source {
    USER_ANSWER,
    AI_INFERRED,
    STAFF_INPUT,
    STAFF_CONFIRMED
  }

  public record Confirmation(UUID actorId, String actorName, Role role, Instant at) {}

  /** 미입력은 출처를 지어내지 않고 담당자 확인 필요로 남긴다. */
  public static AnswerValue empty(
      String key, String label, Scope scope, Role owner, boolean required) {
    return new AnswerValue(key, label, scope, owner, required, "", null, "", false, false, null);
  }

  /** 담당 역할의 명시적인 입력·확인만 받아 새 답변 값을 만든다. */
  public AnswerValue answer(Actor actor, String nextValue, boolean confirm, boolean inapplicable) {
    String next = clean(nextValue, 4000);
    boolean same = Objects.equals(value, next) && notApplicable == inapplicable;
    boolean staffConfirmation =
        same
            && confirm
            && source == Source.AI_INFERRED
            && (actor.role() == Role.INFRA || actor.role() == Role.SECURITY);
    if (actor.role() != ownerRole && !staffConfirmation) {
      throw new DomainException(403, "FIELD_OWNER_REQUIRED", "해당 항목 담당 역할만 입력·확인할 수 있습니다.");
    }
    if ((confirm || inapplicable) && next.isBlank()) {
      throw new DomainException(422, "EMPTY_CONFIRMATION", "확인하거나 미해당으로 표시할 이유를 입력해 주세요.");
    }
    if (same && confirmed && confirm && !staffConfirmation) return this;
    Source nextSource =
        same && source != null
            ? source
            : actor.role() == Role.APPLICANT ? Source.USER_ANSWER : Source.STAFF_INPUT;
    if (!confirm && nextSource == Source.STAFF_CONFIRMED) {
      nextSource = actor.role() == Role.APPLICANT ? Source.USER_ANSWER : Source.STAFF_INPUT;
    }
    if (same && confirm && source == Source.AI_INFERRED && actor.role() != Role.APPLICANT) {
      nextSource = Source.STAFF_CONFIRMED;
    }
    Confirmation checked =
        confirm
            ? new Confirmation(actor.userId(), actor.displayName(), actor.role(), Instant.now())
            : null;
    return new AnswerValue(
        key,
        label,
        scope,
        ownerRole,
        required,
        next,
        nextSource,
        same ? evidence : "",
        confirm,
        inapplicable,
        checked);
  }

  /** AI는 사용자 설명 항목에 근거 있는 미확정 후보만 만들 수 있다. */
  public AnswerValue propose(String proposed, String reference) {
    if (ownerRole != Role.APPLICANT || scope != Scope.CASE) {
      throw new DomainException(422, "AI_FIELD_FORBIDDEN", "기관 내부 사실은 AI가 추정할 수 없습니다.");
    }
    if (confirmed) {
      throw new DomainException(409, "CONFIRMED_VALUE_PROTECTED", "사람이 확인한 값을 AI 후보로 덮어쓸 수 없습니다.");
    }
    String next = clean(proposed, 4000);
    String proof = clean(reference, 1000);
    if (next.isBlank() || proof.isBlank()) {
      throw new DomainException(422, "AI_EVIDENCE_REQUIRED", "AI 후보에는 값과 원문 근거가 필요합니다.");
    }
    return new AnswerValue(
        key,
        label,
        scope,
        ownerRole,
        required,
        next,
        Source.AI_INFERRED,
        proof,
        false,
        false,
        null);
  }

  /** 필수 항목과 실제 입력된 선택 항목은 사람의 확인이 필요하다. */
  public boolean ready() {
    return !required && value.isBlank()
        || !value.isBlank() && source != null && confirmed && confirmation != null;
  }

  /** 확인 시각만 바뀐 경우에는 이미 끝난 협의를 다시 무효화하지 않는다. */
  public boolean contentDiffers(AnswerValue other) {
    return !Objects.equals(value, other.value) || notApplicable != other.notApplicable;
  }

  /** 값 변경 명령으로 질문 책임·필수 여부·범위를 바꿀 수 없다. */
  public boolean sameDefinition(AnswerValue other) {
    return Objects.equals(key, other.key)
        && Objects.equals(label, other.label)
        && scope == other.scope
        && ownerRole == other.ownerRole
        && required == other.required;
  }

  /** 텍스트 길이를 제한하고 제어문자를 서버 경계에서 거부한다. */
  public static String clean(String input, int max) {
    String value = input == null ? "" : input.strip();
    if (value.length() > max
        || value
            .chars()
            .anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) {
      throw new DomainException(422, "INVALID_TEXT", "입력 길이와 문자를 확인해 주세요.");
    }
    return value;
  }
}
