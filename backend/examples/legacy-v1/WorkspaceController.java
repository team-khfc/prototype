package kr.secureflow.prototype;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
/** Local synthetic-data demo only. The role in a command is NOT authentication. */
@Profile("demo")
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
public class WorkspaceController {
 private final WorkspaceService service;
 public WorkspaceController(WorkspaceService service) { this.service = service; }
 @GetMapping("/health") public java.util.Map<String, String> health() {
  return java.util.Map.of("status", "UP", "application", "secureflow-prototype-api", "mode", "demo-v1");
 }
 @GetMapping("/workspace") public JsonNode workspace() { return service.snapshot(); }
 @PostMapping("/commands") public JsonNode command(@RequestBody JsonNode command) { return service.execute(command); }
}
