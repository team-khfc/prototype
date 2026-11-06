package kr.securityadvisor.request.dto;

/** 신뢰 경계를 통과한 AI 후보도 저장 시에는 미확정으로 취급한다. */
public record AiAnswerProposal(String key, String value, String evidence) {}
