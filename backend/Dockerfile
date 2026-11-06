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
    && groupadd --system boan && useradd --system --gid boan boan \
    && mkdir -p /var/lib/boan/uploads && chown -R boan:boan /var/lib/boan
WORKDIR /app
COPY --from=build /app/build/libs/security-advisor.jar ./app.jar
USER boan
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

