#!/usr/bin/env python3
"""실행 중인 합성 시연 서버에서 두 서류의 실제 HTTP 흐름을 확인한다.

새 합성 신청을 생성한다. 운영 환경에 실행하지 않는다. 암호와 세션은 출력하지 않는다.
"""
import copy
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('BOAN_TEST_BASE_URL', 'http://127.0.0.1:3000').rstrip('/')
ENVIRONMENT = {}
for line in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
    if line and not line.startswith('#'):
        name, _, value = line.partition('=')
        ENVIRONMENT[name] = value
RESULTS = []


class Client:
    def __init__(self):
        self.opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}),
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.token = None

    def request(self, method, path, data=None, expected=200, headers=None, csrf=True):
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
            raise AssertionError(f'{method} {path}: expected={expected}, actual={response.status}')
        if 'application/json' in response.headers.get('Content-Type', '') or 'application/problem+json' in response.headers.get('Content-Type', ''):
            return json.loads(content)
        return content

    def login(self, username, role):
        self.token = self.request('GET', '/api/auth/csrf')
        form = urllib.parse.urlencode({'username': username,
            'password': ENVIRONMENT[f'BOAN_DEMO_{role}_PASSWORD']}).encode()
        session = self.request('POST', '/api/auth/login', form,
            headers={'Content-Type': 'application/x-www-form-urlencoded'})
        self.token = self.request('GET', '/api/auth/csrf')
        return session

    def multipart(self, path, fields):
        boundary = 'boan-' + uuid.uuid4().hex
        chunks = []
        for key, value in fields.items():
            chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n')
        chunks.append(f'--{boundary}--\r\n')
        return self.request('POST', path, ''.join(chunks).encode(),
            headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})


def passed(name):
    RESULTS.append(name)
    print('PASS ' + name)


anonymous = Client()
anonymous.request('GET', '/api/procedures', expected=401)
clients = {}
for role in ['APPLICANT', 'SECURITY', 'INFRA', 'ADMIN']:
    client = Client()
    assert client.login(role.lower() + '.demo', role)['user']['role'] == role
    clients[role] = client
app, sec, infra, admin = (clients[x] for x in ['APPLICANT', 'SECURITY', 'INFRA', 'ADMIN'])
app.request('POST', '/api/procedures', {}, expected=403, csrf=False)
app.request('GET', '/api/institution/settings', expected=403)
admin.request('GET', '/api/procedures', expected=403)
passed('세션 로그인·CSRF·역할 경계')

others = []
for name in ['second.demo', 'outside.demo']:
    client = Client()
    client.login(name, 'APPLICANT')
    others.append(client)

created = []
for document_type in ['FIREWALL', 'SECURITY_REVIEW']:
    current = app.request('POST', '/api/procedures', {
        'title': '[HTTP 합성 검증] ' + document_type,
        'documentType': document_type, 'department': '가상 검증팀',
        'description': '실제 기관 정보 없이 업무 흐름을 확인하는 합성 자료입니다.'}, expected=201)
    path = '/api/procedures/' + current['id']
    for client in others:
        client.request('GET', path, expected=404)
        client.request('GET', path + '/document', expected=404)
    infra.request('GET', path, expected=404)
    app.request('POST', path + '/submit', {'expectedRevision': current['revision']},
        expected=422, headers={'Idempotency-Key': str(uuid.uuid4())})

    values = {'purpose': '공개 안내자료를 찾는 가상 서비스', 'audience': '합성 이용자',
        'dataTypes': '공개 안내 문서', 'externalTransfer': 'NO',
        'period': '2026-11-06부터 2026-12-31까지', 'dataFlow': '합성 화면에서 공개 자료 조회'}
    if document_type == 'FIREWALL':
        result = app.multipart(path + '/analysis', {'expectedRevision': current['revision'],
            'text': '사업 목적: ' + values['purpose'] + '\n이용 대상: ' + values['audience']})
        assert result['status'] == 'SUCCEEDED' and result['mode'] == 'EXAMPLE'
        current = app.request('POST', path + '/analysis/' + result['id'] + '/apply',
            {'expectedRevision': current['revision']})
        assert any(field['status'] == 'PROPOSED' and field['source']['kind'] == 'AI_INFERENCE'
            for field in current['answers'])
    initial_revision = current['revision']
    answers = [{'key': field['key'], 'value': values.get(field['key'], '합성 확인 내용'),
        'confirmed': True, 'notApplicable': False} for field in current['answers']
        if field['ownerRole'] == 'APPLICANT']
    current = app.request('PATCH', path + '/answers',
        {'expectedRevision': initial_revision, 'answers': answers})
    if document_type == 'FIREWALL':
        purpose = next(field for field in current['answers'] if field['key'] == 'purpose')
        assert purpose['status'] == 'CONFIRMED' and purpose['source']['kind'] == 'AI_INFERENCE'
        assert purpose['confirmation']['role'] == 'APPLICANT'
    conflict = app.request('PATCH', path + '/answers',
        {'expectedRevision': initial_revision, 'answers': answers}, expected=409)
    assert conflict['latestRevision'] == current['revision']
    current = app.request('POST', path + '/consult', {'expectedRevision': current['revision']})

    for role, client in [('INFRA', infra), ('SECURITY', sec)]:
        answers = [{'key': field['key'], 'value': '담당자가 확인한 합성 설명',
            'confirmed': True, 'notApplicable': False} for field in current['answers']
            if field['ownerRole'] == role]
        current = client.request('PATCH', path + '/answers',
            {'expectedRevision': current['revision'], 'answers': answers})
    if document_type == 'FIREWALL':
        rule = {'sourceName': '합성 화면 서버', 'sourceIp': '192.0.2.10',
            'destinationName': '합성 안내 서버', 'destinationIp': '198.51.100.20',
            'port': '443', 'protocol': 'TCP', 'direction': 'ONE_WAY',
            'startsOn': '2026-11-06', 'endsOn': '2026-12-31', 'purpose': '합성 자료 조회'}
        app.request('PUT', path + '/network',
            {'expectedRevision': current['revision'], 'rules': [rule]}, expected=403)
        current = infra.request('PUT', path + '/network',
            {'expectedRevision': current['revision'], 'rules': [rule]})
    current = sec.request('POST', path + '/supplements',
        {'expectedRevision': current['revision'], 'question': '합성 자료만 사용하는지 확인해 주세요.'})
    supplement = current['supplements'][-1]['id']
    current = app.request('POST', path + f'/supplements/{supplement}/answer',
        {'expectedRevision': current['revision'], 'answer': '모든 자료가 합성임을 확인했습니다.'})
    infra.request('POST', path + f'/supplements/{supplement}/resolve',
        {'expectedRevision': current['revision']}, expected=403)
    current = sec.request('POST', path + f'/supplements/{supplement}/resolve',
        {'expectedRevision': current['revision']})
    for client in [infra, sec]:
        current = client.request('POST', path + '/review',
            {'expectedRevision': current['revision'], 'comment': '합성 검증 완료'})
    assert current['blockers'] == []
    key = str(uuid.uuid4())
    version = current['revision']
    current = app.request('POST', path + '/submit', {'expectedRevision': version},
        headers={'Idempotency-Key': key})
    again = app.request('POST', path + '/submit', {'expectedRevision': version},
        headers={'Idempotency-Key': key})
    assert current['id'] == again['id'] and current['status'] == 'SUBMITTED'
    original_document = app.request('GET', path + '/document')
    app.request('PATCH', path + '/answers',
        {'expectedRevision': current['revision'], 'answers': answers}, expected=409)
    current = sec.request('POST', path + '/receive', {'expectedRevision': current['revision']})
    assert current['status'] == 'RECEIVED'
    assert hashlib.sha256(original_document).digest() == hashlib.sha256(app.request('GET', path + '/document')).digest()
    created.append(current)
    passed(document_type + ' 작성·기관 격리·협의·보완·검토·멱등 제출·접수·문서 보존')

settings = admin.request('GET', '/api/institution/settings')
draft = copy.deepcopy(settings['draft'])
draft['documentFooter'] = '합성 HTTP 검증 게시본 ' + str(uuid.uuid4())[:8]
saved = admin.request('PUT', '/api/institution/settings',
    {'expectedRevision': settings['revision'], 'policy': draft})
key = str(uuid.uuid4())
published = admin.request('POST', '/api/institution/settings/publish',
    {'expectedRevision': saved['revision']}, headers={'Idempotency-Key': key})
admin.request('POST', '/api/institution/settings/publish',
    {'expectedRevision': saved['revision']}, headers={'Idempotency-Key': key})
for before in created:
    after = app.request('GET', '/api/procedures/' + before['id'])
    assert after['policyVersion'] == before['policyVersion'] < published['publishedVersion']
    assert after['policy']['documentFooter'] == before['policy']['documentFooter']
passed('기관 설정 초안·멱등 게시·기존 신청 버전 고정')

context = admin.request('POST', '/api/institution/contexts',
    {'title': '합성 운영 참고', 'category': 'INFRASTRUCTURE', 'content': '기관 내부 사실이 아닌 합성 암호화 검증 문자열입니다.'}, expected=201)
assert context['title'] == '합성 운영 참고'
app.request('GET', '/api/institution/contexts', expected=403)
passed('기관 컨텍스트 저장과 일반 사용자 접근 거절')

app.request('POST', '/api/auth/logout', expected=204)
app.request('GET', '/api/auth/session', expected=401)
passed('로그아웃 후 세션 폐기')
print(json.dumps({'groups': len(RESULTS), 'passed': RESULTS}, ensure_ascii=False))
