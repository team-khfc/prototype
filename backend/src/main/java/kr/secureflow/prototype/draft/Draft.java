package kr.secureflow.prototype.draft;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Minimal persistence example; not the consultation workflow aggregate. */
@Entity
@Table(name = "development_drafts")
public class Draft {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 120)
  private String title;

  @Column(nullable = false, length = 4000)
  private String summary;

  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  protected Draft() {}

  Draft(String title, String summary) {
    this.title = title;
    this.summary = summary;
    this.createdAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public String getTitle() {
    return title;
  }

  public String getSummary() {
    return summary;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
