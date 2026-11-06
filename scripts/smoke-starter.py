#!/usr/bin/env python3
"""실행 중인 합성 서버의 새 1:N 업무를 실제 HTTP·세션·CSRF로 확인한다.

새 합성 사업 건과 이력을 생성한다. 운영 DB에서 실행하지 않는다.
루트 .env 또는 환경변수의 시연 암호를 읽으며 암호·쿠키·CSRF 토큰은 출력하지 않는다.
"""
import http.cookiejar
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('SA_TEST_BASE_URL', 'http://127.0.0.1:3000').rstrip('/')
ENVIRONMENT = {}
if (ROOT / '.env').exists():
    for line in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
        if line and not line.startswith('#'):
            name, separator, value = line.partition('=')
            if separator and name.startswith('SA_'):
                ENVIRONMENT[name] = value
ENVIRONMENT.update(os.environ)
RESULTS = []
RESPONSES = []


class Client:
    """각 역할의 쿠키와 CSRF 토큰을 서로 공유하지 않는다."""

    def __init__(self):
        self.opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}),
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.token = None

    def request(self, method, path, data=None, expected=200, headers=None, csrf=True,
                schema=None):
        values = dict(headers or {})
        if isinstance(data, dict):
            data = json.dumps(data, ensure_ascii=False).encode()
            values['Content-Type'] = 'application/json'
        if csrf and self.token and method != 'GET':
            values[self.token['headerName']] = self.token['token']
        request = urllib.request.Request(BASE + path, data=data, headers=values, method=method)
        try:
            response = self.opener.open(request, timeout=40)
        except urllib.error.HTTPError as error:
            response = error
        content = response.read()
        if response.status != expected:
            code = ''
            try:
                code = json.loads(content).get('code', '')
            except (ValueError, AttributeError):
                pass
            raise AssertionError(
                f'{method} {path}: expected={expected}, actual={response.status}, code={code}')
        if 'json' in response.headers.get('Content-Type', ''):
            parsed = json.loads(content)
            if schema:
                RESPONSES.append({'schema': schema, 'data': parsed})
            return parsed
        return content

    def login(self, username, role):
        self.token = self.request('GET', '/api/auth/csrf')
        password = ENVIRONMENT.get(f'SA_DEMO_{role}_PASSWORD')
        if not password:
            raise SystemExit(f'SA_DEMO_{role}_PASSWORD 환경변수가 필요합니다.')
        form = urllib.parse.urlencode({'username': username, 'password': password}).encode()
        session = self.request('POST', '/api/auth/login', form,
            headers={'Content-Type': 'application/x-www-form-urlencoded'})
        self.token = self.request('GET', '/api/auth/csrf')
        return session

    def multipart(self, path, fields):
        boundary = 'security-advisor-' + uuid.uuid4().hex
        chunks = []
        for key, value in fields.items():
            chunks.append(
                f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n')
        chunks.append(f'--{boundary}--\r\n')
        return self.request('POST', path, ''.join(chunks).encode(),
            headers={'Content-Type': 'multipart/form-data; boundary=' + boundary},
            schema='caseAnalysisSchema')


def passed(name):
    RESULTS.append(name)
    print('PASS ' + name, flush=True)


def request_get(client, request_id):
    return client.request('GET', '/api/security-requests/' + request_id,
                          schema='securityRequestSchema')


def command(client, current, action, extra=None, expected=200, headers=None):
    return client.request('POST', '/api/security-requests/' + current['id'] + action,
        {'expectedRevision': current['revision'], **(extra or {})}, expected=expected,
        headers=headers, schema='securityRequestSchema' if expected == 200 else None)


def answer_inputs(fields, role, values):
    return [{'key': field['key'], 'value': values.get(field['key'], '담당자가 확인한 합성 내용'),
             'confirmed': True, 'notApplicable': False}
            for field in fields if field['ownerRole'] == role]


def answer_request(client, current, role):
    return client.request('PATCH', '/api/security-requests/' + current['id'] + '/answers',
        {'expectedRevision': current['revision'],
         'answers': answer_inputs(current['answers'], role, {})}, schema='securityRequestSchema')


def run():
    anonymous = Client()
    anonymous.request('GET', '/api/business-cases', expected=401)
    clients = {}
    for role in ['APPLICANT', 'SECURITY', 'INFRA', 'ADMIN']:
        client = Client()
        assert client.login(role.lower() + '.demo', role)['user']['role'] == role
        clients[role] = client
    app, sec, infra, admin = (clients[x] for x in ['APPLICANT', 'SECURITY', 'INFRA', 'ADMIN'])
    app.request('POST', '/api/business-cases', {}, expected=403, csrf=False)
    app.request('GET', '/api/members', expected=403)
    passed('역할별 실제 세션·CSRF·관리자 권한 경계')

    for path in ['/workspace', '/requests', '/admin/models', '/design-preview/workspace']:
        anonymous.request('GET', path, expected=404)
    for path in ['/api/procedures', '/api/institution-settings']:
        admin.request('GET', path, expected=404)
    passed('이전 화면·예제 API의 실행 경로 제거')

    anonymous.token = anonymous.request('GET', '/api/auth/csrf')
    username = 'fresh.' + uuid.uuid4().hex[:12]
    signed_up = anonymous.request('POST', '/api/auth/signup', {
        'username': username, 'password': ENVIRONMENT['SA_DEMO_APPLICANT_PASSWORD'],
        'displayName': '합성 가입 검증자', 'department': '합성 검증팀',
        'role': 'ADMIN', 'institutionId': str(uuid.uuid4())}, expected=201,
        schema='actorSchema')
    assert signed_up['role'] == 'APPLICANT'
    members = admin.request('GET', '/api/members', schema='memberSchema[]')
    member = next(value for value in members if value['username'] == username)
    changed = admin.request('PATCH', '/api/members/' + member['id'] + '/role', {
        'role': 'INFRA', 'expectedRevision': member['revision'],
        'reason': '합성 역할 관리 HTTP 검증'}, schema='memberSchema')
    assert changed['role'] == 'INFRA' and changed['revision'] > member['revision']
    admin.request('PATCH', '/api/members/' + member['id'] + '/role', {
        'role': 'SECURITY', 'expectedRevision': member['revision'],
        'reason': '오래된 수정본 거부 확인'}, expected=409)
    admin.request('PATCH', '/api/members/' + member['id'] + '/role', {
        'role': 'APPLICANT', 'expectedRevision': changed['revision'],
        'reason': '검사 후 합성 시연의 배정 후보군 복원'}, schema='memberSchema')
    passed('신청자 가입·역할 주입 방지·관리자 역할 변경·revision 경계')

    example = admin.request('POST', '/api/llm-configurations', {
        'connection': {'provider': 'EXAMPLE', 'endpoint': '', 'model': 'labelled-lines-v1',
                       'keyReference': '', 'temperature': 0, 'maxTokens': 1024,
                       'timeoutSeconds': 15},
        'purpose': 'SUMMARY', 'reason': '합성 분석 구성 선택 검증'},
        schema='llmConfigurationSchema')
    connection = {'provider': 'OPENAI',
                  'endpoint': 'https://api.openai.com/v1/chat/completions',
                  'model': 'gpt-4.1-mini', 'keyReference': 'SA_OPENAI_API_KEY',
                  'temperature': 0, 'maxTokens': 1024, 'timeoutSeconds': 15}
    live = admin.request('POST', '/api/llm-configurations', {
        'connection': connection, 'purpose': 'INTERVIEW',
        'reason': '연결 구성 저장만 확인하며 외부 모델은 호출하지 않음'},
        schema='llmConfigurationSchema')
    admin.request('POST', '/api/llm-configurations', {
        'connection': {**connection, 'endpoint': 'https://example.invalid/model'},
        'purpose': 'INTERVIEW', 'reason': '허용하지 않은 주소 거부'}, expected=422)
    options = app.request('GET', '/api/llm-options', schema='llmOptionSchema[]')
    assert next(value for value in options if value['id'] == live['id'])['mode'] == 'LIVE'
    assert all(set(value) == {'id', 'purpose', 'provider', 'model', 'mode'} for value in options)
    app.request('GET', '/api/llm-configurations', expected=403)
    admin.request('GET', '/api/llm-configurations', schema='llmConfigurationSchema[]')
    other_institution = Client()
    other_institution.login('outside.demo', 'APPLICANT')
    assert all(value['id'] is None for value in
               other_institution.request('GET', '/api/llm-options', schema='llmOptionSchema[]'))
    passed('기관별 모델 구성·주소 검증·일반 선택 목록의 비밀 필드 제외')

    case = app.request('POST', '/api/business-cases', {
        'title': '[HTTP 합성 검증] 공공자료 안내 ' + uuid.uuid4().hex[:8],
        'department': '합성 검증팀', 'description': '공개 자료를 안내하는 가상 사업입니다.',
        'docTypes': ['FIREWALL', 'SECURITY_REVIEW']}, expected=201, schema='businessCaseSchema')
    case_path = '/api/business-cases/' + case['id']
    assert len(case['requests']) == 2
    for username in ['second.demo', 'outside.demo']:
        other = Client()
        other.login(username, 'APPLICANT')
        other.request('GET', case_path, expected=404)
        for summary in case['requests']:
            other.request('GET', '/api/security-requests/' + summary['id'], expected=404)
    passed('사업 건 1:N 서류 생성·다른 신청자 및 기관 격리')

    values = {'purpose': '공개 안내자료를 조회하는 합성 서비스', 'dataTypes': '공개 안내 문서',
              'externalTransfer': '없음', 'dataFlow': '합성 화면에서 공개 자료 조회'}
    analysis = app.multipart(case_path + '/analyses', {
        'expectedRevision': case['revision'],
        'configurationId': example['id'],
        'text': '\n'.join(key + ': ' + value for key, value in values.items())})
    assert analysis['mode'] == 'EXAMPLE' and analysis['status'] == 'SUCCEEDED'
    case = app.request('POST', case_path + '/analyses/' + analysis['id'] + '/apply',
        {'expectedRevision': case['revision']}, schema='businessCaseSchema')
    assert all(field['source'] == 'AI_INFERRED' and not field['confirmed']
               for field in case['answers'] if field['ownerRole'] == 'APPLICANT')
    old_revision = case['revision']
    case = app.request('PATCH', case_path + '/answers', {
        'expectedRevision': old_revision,
        'answers': answer_inputs(case['answers'], 'APPLICANT', values)}, schema='businessCaseSchema')
    app.request('PATCH', case_path + '/answers', {
        'expectedRevision': old_revision,
        'answers': answer_inputs(case['answers'], 'APPLICANT', values)}, expected=409)
    passed('EXAMPLE 분석·미확정 후보 적용·사람 확인·오래된 revision 거부')

    requests = {}
    for summary in case['requests']:
        current = answer_request(app, request_get(app, summary['id']), 'APPLICANT')
        current = command(app, current, '/consult')
        assert current['stage'] == 2 and len(current['assignments']) == 2
        assert len([d for d in current['deadlines'] if d['active']]) == 2
        requests[current['docType']] = current['id']
    fw = request_get(app, requests['FIREWALL'])
    command(sec, fw, '/reviews/complete', {'comment': '할당 전 검토 거부 확인'}, expected=422)
    case = infra.request('GET', case_path, schema='businessCaseSchema')
    facts = {'sourceSystem': '합성 화면 시스템', 'sourceIp': '192.0.2.10',
             'destinationSystem': '합성 안내 시스템', 'destinationIp': '198.51.100.20',
             'protocol': 'TCP', 'port': '443', 'period': '2026-11-07부터 2026-12-31까지'}
    case = infra.request('PATCH', case_path + '/answers', {
        'expectedRevision': case['revision'],
        'answers': answer_inputs(case['answers'], 'INFRA', facts)}, schema='businessCaseSchema')
    fw = command(infra, request_get(infra, requests['FIREWALL']), '/allocation')
    assert fw['stage'] == 2
    assert next(r for r in fw['reviews'] if r['field'] == 'INFRA')['status'] != 'COMPLETE'
    sibling = request_get(app, requests['SECURITY_REVIEW'])
    assert not next(r for r in sibling['reviews'] if r['field'] == 'INFRA')['allocationCompleted']
    passed('서버 자동 배정·저장 기한·INFRA 선행·할당과 협의 및 신청별 진행 분리')

    before = {a['key']: a['value'] for a in fw['answers']}
    fw = command(sec, fw, '/returns', {
        'targetStage': 1, 'fieldKeys': ['connectionPurpose'], 'reason': '합성 연결 목적 재확인'})
    assert fw['stage'] == 1 and 'connectionPurpose' in fw['highlightedFields']
    assert {a['key']: a['value'] for a in fw['answers']} == before
    assert request_get(app, requests['SECURITY_REVIEW'])['stage'] == 2
    fw = answer_request(app, fw, 'APPLICANT')
    fw = command(app, fw, '/consult')
    fw = command(infra, fw, '/allocation')
    fw = command(sec, fw, '/supplements', {
        'fieldKeys': ['connectionPurpose'], 'reason': '합성 자료만 사용하는지 확인해 주세요.'})
    supplement = fw['supplements'][-1]['id']
    fw = command(app, fw, f'/supplements/{supplement}/answer', {'answer': '모든 자료는 합성입니다.'})
    command(infra, fw, f'/supplements/{supplement}/resolve', expected=403)
    fw = command(sec, fw, f'/supplements/{supplement}/resolve')
    passed('2→1 차수 반환·값/이력 보존·지정 항목 강조·보완 요청 분야 확인')

    submitted = {}
    for doc_type, request_id in requests.items():
        current = request_get(sec, request_id)
        if not next(r for r in current['reviews'] if r['field'] == 'INFRA')['allocationCompleted']:
            current = command(infra, current, '/allocation')
        current = answer_request(sec, current, 'SECURITY')
        for client in [infra, sec]:
            current = command(client, current, '/reviews/complete', {'comment': '합성 검토 완료'})
        assert current['stage'] == 3 and current['blockers'] == []
        key = str(uuid.uuid4())
        source = current
        current = command(app, source, '/submit', headers={'Idempotency-Key': key})
        repeated = command(app, source, '/submit', headers={'Idempotency-Key': key})
        assert current['currentSubmissionId'] == repeated['currentSubmissionId']
        assert current['status'] == 'SUBMITTED' and len(current['submissions']) == 1
        command(sec, current, '/final-confirmations', expected=422)
        current = command(infra, current, '/final-confirmations')
        current = command(sec, current, '/final-confirmations')
        current = command(sec, current, '/finalize')
        assert current['status'] == 'FINALIZED' and current['allowedActions'] == ['DOWNLOAD']
        submitted[doc_type] = current
        document = app.request('GET', '/api/security-requests/' + request_id + '/document')
        assert '방화벽 적용 완료를 뜻하지 않습니다' in document.decode()
        events = app.request('GET', '/api/security-requests/' + request_id + '/audit-events',
                             schema='auditEventSchema[]')
        assert any(event['action'] == 'REQUEST_FINALIZED' for event in events)
    passed('두 서류 협의 완료·멱등 제출·INFRA→SECURITY 최종 확인·확정·다운로드 감사')

    admin.request('GET', '/api/reviewer-pools', schema='reviewerPoolSchema[]')
    admin.request('GET', '/api/audit-events', schema='auditEventSchema[]')
    app.request('POST', '/api/auth/logout', expected=204)
    app.request('GET', '/api/auth/session', expected=401)
    passed('운영 조회·감사 응답·로그아웃 세션 폐기')
    capture = ENVIRONMENT.get('SA_SMOKE_CAPTURE')
    if capture:
        Path(capture).write_text(json.dumps(RESPONSES, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'groups': len(RESULTS), 'passed': RESULTS,
                      'syntheticResponseSamples': len(RESPONSES)}, ensure_ascii=False))


if __name__ == '__main__':
    run()
