package kr.securityadvisor.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 가입 요청의 역할·기관 주장은 읽지 않아 일반 사용자 권한 상승을 막는다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SignupRequest(
    @NotBlank @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9._-]{3,39}") String username,
    @NotBlank @Size(min = 12, max = 72) String password,
    @NotBlank @Size(max = 100) String displayName,
    @Size(max = 100) String department) {}
