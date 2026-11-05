package kr.secureflow.prototype.draft;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class DraftService {
  private final DraftRepository repository;

  public DraftService(DraftRepository repository) {
    this.repository = repository;
  }

  public List<DraftResponse> list() {
    return repository.findTop100ByOrderByCreatedAtDescIdDesc().stream()
        .map(DraftResponse::from)
        .toList();
  }

  public DraftResponse get(long id) {
    return repository.findById(id)
        .map(DraftResponse::from)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "초안을 찾을 수 없습니다."));
  }

  @Transactional
  public DraftResponse create(CreateDraftRequest request) {
    Draft draft = new Draft(request.title().trim(), request.summary().trim());
    return DraftResponse.from(repository.save(draft));
  }
}
