/* 디자인 검토용 UI 동작. 인증·저장·AI·승인·기관 전송을 수행하지 않습니다. */
(() => {
  'use strict';
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  const base = document.body.dataset.base || '';
  const screen = document.body.dataset.screen || '';
  const dialog = $('#design-dialog');
  const content = $('#design-dialog-body');
  const actions = $('#design-dialog-actions');
  let opener;
  let toastTimer;
  let page = 1;
  let field = '전체';
  const tableRows = $$('.sf-table tbody tr');
  let pageSize = 6;

  function notify(message) {
    const toast = $('#design-toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 4500);
  }

  function openDialog(title, body, buttons = []) {
    opener = document.activeElement;
    $('#design-dialog-title').textContent = title;
    content.replaceChildren();
    if (typeof body === 'string') {
      const p = document.createElement('p');
      p.textContent = body;
      content.append(p);
    } else content.append(body);
    actions.replaceChildren();
    for (const definition of buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button' + (definition.primary ? ' primary' : '');
      button.textContent = definition.label;
      button.addEventListener('click', definition.run);
      actions.append(button);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'button';
    close.textContent = '닫기';
    close.addEventListener('click', () => dialog.close());
    actions.append(close);
    dialog.showModal();
  }

  function documentId(button) {
    return (
      button.closest('[data-document-id]')?.dataset.documentId ||
      (screen.startsWith('cases/') ? screen.split('/').pop().replace('.html', '') : 'SF-2026-0123')
    );
  }

  function documentContent(id) {
    return (
      (['11-receipt.html', '12-documents.html'].includes(screen)
        ? window.DESIGN_DATA.documents[id]
        : window.DESIGN_DATA.drafts[id]) || window.DESIGN_DATA.drafts['SF-2026-0123']
    );
  }

  function download(id) {
    const text = documentContent(id);
    const blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = id + '_디자인샘플.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function validate() {
    const invalid = $$('main [required]').filter((input) => !input.value.trim());
    $$('.handoff-errors').forEach((node) => node.remove());
    $$('main [aria-invalid]').forEach((input) => input.setAttribute('aria-invalid', 'false'));
    if (!invalid.length) return true;
    const box = document.createElement('div');
    box.className = 'sf-error-summary handoff-errors';
    box.tabIndex = -1;
    box.setAttribute('role', 'alert');
    const heading = document.createElement('strong');
    heading.textContent = '필수 입력 항목을 확인해 주세요.';
    const list = document.createElement('ul');
    invalid.forEach((input) => {
      input.setAttribute('aria-invalid', 'true');
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.textContent =
        document.querySelector(`label[for="${input.id}"]`)?.textContent || '필수 항목';
      link.href = '#' + input.id;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        input.focus();
      });
      item.append(link);
      list.append(item);
    });
    box.append(heading, list);
    ($('.form-main') || $('main')).prepend(box);
    box.focus();
    return false;
  }

  function filterRequests() {
    if (screen !== '02-requests.html') return;
    const query = ($('#list-search')?.value || '').trim().toLowerCase();
    const phase = $('#phase')?.value || '전체';
    const rows = tableRows.filter((row) => {
      const text = row.textContent.replace(/\s+/g, ' ').toLowerCase();
      return (
        text.includes(query) &&
        (phase === '전체' || text.includes(phase)) &&
        (field === '전체' ||
          !text.includes((field === 'SECURITY' ? '정보보안' : 'ICT인프라') + ' 완료'))
      );
    });
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    page = Math.max(1, Math.min(page, pages));
    tableRows.forEach((row) => {
      row.hidden = true;
    });
    rows.slice((page - 1) * pageSize, page * pageSize).forEach((row) => {
      row.hidden = false;
    });
    const result = $('.table-toolbar [role="status"]');
    if (result) result.textContent = `검색 결과 ${rows.length}건`;
    const pagination = $('.pagination');
    if (pagination) {
      $('span', pagination).textContent = `${page} / ${pages}페이지`;
      $$('button', pagination).forEach((button) => {
        const value = button.dataset.page;
        const n = Number(value);
        button.hidden = Number.isFinite(n) && n > pages;
        button.disabled = ['첫 페이지', '이전 페이지'].includes(value)
          ? page === 1
          : ['다음 페이지', '마지막 페이지'].includes(value)
            ? page === pages
            : false;
        if (Number.isFinite(n)) {
          button.classList.toggle('selected', n === page);
          if (n === page) button.setAttribute('aria-current', 'page');
          else button.removeAttribute('aria-current');
        }
      });
    }
    let empty = $('#request-empty');
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'request-empty';
      empty.className = 'empty-state';
      empty.textContent = '조건에 맞는 신청이 없습니다. 검색어와 상태를 변경해 주세요.';
      $('.table-scroll').after(empty);
    }
    empty.hidden = rows.length > 0;
  }

  function filterDocuments() {
    if (screen !== '12-documents.html') return;
    const query = $('#document-query').value.trim().toLowerCase();
    const status = $('#document-status').value;
    let count = 0;
    $$('.document-card').forEach((card) => {
      const submitted = $('.sf-badge', card).textContent.includes('제출본');
      const shown =
        card.textContent.toLowerCase().includes(query) &&
        (status === '전체' || (status === '제출본' ? submitted : !submitted));
      card.hidden = !shown;
      if (shown) count++;
    });
    $('.document-count').textContent = `문서 ${count}건 · 디자인 검토용 고정 샘플`;
    let empty = $('#document-empty');
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'document-empty';
      empty.className = 'sf-panel empty-state';
      empty.textContent = '조건에 맞는 문서가 없습니다. 검색 조건을 초기화해 주세요.';
      $('.document-grid').after(empty);
    }
    empty.hidden = count > 0;
  }

  const handlers = {
    navigate: (button) => {
      location.href = button.dataset.href;
    },
    next: (button) => {
      if (validate()) location.href = button.dataset.href;
    },
    menu: (button) => {
      const open = $('#side-nav').classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    },
    phase: (button) => {
      if (screen !== '02-requests.html') {
        location.href = base + '02-requests.html?phase=' + encodeURIComponent(button.dataset.phase);
      } else {
        $('#phase').value = button.dataset.phase;
        page = 1;
        filterRequests();
      }
    },
    search: () => {
      page = 1;
      filterRequests();
    },
    reset: () => {
      for (const selector of ['#list-search', '#document-query', '#date-start']) {
        if ($(selector)) $(selector).value = '';
      }
      if ($('#phase')) $('#phase').value = '전체';
      if ($('#document-status')) $('#document-status').value = '전체';
      page = 1;
      field = '전체';
      filterRequests();
      filterDocuments();
    },
    'field-filter': (button) => {
      field = button.dataset.field;
      page = 1;
      $$('.segmented button').forEach((b) => {
        b.classList.toggle('selected', b === button);
        b.setAttribute('aria-pressed', String(b === button));
      });
      filterRequests();
    },
    paginate: (button) => {
      const value = button.dataset.page;
      if (value === '첫 페이지') page = 1;
      else if (value === '이전 페이지') page--;
      else if (value === '다음 페이지') page++;
      else if (value === '마지막 페이지') page = Math.ceil(tableRows.length / pageSize);
      else page = Number(value);
      filterRequests();
    },
    'fill-sample': () => {
      $('#project-title').value = '차세대 업무포털 구축';
      $('#project-summary').value = window.DESIGN_DATA.summary;
      $$('input, textarea').forEach((input) =>
        input.dispatchEvent(new Event('input', { bubbles: true })),
      );
    },
    preview: (button) => {
      const id = documentId(button);
      const pre = document.createElement('pre');
      pre.className = 'document-preview';
      pre.textContent = documentContent(id);
      openDialog('문서 미리보기 · 디자인 샘플', pre, [
        { label: 'TXT 다운로드', primary: true, run: () => download(id) },
      ]);
    },
    download: (button) => {
      if (button.closest('.table-toolbar')) {
        notify(
          'CSV 내보내기는 원본 기능형 프로토타입에서 제공합니다. 이 패키지는 화면 편집용입니다.',
        );
      } else download(documentId(button));
    },
    'review-complete': () => {
      const panel = $('.review-panel');
      const checkboxes = $$('input[type="checkbox"]', panel);
      if (checkboxes.some((input) => !input.checked) || !$('#review-opinion')?.value.trim()) {
        openDialog(
          '검토 내용을 확인해 주세요',
          '체크리스트 3개와 검토 의견을 입력하면 완료 확인 화면을 볼 수 있습니다.',
        );
      } else
        openDialog(
          '사전 협의 완료 확인',
          '디자인 검토용 확인 대화상자입니다. 실제 검토 상태는 저장하거나 변경하지 않습니다.',
          [{ label: '확인 화면 닫기', primary: true, run: () => dialog.close() }],
        );
    },
    supplement: () => {
      const section = document.createElement('div');
      section.innerHTML =
        '<div class="sf-field"><label for="demo-supplement-field">대상 항목</label><input id="demo-supplement-field" placeholder="예: 개인정보 보유기간"></div><div class="sf-field"><label for="demo-supplement-reason">보완 이유</label><textarea id="demo-supplement-reason" rows="4"></textarea></div><p>입력 UI 예시입니다. 신청자에게 전송되지 않습니다.</p>';
      openDialog('보완 요청 작성', section, [
        {
          label: '신청자 보완 화면 보기',
          primary: true,
          run: () => {
            location.href = base + '09-supplement.html';
          },
        },
      ]);
    },
    'supplement-answer': () =>
      openDialog(
        '보완 답변 확인',
        '답변 UI 검토가 끝나면 담당자 재검토 화면을 확인하세요. 이 편집본에서는 입력을 저장하지 않습니다.',
        [
          {
            label: '담당자 검토 화면',
            primary: true,
            run: () => {
              location.href = base + '07-security-review.html';
            },
          },
        ],
      ),
    submit: () =>
      openDialog(
        '최종 제출 확인',
        '신청번호 SF-2026-0123 · 미확정 0개 · 미해결 보완 0건. 고정 샘플의 완료 화면을 확인합니다. 실제 기관 전송은 없습니다.',
        [
          {
            label: '제출 완료 화면 보기',
            primary: true,
            run: () => {
              location.href = base + '11-receipt.html';
            },
          },
        ],
      ),
    consult: () =>
      openDialog(
        '사전 협의 요청 확인',
        '작성 단계의 확인 대화상자입니다. 실제 요청은 등록하지 않고 담당자 화면으로 이동합니다.',
        [
          {
            label: '담당자 검토 화면 보기',
            primary: true,
            run: () => {
              location.href = base + '07-security-review.html';
            },
          },
        ],
      ),
    save: () =>
      openDialog(
        '저장 안내 · 디자인 시안',
        '저장 완료 문구와 버튼 위치를 검토하는 편집용 샘플입니다. 입력값을 파일이나 서버에 저장하지 않습니다.',
      ),
    publish: () =>
      openDialog(
        '기관 설정 게시 확인',
        '새 신청부터 적용하고 기존 신청은 이전 설정을 유지하는 확인 화면의 예시입니다. 실제 설정은 변경되지 않습니다.',
      ),
    analyze: () =>
      openDialog(
        'AI 분석 결과 예시',
        '현재 표시된 운영 환경·외부 연계·개인정보 정보는 고정된 합성 예시입니다. 파일 본문을 읽거나 외부로 전송하지 않습니다.',
      ),
    'sample-file': () => notify('시연_차세대_업무포털_사업계획서.txt · 840B · 디자인 샘플'),
    'file-name': (button) =>
      openDialog(
        '전체 파일명',
        button.closest('.file-row')?.querySelector('.file-name')?.textContent || '시연 사업계획서',
      ),
    'remove-file': (button) => {
      button.closest('.file-row')?.remove();
      notify('화면에서 선택 파일을 제거했습니다.');
    },
    display: () => {
      const fieldset = document.createElement('fieldset');
      fieldset.innerHTML = '<legend>글자 크기</legend>';
      [
        ['보통', '62.5%'],
        ['크게', '75%'],
        ['아주 크게 (200%)', '125%'],
      ].forEach(([label, size]) => {
        const row = document.createElement('label');
        row.className = 'checklist-item';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'demo-size';
        radio.checked = (document.documentElement.style.fontSize || '62.5%') === size;
        radio.addEventListener('change', () => {
          document.documentElement.style.fontSize = size;
        });
        row.append(radio, label);
        fieldset.append(row);
      });
      openDialog('화면 설정', fieldset);
    },
    help: () =>
      openDialog(
        '디자인 편집본 안내',
        'HTML 파일의 본문과 assets/css/의 스타일을 직접 수정할 수 있습니다. 역할·화면 전환, 검색, 모달, 필수값 검증과 TXT 샘플 다운로드만 동작합니다. 상태·권한·저장·AI·기관 전송은 구현하지 않았습니다.',
      ),
    notice: (button) =>
      openDialog(
        '디자인 상태 예시',
        `“${button.textContent.trim()}”의 화면 배치를 검토할 수 있습니다. 실제 업무 처리는 원본 애플리케이션에서 구현합니다.`,
      ),
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    event.preventDefault();
    button.focus();
    (handlers[button.dataset.action] || handlers.notice)(button);
  });
  $('[data-close]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('close', () => {
    if (opener?.isConnected) opener.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && $('#side-nav')?.classList.contains('open')) {
      $('#side-nav').classList.remove('open');
      $('[data-action="menu"]')?.setAttribute('aria-expanded', 'false');
    }
  });
  $('#role')?.addEventListener('change', (event) => {
    location.href =
      base +
      {
        SECURITY: '01-workspace.html',
        INFRA: '08-infra-review.html',
        APPLICANT: '03-request-basic.html',
        ADMIN: '13-admin-questions.html',
      }[event.target.value];
  });
  $('[aria-label="페이지당 표시 수"]')?.addEventListener('change', (event) => {
    pageSize = Number(event.target.value);
    page = 1;
    filterRequests();
  });
  $('#phase')?.addEventListener('change', () => {
    page = 1;
    filterRequests();
  });
  $('#document-query')?.addEventListener('input', filterDocuments);
  $('#document-status')?.addEventListener('change', filterDocuments);
  $('form.search-field')?.addEventListener('submit', (event) => {
    event.preventDefault();
    page = 1;
    filterRequests();
  });
  $$('input[maxlength], textarea[maxlength]').forEach((input) => {
    input.addEventListener('input', () => {
      const counter = input.parentElement.querySelector('.char-count');
      if (counter)
        counter.textContent = `${input.value.length} / ${Number(input.maxLength).toLocaleString()}자`;
    });
  });
  $('#file-input')?.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file)
      openDialog(
        '파일 선택 · 미전송',
        `${file.name} · ${file.size.toLocaleString()}B. 파일명과 크기만 확인했으며 본문을 읽거나 전송하지 않았습니다.`,
      );
  });
  if (screen === '02-requests.html') {
    const phase = new URLSearchParams(location.search).get('phase');
    if (phase && $$('#phase option').some((option) => option.value === phase))
      $('#phase').value = phase;
    filterRequests();
  }
})();
