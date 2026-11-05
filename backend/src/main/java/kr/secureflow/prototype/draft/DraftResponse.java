package kr.secureflow.prototype.draft;

import java.time.Instant;

public record DraftResponse(Long id, String title, String summary, Instant createdAt) {
  static DraftResponse from(Draft draft) {
    return new DraftResponse(
        draft.getId(), draft.getTitle(), draft.getSummary(), draft.getCreatedAt());
  }
}
