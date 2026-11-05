package kr.secureflow.prototype;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import java.util.UUID;

/** In-memory adapter for UI integration. Production storage and authorization are separate work. */
@Service @Profile("demo")
public class WorkspaceService {
 private ObjectNode state;
 public WorkspaceService(ObjectMapper mapper) throws IOException {
  try (var stream = new ClassPathResource("demo-workspace.json").getInputStream()) {
   state = (ObjectNode) mapper.readTree(stream);
  }
 }
 public synchronized ObjectNode snapshot() { return state.deepCopy(); }
 public synchronized ObjectNode execute(JsonNode command) {
  String type = required(command, "type");
  ObjectNode next = state.deepCopy();
  switch (type) {
   case "create-request" -> create(next, command);
   case "save-config", "publish-config" -> config(next, command, type);
   case "note", "supplement", "complete", "save-review" -> review(next, command, type);
   default -> throw new IllegalArgumentException("지원하지 않는 명령입니다.");
  }
  state = next;
  return snapshot();
 }
 private void create(ObjectNode next, JsonNode c) {
  String title = required(c, "title"), summary = required(c, "summary");
  ArrayNode requests = (ArrayNode) next.get("requests");
  int max = 0;
  for (JsonNode r:requests) max = Math.max(max, Integer.parseInt(r.path("id").asText().split("-")[2]));
  ObjectNode r = requests.isEmpty() ? next.objectNode() : ((ObjectNode) requests.get(0)).deepCopy();
  r.put("id", "SF-2026-" + String.format("%04d", max+1)); r.put("title", title); r.put("summary", summary);
  r.put("applicant", "이민주"); r.put("department", c.path("department").asText("디지털혁신부"));
  r.put("type", "신규 구축"); r.put("status", "접수 대기"); r.put("assignee", "SECURITY"); r.put("due", "2026-11-13");
  r.put("priority", "보통"); r.put("updatedAt", time()); r.put("rowVersion", 1); r.put("opinion", "");
  r.put("configVersion", next.path("config").path("version").asText()); r.putObject("checks"); r.putArray("notes"); requests.insert(0,r);
 }
 private void config(ObjectNode next, JsonNode c, String type) {
  ObjectNode old = (ObjectNode) next.get("config");
  version(old,c);
  if (type.equals("save-config")) {
   JsonNode incoming = c.path("config");
   validateQuestions(incoming.path("questions"));
   String workflow = required(incoming,"workflow");
   if (!Set.of("순차 검토","병렬 검토").contains(workflow)) throw new IllegalArgumentException("검토 방식을 확인해 주세요.");
   old.set("questions", incoming.path("questions").deepCopy()); old.put("workflow", workflow); old.put("dirty",true);
  } else {
   if (!old.path("dirty").asBoolean()) throw new IllegalArgumentException("변경한 초안을 먼저 저장해 주세요.");
   validateQuestions(old.get("questions"));
   old.set("publishedQuestions", old.get("questions").deepCopy()); old.put("publishedWorkflow",old.path("workflow").asText());
   String published = old.path("draftVersion").asText(); old.put("version", published);
   String[] parts = published.substring(1).split("\\."); old.put("draftVersion", "v"+parts[0]+"."+(Integer.parseInt(parts[1])+1)+".0"); old.put("dirty",false);
  }
  old.put("rowVersion", old.path("rowVersion").asInt()+1);
 }
 private void validateQuestions(JsonNode questions) {
  if (!questions.isArray() || questions.isEmpty()) throw new IllegalArgumentException("하나 이상의 질문이 필요합니다.");
  var keys = new java.util.HashSet<String>();
  for (JsonNode q:questions) { required(q,"title"); if(!keys.add(required(q,"key"))) throw new IllegalArgumentException("항목 키는 중복될 수 없습니다."); }
 }
 private void review(ObjectNode next, JsonNode c, String type) {
  String id=required(c,"requestId"), role=required(c,"role");
  if (!Set.of("SECURITY","INFRA","ADMIN").contains(role)) throw new IllegalArgumentException("담당자 역할에서 검토할 수 있습니다.");
  ObjectNode r=null;
  for(JsonNode item:next.path("requests")) if(item.path("id").asText().equals(id)) {r=(ObjectNode)item;break;}
  if(r==null)throw new IllegalArgumentException("신청을 찾을 수 없습니다.");
  version(r,c);
  if(r.path("status").asText().equals("협의 완료")&&!type.equals("note"))throw new IllegalArgumentException("완료된 협의는 수정할 수 없습니다.");
  String text=type.equals("save-review")?c.path("text").asText(""):required(c,"text");
  if(type.equals("complete")) for(int i=0;i<3;i++)if(!c.path("checks").path((role.equals("INFRA")?"INFRA":"SECURITY")+"-"+i).asBoolean())throw new IllegalArgumentException("담당 검토 항목 3개를 모두 확인해 주세요.");
  if(c.path("checks").isObject())((ObjectNode)r.get("checks")).setAll((ObjectNode)c.get("checks"));
  if(type.equals("save-review")||type.equals("complete"))r.put("opinion",text);
  if(type.equals("complete"))r.put("status","협의 완료");
  if(type.equals("supplement"))r.put("status","보완 대기");
  if(type.equals("save-review")&&r.path("status").asText().equals("접수 대기"))r.put("status","검토 중");
  ObjectNode note=next.objectNode();note.put("id",UUID.randomUUID().toString());note.put("time",time());
  note.put("author",role.equals("INFRA")?"윤인프라":role.equals("ADMIN")?"박관리":"김보안");
  note.put("role",role.equals("INFRA")?"ICT인프라 담당자":role.equals("ADMIN")?"기관 관리자":"정보보안 담당자");
  note.put("type",type.equals("note")?"note":type.equals("supplement")?"supplement":"event");
  note.put("text",switch(type){case "complete"->"사전 협의 완료 · "+text;case "supplement"->"["+c.path("field").asText("전체")+"] "+text;case "save-review"->"검토 내용을 임시 저장했습니다.";default->text;});
  ((ArrayNode)r.get("notes")).insert(0,note);r.put("rowVersion",r.path("rowVersion").asInt()+1);r.put("updatedAt",time());
 }
 private static void version(JsonNode entity, JsonNode command) { if(!command.has("expectedVersion")||command.path("expectedVersion").asInt()!=entity.path("rowVersion").asInt()) throw new VersionConflict("다른 화면에서 변경되었습니다. 새로고침 후 다시 확인해 주세요."); }
 private static String required(JsonNode n,String key) { String value=n.path(key).asText("").trim();if(value.isEmpty())throw new IllegalArgumentException(key+" 값을 입력해 주세요.");return value; }
 private static String time() { return ZonedDateTime.now(ZoneId.of("Asia/Seoul")).format(DateTimeFormatter.ofPattern("MM. dd. HH:mm")); }
 public static class VersionConflict extends RuntimeException { public VersionConflict(String message){super(message);} }
}
