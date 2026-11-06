package kr.boan.procedure.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.util.UUID;
import kr.boan.common.entity.BaseTimeEntity;
import kr.boan.common.model.OrganizationPolicy;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 행 잠금과 자료 버전을 함께 사용하여 동시에 확인한 문서가 섞이지 않도록 한다. */
@Entity
@Table(name = "procedures")
public class Procedure extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(name = "owner_id", nullable = false, updatable = false)
  private UUID ownerId;

  @Column(name = "owner_name", nullable = false, length = 100, updatable = false)
  private String ownerName;

  @Column(nullable = false, length = 160)
  private String title;

  @Enumerated(EnumType.STRING)
  @Column(name = "document_type", nullable = false, length = 32)
  private DocumentType documentType;

  @Column(nullable = false, length = 100)
  private String department;

  @Column(nullable = false, columnDefinition = "text")
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private ProcedureStatus status;

  @Column(nullable = false)
  private long revision;

  @Version
  @Column(name = "lock_version", nullable = false)
  private long lockVersion;

  @Column(name = "policy_version", nullable = false, updatable = false)
  private long policyVersion;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb", updatable = false)
  private OrganizationPolicy policy;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private ProcedureData data;

  protected Procedure() {}

  /** 새 신청은 게시된 정책의 복사본과 작성자 소유권을 함께 갖는다. */
  public Procedure(
      UUID id,
      UUID institutionId,
      UUID ownerId,
      String ownerName,
      String title,
      DocumentType documentType,
      String department,
      String description,
      long policyVersion,
      OrganizationPolicy policy,
      ProcedureData data) {
    this.id = id;
    this.institutionId = institutionId;
    this.ownerId = ownerId;
    this.ownerName = ownerName;
    this.title = title;
    this.documentType = documentType;
    this.department = department;
    this.description = description;
    this.policyVersion = policyVersion;
    this.policy = policy;
    this.data = data;
    this.status = ProcedureStatus.DRAFT;
  }

  /** 중요한 내용 변경은 별도 자료 버전을 증가시킨다. */
  public void replaceContent(ProcedureData nextData) {
    data = nextData;
    revision++;
  }

  /** 검토·접수 이력은 검토 대상의 내용 버전을 변경하지 않는다. */
  public void recordProgress(ProcedureData nextData) {
    data = nextData;
  }

  /** 협의 상태 전환은 내용과 함께 저장하되 서비스가 선행 조건을 판단한다. */
  public void openConsultation(ProcedureData nextData) {
    status = ProcedureStatus.COLLABORATING;
    replaceContent(nextData);
  }

  /** 제출 이후에는 내용 편집을 서비스에서 차단하고 별도 제출본을 참조한다. */
  public void markSubmitted(ProcedureData nextData) {
    status = ProcedureStatus.SUBMITTED;
    data = nextData;
  }

  /** 접수는 실제 장비 적용이나 보안 적합 판정과 구분된다. */
  public void markReceived(ProcedureData nextData) {
    status = ProcedureStatus.RECEIVED;
    data = nextData;
  }

  public UUID getId() {
    return id;
  }

  public UUID getInstitutionId() {
    return institutionId;
  }

  public UUID getOwnerId() {
    return ownerId;
  }

  public String getOwnerName() {
    return ownerName;
  }

  public String getTitle() {
    return title;
  }

  public DocumentType getDocumentType() {
    return documentType;
  }

  public String getDepartment() {
    return department;
  }

  public String getDescription() {
    return description;
  }

  public ProcedureStatus getStatus() {
    return status;
  }

  public long getRevision() {
    return revision;
  }

  public long getPolicyVersion() {
    return policyVersion;
  }

  public OrganizationPolicy getPolicy() {
    return policy;
  }

  public ProcedureData getData() {
    return data;
  }
}
