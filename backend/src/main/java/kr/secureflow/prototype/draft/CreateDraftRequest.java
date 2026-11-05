package kr.secureflow.prototype.draft;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateDraftRequest(
    @NotBlank(message = "사업명을 입력해 주세요.")
        @Size(max = 120, message = "사업명은 120자 이내로 입력해 주세요.")
        String title,
    @NotBlank(message = "사업 개요를 입력해 주세요.")
        @Size(max = 4000, message = "사업 개요는 4,000자 이내로 입력해 주세요.")
        String summary) {}
