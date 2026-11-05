package kr.secureflow.prototype;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class WorkspaceServiceTest {
 private final ObjectMapper mapper=new ObjectMapper(); private WorkspaceService service;
 @BeforeEach void setup() throws Exception { service=new WorkspaceService(mapper); }
 @Test void rejectIncompleteReviewWithoutChangingState(){
  var before=service.snapshot(); var c=mapper.createObjectNode().put("type","complete").put("requestId","SF-2026-0123").put("expectedVersion",1).put("role","SECURITY").put("text","검토 완료");
  assertThrows(IllegalArgumentException.class,()->service.execute(c));assertEquals(before,service.snapshot());
 }
 @Test void rejectStaleVersion(){
  var c=mapper.createObjectNode().put("type","note").put("requestId","SF-2026-0123").put("expectedVersion",1).put("role","SECURITY").put("text","메모");
  service.execute(c);assertThrows(WorkspaceService.VersionConflict.class,()->service.execute(c));
 }
 @Test void publishedVersionAffectsOnlyNewRequests(){
  var initial=service.snapshot(); ObjectNode config=(ObjectNode)initial.get("config");
  ((ObjectNode)config.withArray("questions").get(0)).put("title","변경한 질문");
  var save=mapper.createObjectNode().put("type","save-config").put("expectedVersion",1);save.set("config",config);service.execute(save);
  var result=service.execute(mapper.createObjectNode().put("type","publish-config").put("expectedVersion",2));
  assertEquals("v2.4.0",result.path("config").path("version").asText());assertEquals("v2.3.0",result.path("requests").get(0).path("configVersion").asText());
  result=service.execute(mapper.createObjectNode().put("type","create-request").put("title","신규 사업").put("summary","예시 설명"));
  assertEquals("v2.4.0",result.path("requests").get(0).path("configVersion").asText());
 }
}
