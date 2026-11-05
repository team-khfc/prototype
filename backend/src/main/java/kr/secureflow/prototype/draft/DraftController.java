package kr.secureflow.prototype.draft;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Local development API. Authentication and full workflow integration are future work. */
@RestController
@RequestMapping("/api/v1/drafts")
public class DraftController {
  private final DraftService service;

  public DraftController(DraftService service) {
    this.service = service;
  }

  @GetMapping
  public List<DraftResponse> list() {
    return service.list();
  }

  @GetMapping("/{id}")
  public DraftResponse get(@PathVariable long id) {
    return service.get(id);
  }

  @PostMapping
  public ResponseEntity<DraftResponse> create(@Valid @RequestBody CreateDraftRequest request) {
    DraftResponse draft = service.create(request);
    return ResponseEntity.created(URI.create("/api/v1/drafts/" + draft.id())).body(draft);
  }
}
