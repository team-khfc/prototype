package kr.secureflow.prototype.common;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ProblemDetail> validation(MethodArgumentNotValidException exception) {
    Map<String, String> errors = new LinkedHashMap<>();
    exception.getBindingResult().getFieldErrors().forEach(
        error -> errors.putIfAbsent(error.getField(), error.getDefaultMessage()));
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
        HttpStatus.BAD_REQUEST, "입력값을 확인해 주세요.");
    problem.setProperty("errors", errors);
    return ResponseEntity.badRequest().body(problem);
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ProblemDetail> malformedJson() {
    return ResponseEntity.badRequest().body(
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "JSON 요청 형식을 확인해 주세요."));
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ProblemDetail> status(ResponseStatusException exception) {
    return ResponseEntity.status(exception.getStatusCode()).body(
        ProblemDetail.forStatusAndDetail(exception.getStatusCode(), exception.getReason()));
  }
}
