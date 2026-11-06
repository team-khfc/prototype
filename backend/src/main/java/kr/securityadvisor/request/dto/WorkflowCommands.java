package kr.securityadvisor.request.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/** 단계 변경을 임의의 상태 패치로 받지 않고 업무별 명령으로 검증한다. */
public final class WorkflowCommands {
  private WorkflowCommands() {}

  public record CreateCase(
      @NotBlank @Size(max = 160) String title,
      @NotBlank @Size(max = 100) String department,
      @Size(max = 20000) String description,
      @NotEmpty @Size(max = 2) List<@NotBlank String> docTypes) {}

  public record Revision(@NotNull @PositiveOrZero Long expectedRevision) {}

  public record AnswerInput(
      @NotBlank @Size(max = 80) String key,
      @NotNull @Size(max = 4000) String value,
      boolean confirmed,
      boolean notApplicable) {}

  public record AnswerPatch(
      @NotNull @PositiveOrZero Long expectedRevision,
      @NotEmpty @Size(max = 40) List<@Valid AnswerInput> answers) {}

  public record CompleteReview(
      @NotNull @PositiveOrZero Long expectedRevision, @NotBlank @Size(max = 1000) String comment) {}

  public record Supplement(
      @NotNull @PositiveOrZero Long expectedRevision,
      @NotEmpty @Size(max = 40) List<@NotBlank String> fieldKeys,
      @NotBlank @Size(max = 1000) String reason) {}

  public record SupplementAnswer(
      @NotNull @PositiveOrZero Long expectedRevision, @NotBlank @Size(max = 4000) String answer) {}

  public record StageReturn(
      @NotNull @PositiveOrZero Long expectedRevision,
      @Min(1) @Max(3) int targetStage,
      @NotEmpty @Size(max = 40) List<@NotBlank String> fieldKeys,
      @NotBlank @Size(max = 1000) String reason) {}

  public record Reason(
      @NotNull @PositiveOrZero Long expectedRevision, @NotBlank @Size(max = 1000) String reason) {}

  public record Reassign(
      @NotNull @PositiveOrZero Long expectedRevision,
      @NotNull UUID assigneeId,
      @NotBlank @Size(max = 1000) String reason) {}
}
