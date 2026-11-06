package kr.boan.procedure.domain;

import java.time.Instant;
import java.util.UUID;
import kr.boan.common.model.OrganizationPolicy;

/** 제출 당시 자료와 정책을 보존하여 현재 신청 이력의 변경과 분리한다. */
public record SubmissionSnapshot(
    UUID procedureId,
    String title,
    DocumentType documentType,
    String department,
    String description,
    String ownerName,
    long revision,
    long policyVersion,
    OrganizationPolicy policy,
    ProcedureData data,
    Instant submittedAt) {}
