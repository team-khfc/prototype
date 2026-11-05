package kr.secureflow.prototype;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice
public class ApiExceptionHandler {
 @ExceptionHandler(IllegalArgumentException.class)
 public ResponseEntity<Map<String,String>> badRequest(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}
 @ExceptionHandler(WorkspaceService.VersionConflict.class)
 public ResponseEntity<Map<String,String>> conflict(WorkspaceService.VersionConflict e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}
}
