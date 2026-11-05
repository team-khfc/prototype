package kr.secureflow.prototype.draft;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DraftRepository extends JpaRepository<Draft, Long> {
  List<Draft> findTop100ByOrderByCreatedAtDescIdDesc();
}
