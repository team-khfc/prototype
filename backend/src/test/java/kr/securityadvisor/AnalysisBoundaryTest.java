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
        .resideInAPackage("kr.securityadvisor.analysis..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(
            "kr.securityadvisor.institution.repository..",
            "kr.securityadvisor.institution.domain..")
        .check(classes);
    noClasses()
        .that()
        .resideInAPackage("kr.securityadvisor.analysis..")
        .should()
        .dependOnClassesThat()
        .haveSimpleName("PrivateContextService")
        .check(classes);
  }
}
