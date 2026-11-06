FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
RUN chmod +x gradlew
COPY src ./src
RUN ./gradlew --no-daemon bootJar

FROM eclipse-temurin:25-jre
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system securityadvisor && useradd --system --gid securityadvisor securityadvisor \
    && mkdir -p /var/lib/securityadvisor/uploads && chown -R securityadvisor:securityadvisor /var/lib/securityadvisor
WORKDIR /app
COPY --from=build /app/build/libs/security-advisor.jar ./app.jar
USER securityadvisor
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

