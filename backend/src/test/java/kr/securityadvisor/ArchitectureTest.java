package kr.securityadvisor;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ArchitectureTest {
  @Test
  @DisplayName("컨트롤러는 저장소와 엔티티에 직접 의존하지 않는다")
  void keepControllerBoundary() {
    noClasses()
        .that()
        .resideInAPackage("..controller..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage("..repository..", "..domain..")
        .check(classes());
  }

  @Test
  @DisplayName("도메인은 서비스와 전송 계층을 알지 않는다")
  void keepDomainBoundary() {
    noClasses()
        .that()
        .resideInAPackage("..domain..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage("..controller..", "..service..", "..dto..", "..repository..")
        .check(classes());
  }

  @Test
  @DisplayName("업무 도메인은 Spring Web과 Spring AI 타입에 의존하지 않는다")
  void keepDomainIndependentOfWebAndAi() {
    noClasses()
        .that()
        .resideInAPackage("..domain..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage("org.springframework.web..", "org.springframework.ai..")
        .check(classes());
  }

  @Test
  @DisplayName("기능 패키지끼리 순환 참조가 없다")
  void keepFeatureBoundary() {
    slices().matching("kr.securityadvisor.(*)..").should().beFreeOfCycles().check(classes());
  }

  @Test
  @DisplayName("실행 클래스는 폐기한 예제 컨텍스트를 다시 포함하지 않는다")
  void keepFreshApplicationBoundary() {
    noClasses()
        .should()
        .resideInAnyPackage(
            "kr.securityadvisor.procedure..",
            "kr.securityadvisor.analysis..",
            "kr.securityadvisor.institution..")
        .check(classes());
  }

  private com.tngtech.archunit.core.domain.JavaClasses classes() {
    return new ClassFileImporter()
        .withImportOption(new ImportOption.DoNotIncludeTests())
        .importPackages("kr.securityadvisor");
  }
}
