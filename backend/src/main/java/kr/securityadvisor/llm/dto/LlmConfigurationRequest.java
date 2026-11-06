package kr.securityadvisor.llm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import kr.securityadvisor.common.model.ModelConnection;

/** 구성 입력에는 키 원문 필드가 없다. 공급자별 허용 이름만 서버에서 해석한다. */
public record LlmConfigurationRequest(
    @NotNull ModelConnection connection,
    @NotBlank @Pattern(regexp = "INTERVIEW|SUMMARY|DOCUMENT") String purpose,
    @NotBlank @Size(max = 500) String reason) {}
