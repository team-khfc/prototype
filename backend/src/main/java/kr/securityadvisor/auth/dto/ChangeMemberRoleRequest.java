package kr.securityadvisor.auth.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import kr.securityadvisor.common.security.Role;

/** 오래된 관리자 화면이 다른 역할 변경을 덮어쓰지 않도록 수정본을 받는다. */
public record ChangeMemberRoleRequest(
    @NotNull Role role,
    @NotNull @Min(0) Long expectedRevision,
    @NotBlank @Size(max = 500) String reason) {}
