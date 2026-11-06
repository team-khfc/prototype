package kr.securityadvisor.request.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.util.List;
import java.util.UUID;
import kr.securityadvisor.common.domain.AnswerValue;
import kr.securityadvisor.common.entity.BaseTimeEntity;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.security.Actor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 공통 정보만 소유하며 진행 상태는 하위 신청에서 계산하는 사업 건이다. */
@Entity
@Table(name = "business_cases")
public class BusinessCase extends BaseTimeEntity {
  @Id private UUID id;

  @Column(name = "institution_id", nullable = false, updatable = false)
  private UUID institutionId;

  @Column(name = "owner_id", nullable = false, updatable = false)
  private UUID ownerId;

  @Column(name = "owner_name", nullable = false, length = 100, updatable = false)
  private String ownerName;

  @Column(nullable = false, length = 160)
  private String title;

  @Column(nullable = false, length = 100)
  private String department;

  @Column(nullable = false, columnDefinition = "text")
  private String description;

  @Column(name = "publication_version", nullable = false, updatable = false)
  private long publicationVersion;

  @Column(nullable = false)
  private long revision;

  @Version
  @Column(name = "lock_version", nullable = false)
  private long lockVersion;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<AnswerValue> answers;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, updatable = false, columnDefinition = "jsonb")
  private CasePolicy policy;

  protected BusinessCase() {}

  /** 생성 시점의 작성자·기관·게시본을 고정한다. */
  public BusinessCase(
      UUID id,
      Actor actor,
      String title,
      String department,
      String description,
      long publicationVersion) {
    this.id = id;
    institutionId = actor.institutionId();
    ownerId = actor.userId();
    ownerName = actor.displayName();
    this.title = AnswerValue.clean(title, 160);
    this.department = AnswerValue.clean(department, 100);
    this.description = AnswerValue.clean(description, 20000);
    if (this.title.isBlank() || this.department.isBlank()) {
      throw new DomainException(422, "CASE_DETAILS_REQUIRED", "사업명과 부서를 입력해 주세요.");
    }
    this.publicationVersion = publicationVersion;
    answers = SeedQuestions.common();
    policy = CasePolicy.seed();
  }

  /** 오래된 입력으로 다른 사람의 변경을 덮어쓰지 않는다. */
  public void requireRevision(long expected) {
    if (expected != revision)
      throw new DomainException(
          409, "REVISION_CONFLICT", "공통 정보가 변경되었습니다. 최신 내용을 비교해 주세요.", revision);
  }

  /** 서버가 검증한 같은 질문 집합의 값만 불변 목록으로 교체한다. */
  public void answer(List<AnswerValue> next) {
    if (answers.size() != next.size()
        || java.util.stream.IntStream.range(0, answers.size())
            .anyMatch(index -> !answers.get(index).sameDefinition(next.get(index)))) {
      throw new DomainException(422, "QUESTION_SCHEMA_CHANGED", "게시된 질문 구조는 바꿀 수 없습니다.");
    }
    answers = List.copyOf(next);
    revision++;
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

  public String getDepartment() {
    return department;
  }

  public String getDescription() {
    return description;
  }

  public long getPublicationVersion() {
    return publicationVersion;
  }

  public long getRevision() {
    return revision;
  }

  public List<AnswerValue> getAnswers() {
    return List.copyOf(answers);
  }

  public CasePolicy getPolicy() {
    return policy;
  }
}
