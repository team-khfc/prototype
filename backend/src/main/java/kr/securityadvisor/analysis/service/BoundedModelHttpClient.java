package kr.securityadvisor.analysis.service;

import jakarta.annotation.PreDestroy;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import kr.securityadvisor.common.error.DomainException;
import kr.securityadvisor.common.model.ModelConnection;
import kr.securityadvisor.institution.service.ModelConfigurationValidator;
import org.springframework.stereotype.Component;

/** 허용 주소·전체 응답 시간·수신 바이트를 제한하며 리다이렉트와 자동 재시도를 하지 않는다. */
@Component
public class BoundedModelHttpClient {
  static final int MAX_RESPONSE_BYTES = 512 * 1024;
  private final ModelConfigurationValidator configurations;
  private final PublicAddressPolicy addresses;
  private final HttpClient client;

  public BoundedModelHttpClient(
      ModelConfigurationValidator configurations, PublicAddressPolicy addresses) {
    this.configurations = configurations;
    this.addresses = addresses;
    client =
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
  }

  /**
   * 키·외부 오류 본문을 예외에 포함하지 않고 정상 JSON 응답의 바이트만 돌려준다.
   *
   * @throws DomainException 주소·HTTP 응답·시간·응답 크기 검증이 실패했을 때
   */
  public byte[] post(ModelConnection connection, String key, byte[] payload) {
    configurations.validate(connection);
    if ("EXAMPLE".equals(connection.provider()) || payload.length > 256 * 1024) {
      throw new DomainException(422, "MODEL_REQUEST_REJECTED", "모델 요청 구성을 확인해 주세요.");
    }
    URI endpoint = URI.create(connection.endpoint());
    addresses.verify(endpoint.getHost());
    String header = "OPENAI".equals(connection.provider()) ? "Authorization" : "x-goog-api-key";
    String authorization = "OPENAI".equals(connection.provider()) ? "Bearer " + key : key;
    HttpRequest request =
        HttpRequest.newBuilder(endpoint)
            .timeout(Duration.ofSeconds(connection.timeoutSeconds()))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header(header, authorization)
            .POST(HttpRequest.BodyPublishers.ofByteArray(payload))
            .build();
    CompletableFuture<HttpResponse<byte[]>> response =
        client.sendAsync(request, information -> new LimitedBodySubscriber(MAX_RESPONSE_BYTES));
    try {
      HttpResponse<byte[]> received = response.get(connection.timeoutSeconds(), TimeUnit.SECONDS);
      if (received.statusCode() != 200) {
        throw new DomainException(
            502, "MODEL_UPSTREAM_FAILURE", "모델 서비스가 분석을 완료하지 못했습니다. 연결 설정을 확인하거나 다시 시도해 주세요.");
      }
      String contentType = received.headers().firstValue("Content-Type").orElse("");
      if (!contentType.toLowerCase(java.util.Locale.ROOT).startsWith("application/json")) {
        throw new DomainException(502, "MODEL_RESPONSE_TYPE", "모델 서비스가 지원하지 않는 응답 형식을 반환했습니다.");
      }
      return received.body();
    } catch (TimeoutException exception) {
      response.cancel(true);
      throw new DomainException(504, "MODEL_TIMEOUT", "분석 제한 시간을 초과했습니다. 입력을 줄이거나 다시 시도해 주세요.");
    } catch (InterruptedException exception) {
      response.cancel(true);
      Thread.currentThread().interrupt();
      throw new DomainException(503, "MODEL_INTERRUPTED", "분석 요청이 중단되었습니다. 다시 시도해 주세요.");
    } catch (ExecutionException exception) {
      response.cancel(true);
      throw new DomainException(
          502, "MODEL_TRANSPORT_FAILURE", "모델 응답을 안전하게 수신하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  /** 애플리케이션 종료 시 진행 중인 외부 전송을 종료한다. */
  @PreDestroy
  public void shutdown() {
    client.shutdownNow();
  }

  static final class LimitedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
    private final int limit;
    private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    private final CompletableFuture<byte[]> result = new CompletableFuture<>();
    private Flow.Subscription subscription;

    LimitedBodySubscriber(int limit) {
      this.limit = limit;
    }

    @Override
    public CompletionStage<byte[]> getBody() {
      return result;
    }

    @Override
    public void onSubscribe(Flow.Subscription subscription) {
      if (this.subscription != null) {
        subscription.cancel();
        return;
      }
      this.subscription = subscription;
      subscription.request(1);
    }

    @Override
    public void onNext(List<ByteBuffer> buffers) {
      if (result.isDone()) {
        return;
      }
      for (ByteBuffer buffer : buffers) {
        if (buffer.remaining() > limit - bytes.size()) {
          subscription.cancel();
          result.completeExceptionally(new IllegalStateException("Response size limit"));
          return;
        }
        byte[] chunk = new byte[buffer.remaining()];
        buffer.get(chunk);
        bytes.writeBytes(chunk);
      }
      subscription.request(1);
    }

    @Override
    public void onError(Throwable throwable) {
      result.completeExceptionally(new IllegalStateException("Response unavailable"));
    }

    @Override
    public void onComplete() {
      result.complete(bytes.toByteArray());
    }
  }
}
