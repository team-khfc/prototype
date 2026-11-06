package kr.securityadvisor;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AnalysisBoundaryTest {
  @Test
  @DisplayName("분석 기능은 기관 비공개 참고 자료 서비스·저장소·도메인에 접근하지 않는다")
  void keepPrivateContextOutsideModelPath() {
    var classes =
        new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests())
            .importPackages("kr.securityadvisor");
    noClasses()
        .that()
        .resideInAnyPackage("kr.securityadvisor.llm..", "kr.securityadvisor.request..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(
            "kr.securityadvisor.knowledge.repository..", "kr.securityadvisor.knowledge.domain..")
        .check(classes);
    noClasses()
        .that()
        .resideInAnyPackage("kr.securityadvisor.llm..", "kr.securityadvisor.request..")
        .should()
        .dependOnClassesThat()
        .haveSimpleName("PrivateContextService")
        .check(classes);
  }
}
