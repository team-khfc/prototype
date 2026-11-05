# syntax=docker/dockerfile:1
FROM eclipse-temurin:21-jdk AS build
WORKDIR /build
COPY gradlew gradlew.bat build.gradle settings.gradle gradle.properties ./
COPY gradle ./gradle
RUN chmod +x gradlew
COPY src ./src
COPY docker ./docker
RUN ./gradlew --no-daemon test bootJar && \
    mkdir -p /healthcheck && javac -d /healthcheck docker/HealthCheck.java

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
ENV SERVER_ADDRESS=0.0.0.0 \
    SERVER_PORT=8080 \
    SPRING_PROFILES_ACTIVE=container
COPY --from=build /build/build/libs/secureflow-api.jar /app/app.jar
COPY --from=build /healthcheck /app/healthcheck
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=8 \
  CMD ["java", "-cp", "/app/healthcheck", "HealthCheck", "http://127.0.0.1:8080/actuator/health"]
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
