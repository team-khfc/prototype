/**
 * 디자인 검토에 필요한 탐색만 제공한다. 업무 API·파일 본문 읽기·실제 상태 전이는 없다.
 * 편집 도구가 문구를 선택하는 동안에는 제품 화면의 이벤트를 실행하지 않는다.
 */
(() => {
  'use strict';

  const screen = document.body.dataset.screen || '';
  const base = document.body.dataset.base || '';
  const dialog = document.getElementById('design-dialog');
  let dialogOpener = null;
  let activeField = '전체';
  let currentPage = 1;
  let descendingDue = false;
  let selectedQuestion = '0';
  const questionDrafts = new Map();
  const allowedScreens = new Set([
    '01-workspace.html',
    '02-requests.html',
    '03-request-basic.html',
    '04-request-analysis.html',
    '05-request-questions.html',
    '06-request-summary.html',
    '07-security-review.html',
    '08-infra-review.html',
    '09-supplement.html',
    '10-submit.html',
    '11-receipt.html',
    '12-documents.html',
    '13-admin-questions.html',
    '14-admin-workflow.html',
    '15-admin-versions.html',
    '16-components.html',
    'index.html',
    'docs/DESIGN_GUIDE.html',
    'patterns/index.html',
  ]);

  /** 도구가 선택한 편집 모드를 업무 시안 이벤트와 분리한다. */
  function editing() {
    return document.documentElement.dataset.designEditing === 'true';
  }

  /** 네이티브 maxlength와 같은 UTF-16 단위로 자동 메타 정보만 갱신한다. */
  function updateCharacterCount(field) {
    if (!field || !['project-title', 'project-summary'].includes(field.id)) return;
    const counter = document.getElementById(`${field.id}-count`);
    if (!counter || field.maxLength < 0) return;
    counter.textContent = `${field.value.length.toLocaleString('ko')} / ${field.maxLength.toLocaleString('ko')}자`;
  }

  /** 동적 안내에는 HTML을 삽입하지 않고 텍스트 노드를 사용한다. */
  function element(tag, value, className = '') {
    const result = document.createElement(tag);
    if (value !== null) result.textContent = value;
    if (className) result.className = className;
    return result;
  }

  /** 로컬에 포함한 시안으로만 이동한다. 입력값을 임의 URL로 실행하지 않는다. */
  function navigate(filename, query = '') {
    if (!allowedScreens.has(filename)) return;
    window.location.assign(base + filename + query);
  }

  /** 네이티브 dialog가 초점 제한과 Escape 닫기를 담당한다. */
  function closeDialog() {
    if (!dialog?.open) return;
    dialog.close();
  }

  /** 업무 완료 대신 어떤 상태를 검토하는지 설명하는 대화상자를 표시한다. */
  function showDialog(title, paragraphs, actions = []) {
    if (!dialog) return;
    dialogOpener = document.activeElement;
    document.getElementById('design-dialog-title').textContent = title;
    const body = document.getElementById('design-dialog-body');
    body.replaceChildren(...paragraphs.map((value) => element('p', value)));
    const actionArea = document.getElementById('design-dialog-actions');
    actionArea.replaceChildren();
    const cancel = element('button', actions.length ? '돌아가기' : '닫기', 'button');
    cancel.type = 'button';
    cancel.addEventListener('click', closeDialog);
    actionArea.append(cancel);
    for (const action of actions) {
      const button = element('button', action.label, action.primary ? 'button primary' : 'button');
      button.type = 'button';
      button.addEventListener('click', () => {
        closeDialog();
        if (action.run) action.run();
        else if (action.screen) navigate(action.screen);
      });
      actionArea.append(button);
    }
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-close]')?.focus();
  }

  if (dialog) {
    dialog.querySelector('[data-close]')?.addEventListener('click', closeDialog);
    dialog.addEventListener('close', () => {
      if (dialogOpener instanceof HTMLElement && dialogOpener.isConnected) dialogOpener.focus();
    });
  }

  /** 현재 페이지의 합성 원문·값을 미리보기로 보여 주며 확인 상태를 보존한다. */
  function showDocument(trigger) {
    const card = trigger.closest('.document-card');
    const title =
      card?.querySelector('h2')?.textContent.trim() ||
      document.querySelector('#page-title')?.textContent.trim() ||
      '합성 문서';
    showDialog('문서 미리보기 · 디자인 예시', [
      `${title} — 이 문서는 배치와 상태 표기를 검토하는 합성 예시입니다. 실제 신청서나 제출본이 아닙니다.`,
      document.body.dataset.submitReady === 'true' || screen === '11-receipt.html'
        ? '필수 답변과 담당자 검토를 확인한 상태의 예시입니다. 실제 적용 완료와 구분합니다.'
        : card?.textContent.includes('제출본')
          ? '확인한 답변을 제출 시점의 문서로 보존하는 상태 예시입니다.'
          : '미확정 항목은 담당자 확인 필요로 표시하고 초안에 남깁니다.',
    ]);
    const body = document.getElementById('design-dialog-body');
    const items = [...document.querySelectorAll('.evidence-item')];
    if (items.length) {
      const list = element('dl', null, 'design-preview-facts');
      for (const item of items) {
        const entry = element('div', null);
        entry.append(
          element('dt', item.querySelector('h3')?.textContent.trim() || '확인 항목'),
          element(
            'dd',
            item.querySelector('.evidence-value')?.textContent.trim() || '담당자 확인 필요',
          ),
          element(
            'dd',
            `${item.querySelector('.sf-badge')?.textContent.trim() || '미확정'} · ${item.querySelector('.design-source-label')?.textContent.trim() || '담당자 확인 필요'}`,
            'muted',
          ),
        );
        list.append(entry);
      }
      body.append(list);
    } else if (card) {
      const details = card.querySelector('dl');
      if (details) body.append(element('p', details.textContent.replace(/\s+/g, ' ').trim()));
    }
  }

  /** 표의 노드는 유지하고 보이는 범위만 바꿔 디자이너의 문구 편집을 보존한다. */
  function filterRequests(resetPage = false) {
    const table = document.querySelector('main .list-panel table');
    if (!table) return;
    if (resetPage) currentPage = 1;
    const query = (document.getElementById('list-search')?.value || '')
      .trim()
      .toLocaleLowerCase('ko');
    const phase = document.getElementById('phase')?.value || '전체';
    const start = document.getElementById('date-start')?.value || '';
    const end = document.getElementById('date-end')?.value || '';
    const perPage = Number(document.getElementById('page-size')?.value) === 6 ? 6 : 12;
    const rows = [...table.tBodies[0].rows];
    const matches = rows.filter((row) => {
      const text = row.textContent.toLocaleLowerCase('ko');
      return (
        (!query || text.includes(query)) &&
        (phase === '전체' || row.dataset.phase === phase) &&
        (activeField === '전체' ||
          row.dataset[activeField === 'SECURITY' ? 'securityDone' : 'infraDone'] !== 'true') &&
        (!start || row.dataset.receivedDate >= start) &&
        (!end || row.dataset.receivedDate <= end)
      );
    });
    const sortByRecent = document.getElementById('list-sort')?.value === '최신 접수순';
    matches.sort((left, right) => {
      if (sortByRecent)
        return (right.dataset.receivedDate || '').localeCompare(left.dataset.receivedDate || '');
      const leftDate = left.cells[5].textContent.replace(/[^0-9]/g, '').slice(0, 8);
      const rightDate = right.cells[5].textContent.replace(/[^0-9]/g, '').slice(0, 8);
      return leftDate.localeCompare(rightDate) * (descendingDue ? -1 : 1);
    });
    const pageCount = Math.max(1, Math.ceil(matches.length / perPage));
    currentPage = Math.min(Math.max(1, currentPage), pageCount);
    rows.forEach((row) => {
      row.hidden = true;
    });
    const pageRows = matches.slice((currentPage - 1) * perPage, currentPage * perPage);
    for (const row of pageRows) {
      table.tBodies[0].append(row);
      row.hidden = false;
    }
    document.getElementById('list-result-count').textContent = String(matches.length);
    document.getElementById('list-empty').hidden = matches.length !== 0;
    document.querySelector('.pagination > span').textContent =
      `${currentPage} / ${pageCount}페이지`;
    table.caption.textContent = `보안 협의 검색 결과 ${matches.length}건, 현재 ${currentPage}페이지`;
    for (const button of document.querySelectorAll('[data-action="paginate"]')) {
      const label = button.dataset.page;
      if (/^\d+$/.test(label)) {
        const value = Number(label);
        button.hidden = value > pageCount;
        button.classList.toggle('selected', value === currentPage);
        if (value === currentPage) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      } else {
        button.disabled =
          label.includes('이전') || label.includes('첫')
            ? currentPage === 1
            : currentPage === pageCount;
      }
    }
    for (const card of document.querySelectorAll('[data-action="phase"]'))
      card.setAttribute('aria-pressed', String(card.dataset.phase === phase));
    updateTableSelection();
  }

  /** 전체 선택은 보이는 행만 대상으로 하며 일부 선택을 별도로 표시한다. */
  function updateTableSelection() {
    const table = document.querySelector('.list-panel table');
    if (!table) return;
    const all = table.querySelector('thead input[type="checkbox"]');
    const visible = [...table.querySelectorAll('tbody tr:not([hidden]) input[type="checkbox"]')];
    const checked = visible.filter((input) => input.checked).length;
    all.checked = visible.length > 0 && checked === visible.length;
    all.indeterminate = checked > 0 && checked < visible.length;
    all.disabled = visible.length === 0;
  }

  /** 현재 선택한 조건을 모두 해제하고 첫 페이지로 돌아간다. */
  function resetRequests() {
    for (const id of ['list-search', 'date-start', 'date-end']) {
      const input = document.getElementById(id);
      if (input) input.value = '';
    }
    const phase = document.getElementById('phase');
    if (phase) phase.value = '전체';
    activeField = '전체';
    for (const button of document.querySelectorAll('[data-action="field-filter"]')) {
      button.classList.toggle('selected', button.dataset.field === activeField);
      button.setAttribute('aria-pressed', String(button.dataset.field === activeField));
    }
    filterRequests(true);
  }

  /** 문서함의 합성 카드 두 개를 화면에서만 필터링한다. */
  function filterDocuments() {
    const query = (document.getElementById('document-query')?.value || '')
      .trim()
      .toLocaleLowerCase('ko');
    const status = document.getElementById('document-status')?.value || '전체';
    const cards = [...document.querySelectorAll('.document-card')];
    if (!cards.length) return;
    let count = 0;
    for (const card of cards) {
      card.hidden =
        !card.textContent.toLocaleLowerCase('ko').includes(query) ||
        (status !== '전체' && !card.textContent.includes(status));
      if (!card.hidden) count += 1;
    }
    const counter = document.getElementById('document-count');
    if (counter) counter.textContent = `합성 문서 ${count}건 · 서로 다른 상태의 디자인 예시입니다.`;
    const empty = document.getElementById('documents-empty');
    if (empty) empty.hidden = count !== 0;
  }

  /** 파일 이름·크기만 보여 준다. FileReader나 네트워크 전송은 사용하지 않는다. */
  function showFile(name, description) {
    const row = document.querySelector('.file-row');
    if (!row) return;
    row.hidden = false;
    row.querySelector('.file-name').textContent = name;
    row.querySelector('.file-info small').textContent = description;
    row
      .querySelector('[data-action="remove-file"]')
      .setAttribute('aria-label', `${name} 선택 해제`);
  }

  /** 질문 목록 전환 전에 현재 편집 필드만 메모리에 유지한다. */
  function rememberQuestion() {
    if (!document.getElementById('question-title')) return;
    const values = {};
    for (const id of [
      'question-title',
      'question-key',
      'question-description',
      'question-role',
      'question-required',
    ])
      values[id] = document.getElementById(id)?.value || '';
    questionDrafts.set(selectedQuestion, values);
  }

  /** 합성 질문의 필드 예시를 선택하되 실제 기관 설정을 저장하지 않는다. */
  function selectQuestion(button) {
    rememberQuestion();
    selectedQuestion = button.dataset.question || '0';
    const defaults = {
      'question-title': button.querySelector('strong')?.textContent.trim() || '합성 질문',
      'question-key': `sample.question_${Number(selectedQuestion) + 1}`,
      'question-description':
        '이 항목의 목적, 입력할 내용과 담당자에게 확인할 부분을 설명해 주세요.',
      'question-role': button.textContent.includes('ICT인프라') ? 'ICT인프라' : '신청자',
      'question-required': '최초 신청',
    };
    const values = questionDrafts.get(selectedQuestion) || defaults;
    for (const [id, value] of Object.entries(values)) {
      const field = document.getElementById(id);
      if (field) field.value = value;
    }
    document.querySelector('.question-editor h2').textContent = values['question-title'];
    for (const item of document.querySelectorAll('.question-items button')) {
      item.classList.toggle('selected', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    }
  }

  /** 클릭 시 실제 업무 성공 대신 디자인 상태와 다음 시안의 위치를 설명한다. */
  function handleAction(event) {
    if (editing()) return;
    const trigger = event.target.closest('[data-action]');
    if (!trigger || trigger.disabled) return;
    event.preventDefault();
    const action = trigger.dataset.action;
    if (action === 'navigate' || action === 'next') {
      navigate(trigger.dataset.href);
    } else if (action === 'menu') {
      const nav = document.getElementById('side-nav');
      const open = nav.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
      trigger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    } else if (action === 'help') {
      showDialog(
        '디자인 작업 안내',
        [
          '화면별 HTML은 각각 독립된 합성 상태 예시입니다. 검색·탐색·입력·모달을 검토할 수 있지만 실제 저장·AI·기관 전송은 실행하지 않습니다.',
          '문구와 토큰 수정은 디자인 편집 도구를 사용하고, 화면을 떠나기 전에 작업 파일을 내보내 주세요.',
        ],
        [
          {
            label: '작업 가이드 열기',
            screen: 'docs/DESIGN_GUIDE.html',
            primary: true,
          },
        ],
      );
    } else if (action === 'display') {
      showDialog(
        '화면 글자 크기',
        [
          '이 창에서 고른 글자 크기는 현재 화면에 적용합니다. 브라우저 확대 기능도 사용할 수 있습니다.',
        ],
        [
          {
            label: '보통 글자',
            run: () => document.documentElement.classList.remove('design-large-text'),
          },
          {
            label: '큰 글자',
            run: () => document.documentElement.classList.add('design-large-text'),
          },
        ],
      );
    } else if (action === 'role-preview') {
      const roles = {
        APPLICANT: '03-request-basic.html',
        SECURITY: '07-security-review.html',
        INFRA: '08-infra-review.html',
        ADMIN: '13-admin-questions.html',
      };
      const next = roles[document.getElementById('role')?.value];
      if (next) navigate(next);
    } else if (action === 'case-preview') {
      const target = trigger.getAttribute('href');
      showDialog(
        '같은 단계의 대표 합성 시안',
        [
          '목록의 각 행은 레이아웃 검토용 합성 자료입니다. 연결된 화면은 선택한 행과 같은 단계의 대표 사례를 보여 줍니다.',
        ],
        [{ label: '대표 시안 열기', screen: target, primary: true }],
      );
    } else if (action === 'phase') {
      const phase = trigger.dataset.phase;
      const select = document.getElementById('phase');
      if (select) {
        select.value = select.value === phase ? '전체' : phase;
        filterRequests(true);
      } else navigate('02-requests.html', `?phase=${encodeURIComponent(phase || '')}`);
    } else if (action === 'field-filter') {
      activeField = trigger.dataset.field || '전체';
      for (const button of document.querySelectorAll('[data-action="field-filter"]')) {
        button.classList.toggle('selected', button === trigger);
        button.setAttribute('aria-pressed', String(button === trigger));
      }
      filterRequests(true);
    } else if (action === 'search') filterRequests(true);
    else if (action === 'sort') {
      descendingDue = !descendingDue;
      document.getElementById('list-sort').value = '기한순';
      trigger.closest('th').setAttribute('aria-sort', descendingDue ? 'descending' : 'ascending');
      filterRequests(true);
    } else if (action === 'paginate') {
      const label = trigger.dataset.page;
      currentPage =
        label === '첫 페이지'
          ? 1
          : label === '이전 페이지'
            ? currentPage - 1
            : label === '다음 페이지'
              ? currentPage + 1
              : label === '마지막 페이지'
                ? 99
                : Number(label) || 1;
      filterRequests();
    } else if (action === 'reset') {
      if (screen === '02-requests.html') resetRequests();
      else {
        document.getElementById('document-query').value = '';
        document.getElementById('document-status').value = '전체';
        filterDocuments();
      }
    } else if (action === 'preview') showDocument(trigger);
    else if (action === 'download') {
      showDialog('문서 다운로드 상태 예시', [
        '이 버튼은 업무 문서 다운로드의 위치와 문구를 검토하기 위한 요소입니다. 현재 파일에서는 실제 신청 문서를 발급하지 않습니다.',
        '수정한 화면 파일은 디자인 편집 도구의 HTML 내보내기에서 받을 수 있습니다.',
      ]);
    } else if (action === 'save') {
      showDialog('업무 초안 저장 상태 예시', [
        '이 버튼은 서비스의 저장 위치를 보여 주는 디자인 요소입니다. 서버 저장이나 게시를 실행하지 않았습니다.',
        '디자이너 작업 내용은 디자인 편집 도구에서 HTML 또는 작업 파일로 내보내 주세요.',
      ]);
    } else if (action === 'publish') {
      showDialog(
        '설정 게시 확인 · 디자인 예시',
        [
          '대상: 가상 디지털기관 · 수정 초안 v2.4',
          '실제 서비스에서는 변경 내용을 확인한 뒤 게시하고, 새 신청부터 적용합니다. 기존 신청은 생성 당시의 설정 버전을 유지합니다.',
          '이 작업본은 설정을 저장하거나 게시하지 않습니다.',
        ],
        [
          {
            label: '게시 이력 시안 보기',
            screen: '15-admin-versions.html',
            primary: true,
          },
        ],
      );
    } else if (action === 'consult') {
      showDialog(
        '사전 협의 요청 확인 · 디자인 예시',
        [
          '사업 목적과 설명을 담당자에게 전달하기 전의 확인 화면입니다. 기술정보가 모르는 상태이면 담당자 확인 필요로 남깁니다.',
          '이 작업본에서는 실제 협의 요청이나 알림을 전송하지 않습니다.',
        ],
        [
          {
            label: '정보보안 검토 시안 보기',
            screen: '07-security-review.html',
            primary: true,
          },
        ],
      );
    } else if (action === 'review-complete') {
      showDialog(
        '검토 완료 확인 · 디자인 예시',
        [
          '실제 서비스에서는 필수값, 근거, 보완 해결과 현재 수정본을 서버가 다시 확인합니다. 검토 완료는 실제 방화벽 적용 완료를 뜻하지 않습니다.',
          '현재 화면의 검토 상태는 바꾸지 않습니다. 양쪽 검토가 끝난 별도 합성 시안으로 이동할 수 있습니다.',
        ],
        [
          {
            label: '제출 준비 시안 보기',
            screen: '10-submit.html',
            primary: true,
          },
        ],
      );
    } else if (action === 'supplement') {
      showDialog(
        '보완 요청 · 디자인 예시',
        [
          '실제 서비스에서는 보완 항목, 이유와 작성 책임을 함께 전달합니다. 여기에서는 보완이 필요한 합성 화면을 살펴봅니다.',
        ],
        [
          {
            label: '보완 답변 시안 보기',
            screen: '09-supplement.html',
            primary: true,
          },
        ],
      );
    } else if (action === 'supplement-answer') {
      showDialog('보완 답변 등록 상태 예시', [
        '답변 입력 이후에도 요청한 담당 분야가 해결 여부를 확인해야 합니다. 등록만으로 검토 완료나 최종 제출 상태로 바뀌지 않습니다.',
        '현재 입력은 이 화면의 디자인 검토용이며 서버에 등록하지 않았습니다.',
      ]);
    } else if (action === 'submit') {
      showDialog(
        '최종 제출 확인 · 디자인 예시',
        [
          '양쪽 검토와 필수 답변 확인을 마친 합성 신청입니다. 실제 서비스는 제출 시점의 문서와 설정 버전을 보존합니다.',
          '이 작업본은 제출이나 기관 전송을 실행하지 않습니다. 완료 상태의 화면 구성만 살펴볼 수 있습니다.',
        ],
        [
          {
            label: '제출 완료 시안 보기',
            screen: '11-receipt.html',
            primary: true,
          },
        ],
      );
    } else if (action === 'analyze') {
      if (document.getElementById('analysis-failure')?.checked) {
        showDialog(
          'AI 분석 실패 · 디자인 예시',
          [
            '분석을 완료하지 못한 경우의 안내입니다. 실제 외부 모델을 호출하거나 실패 응답을 받은 것은 아닙니다.',
            '입력값을 유지하고 직접 입력·담당자 확인·재시도를 안내합니다.',
          ],
          [
            {
              label: '직접 입력 시안 보기',
              screen: '05-request-questions.html',
              primary: true,
            },
          ],
        );
      } else
        showDialog('AI 제안 확인 · 디자인 예시', [
          '파일은 전송하지 않습니다. 아래에 표시된 값은 합성 사업계획서의 고정 제안이며 선택한 파일을 분석한 결과가 아닙니다.',
          '제안값·원문 근거·사람의 확인을 별도로 표시합니다. 원문에 없는 기술정보를 채우지 않습니다.',
        ]);
    } else if (action === 'sample-file') {
      document.getElementById('file-input').value = '';
      showFile('합성_업무포털_사업계획서.txt', '합성 파일명 예시 · 서버 미전송');
    } else if (action === 'file-name') {
      showDialog('선택한 파일의 전체 이름', [
        document.querySelector('.file-name')?.textContent || '파일을 선택하지 않았습니다.',
      ]);
    } else if (action === 'remove-file') {
      document.querySelector('.file-row').hidden = true;
      document.getElementById('file-input').value = '';
    } else if (action === 'fill-sample') {
      showDialog(
        '합성 사업 설명 넣기',
        [
          '현재 사업명과 설명 입력란을 아래 합성 예시로 바꿉니다. 기존 내용을 유지하려면 돌아가기를 누르세요.',
        ],
        [
          {
            label: '합성 예시로 바꾸기',
            primary: true,
            run: () => {
              document.getElementById('project-title').value = '가상 업무포털 구축';
              document.getElementById('project-summary').value =
                '가상 기관의 직원이 업무 정보를 조회하는 포털입니다. 공개자료를 검색하며 운영 환경과 통신 정보는 담당자와 확인할 예정입니다.';
              updateCharacterCount(document.getElementById('project-title'));
              updateCharacterCount(document.getElementById('project-summary'));
            },
          },
        ],
      );
    } else if (action === 'question') selectQuestion(trigger);
    else if (action === 'question-add') {
      showDialog(
        '질문 추가 디자인',
        [
          '질문 목록의 항목과 입력 필드를 복제하여 새 문구를 설계할 수 있습니다. 저장 키는 개발자와 합의할 데이터 계약입니다.',
          '새 질문 등록 API는 이 디자인 파일에 연결하지 않았습니다.',
        ],
        [
          {
            label: '작업 가이드 열기',
            screen: 'docs/DESIGN_GUIDE.html',
            primary: true,
          },
        ],
      );
    } else {
      showDialog('컴포넌트 상태 예시', [
        '선택한 요소의 문구·배치·초점 상태를 검토할 수 있습니다. 실제 업무 데이터는 변경하지 않았습니다.',
      ]);
    }
  }

  document.addEventListener('click', handleAction);
  document.addEventListener('submit', (event) => {
    event.preventDefault();
    if (editing()) return;
    if (event.target.matches('.search-field')) filterRequests(true);
  });
  document.addEventListener('input', (event) => {
    const target = event.target;
    updateCharacterCount(target);
    if (editing()) return;
    if (target.id === 'document-query') filterDocuments();
    if (target.id === 'question-search') {
      const query = target.value.trim().toLocaleLowerCase('ko');
      let count = 0;
      for (const button of document.querySelectorAll('.question-items button')) {
        button.hidden = !button.textContent.toLocaleLowerCase('ko').includes(query);
        if (!button.hidden) count += 1;
      }
      document.getElementById('questions-empty').hidden = count !== 0;
    }
  });
  document.addEventListener('change', (event) => {
    if (editing()) return;
    const target = event.target;
    if (['phase', 'date-start', 'date-end', 'list-sort', 'page-size'].includes(target.id))
      filterRequests(true);
    if (target.id === 'document-status') filterDocuments();
    if (target.closest('.list-panel table') && target.type === 'checkbox') {
      if (target.closest('thead')) {
        for (const input of document.querySelectorAll(
          '.list-panel tbody tr:not([hidden]) input[type="checkbox"]',
        ))
          input.checked = target.checked;
      }
      updateTableSelection();
    }
    if (target.id === 'file-input') {
      const files = [...target.files];
      const file = files[0];
      if (!file) return;
      if (
        files.length !== 1 ||
        !/\.(txt|md)$/i.test(file.name) ||
        file.size === 0 ||
        file.size > 1024 * 1024
      ) {
        target.value = '';
        document.querySelector('.file-row').hidden = true;
        showDialog('파일 선택 안내', [
          'UTF-8 TXT·MD 파일 1개, 1MiB 이하를 선택해 주세요. 빈 파일은 사용할 수 없습니다. 이 작업본은 파일 이름·크기만 확인하며 인코딩이나 본문을 분석하지 않습니다.',
        ]);
      } else showFile(file.name, `${file.size.toLocaleString('ko')}B · 선택됨 · 서버 미전송`);
    }
    if (target.matches('.ai-candidate input[type="checkbox"]')) {
      const badge = target.closest('.ai-candidate').querySelector('.sf-badge');
      badge.textContent = target.checked ? 'AI 제안 · 사용자 확인 예시' : 'AI 제안 · 미확정';
      badge.classList.toggle('green', target.checked);
      badge.classList.toggle('amber', !target.checked);
    }
    if (target.matches('.checklist-item input')) {
      const fieldset = target.closest('fieldset');
      const items = [...fieldset.querySelectorAll('.checklist-item input')];
      fieldset.querySelector('legend .muted').textContent =
        `${items.filter((input) => input.checked).length}/${items.length}`;
    }
    if (target.name === 'workflow') {
      for (const radio of document.querySelectorAll('input[name="workflow"]'))
        radio.closest('label').classList.toggle('selected', radio.checked);
      const steps = document.querySelectorAll('.workflow-preview > span');
      if (steps[1])
        steps[1].textContent =
          target.value === 'SEQUENTIAL' ? '정보보안 → ICT인프라' : '정보보안 + ICT인프라';
    }
  });
  document.addEventListener('keydown', (event) => {
    if (editing()) return;
    if (event.key === 'Escape' && !dialog?.open) {
      const sidebar = document.getElementById('side-nav');
      if (sidebar?.classList.contains('open')) {
        sidebar.classList.remove('open');
        const button = document.querySelector('[data-action="menu"]');
        button?.setAttribute('aria-expanded', 'false');
        button?.setAttribute('aria-label', '메뉴 열기');
        button?.focus();
      }
    }
  });
  if (screen === '02-requests.html') {
    const initial = new URLSearchParams(window.location.search).get('phase');
    const select = document.getElementById('phase');
    if (initial && [...select.options].some((option) => option.value === initial))
      select.value = initial;
    if (initial) filterRequests(true);
  }
  updateCharacterCount(document.getElementById('project-title'));
  updateCharacterCount(document.getElementById('project-summary'));
})();
