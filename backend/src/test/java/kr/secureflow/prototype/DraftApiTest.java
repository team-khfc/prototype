package kr.secureflow.prototype;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.secureflow.prototype.draft.DraftRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DraftApiTest {
  @Autowired private MockMvc mvc;
  @Autowired private DraftRepository repository;
  @Autowired private ObjectMapper mapper;

  @BeforeEach
  void clean() {
    repository.deleteAll();
  }

  @Test
  void createPersistsToH2AndCanBeReadInAnotherRequest() throws Exception {
    String body = mvc.perform(post("/api/v1/drafts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"title":"  개발용 사업  ","summary":"합성 예제"}
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.title").value("개발용 사업"))
        .andReturn().getResponse().getContentAsString();
    long id = mapper.readTree(body).path("id").asLong();
    assertThat(repository.findById(id)).isPresent();
    mvc.perform(get("/api/v1/drafts/" + id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.summary").value("합성 예제"));
    mvc.perform(get("/api/v1/drafts"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(id));
  }

  @Test
  void blankTitleIsRejectedWithoutPersistence() throws Exception {
    mvc.perform(post("/api/v1/drafts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"title":"  ","summary":"합성 예제"}
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors.title").exists());
    assertThat(repository.count()).isZero();
  }

  @Test
  void malformedJsonIsRejected() throws Exception {
    mvc.perform(post("/api/v1/drafts").contentType(MediaType.APPLICATION_JSON).content("{"))
        .andExpect(status().isBadRequest());
    assertThat(repository.count()).isZero();
  }

  @Test
  void missingDraftIs404() throws Exception {
    mvc.perform(get("/api/v1/drafts/999999"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.detail").value("초안을 찾을 수 없습니다."));
  }

  @Test
  void h2HealthIsUp() throws Exception {
    mvc.perform(get("/actuator/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"));
  }
}
