package kr.securityadvisor.assignment.controller;

import java.util.List;
import kr.securityadvisor.assignment.dto.AssignmentResponses.ReviewerPoolResponse;
import kr.securityadvisor.assignment.service.AssignmentOperations;
import kr.securityadvisor.common.security.Actor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 기관 관리자의 배정 후보 조회만 제공한다. */
@RestController
public class ReviewerPoolController {
  private final AssignmentOperations assignments;

  public ReviewerPoolController(AssignmentOperations assignments) {
    this.assignments = assignments;
  }

  @GetMapping("/api/reviewer-pools")
  public List<ReviewerPoolResponse> list(@AuthenticationPrincipal Actor actor) {
    return assignments.reviewers(actor);
  }
}
