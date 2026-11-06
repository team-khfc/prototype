/* 디자이너의 로컬 편집본만 다룹니다. 업무 API와 파일 자동 저장은 사용하지 않습니다. */
(function () {
  'use strict';

  if (new URLSearchParams(window.location.search).has('thumbnail')) return;

  const SCHEMA = 'boan-designer-kit/1';
  const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
  const MAX_TEXT_LENGTH = 6000;
  const MAX_FIELD_LENGTH = 20000;
  const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
  const IGNORED_TEXT =
    'script, style, noscript, template, svg, math, textarea, select, option, title, ' +
    '[data-designer-ui], [data-design-ignore], [data-design-lock]';
  const TOKEN_SPECS = [
    ['--sf-primary', '주요 버튼', 'color', '#256ef4'],
    ['--sf-primary-hover', '주요 버튼 · 마우스 올림', 'color', '#0b50d0'],
    ['--sf-primary-pressed', '주요 버튼 · 누름', 'color', '#083891'],
    ['--sf-primary-text', '강조 문구', 'color', '#0b50d0'],
    ['--sf-primary-soft', '강조 배경', 'color', '#ecf2fe'],
    ['--sf-focus', '키보드 초점', 'color', '#256ef4'],
    ['--sf-background', '화면 배경', 'color', '#f4f5f6'],
    ['--sf-surface', '패널 배경', 'color', '#ffffff'],
    ['--sf-text', '본문 문구', 'color', '#1e2124'],
    ['--sf-muted', '보조 문구', 'color', '#464c53'],
    ['--sf-border', '구분선', 'color', '#cdd1d5'],
    ['--sf-radius', '패널 모서리 · px', 'size', '10px', 0, 24, 1],
    ['--sf-body-size', '본문 크기 · px', 'size', '17px', 16, 24, 1],
    ['--sf-panel-space', '패널 안쪽 간격 · px', 'size', '24px', 16, 48, 4],
  ];

  function start() {
    if (document.querySelector('[data-designer-ui="toolbar"]')) return;
    if (document.body.dataset.designer === 'off') return;

    const textTargets = new Map();
    const fieldTargets = new Map();
    const screenId = document.body.dataset.screen || 'design-screen.html';
    const base = document.body.dataset.base || '';
    const filename = safeFilename(screenId);
    const state = {
      editing: false,
      revision: 0,
      importSequence: 0,
      tokens: readTokens(),
    };
    const initialTokens = { ...state.tokens };
    let toolbar;
    let status;
    let editButton;
    let tokenDialog;
    let contrastOutput;
    const tokenControls = new Map();

    prepareTextTargets();
    prepareFieldTargets();
    const structure = describeStructure();
    buildToolbar();
    buildTokenDialog();
    installEditingEvents();

    function element(tag, attributes, text) {
      const node = document.createElement(tag);
      for (const [key, value] of Object.entries(attributes || {})) {
        node.setAttribute(key, String(value));
      }
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function button(text, action, id, primary) {
      const node = element(
        'button',
        {
          type: 'button',
          class: 'dg-button' + (primary ? ' dg-button-primary' : ''),
          'data-dg-action': id,
        },
        text,
      );
      node.addEventListener('click', action);
      return node;
    }

    function announce(message, error) {
      status.textContent = message;
      status.classList.toggle('dg-status-error', Boolean(error));
    }

    function markChanged() {
      state.revision += 1;
      announce('변경 내용이 이 화면에만 반영되었습니다. HTML 또는 JSON을 내려받아 보관해 주세요.');
    }

    function prepareTextTargets() {
      const known = document.querySelectorAll('[data-design-text]');
      for (const target of known) {
        if (target.closest(IGNORED_TEXT) || target.childElementCount) continue;
        const id = target.dataset.designText;
        if (/^t\d{5}$/.test(id) && !textTargets.has(id)) textTargets.set(id, target);
        else target.removeAttribute('data-design-text');
      }
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
          if (parent.closest(IGNORED_TEXT + ', [data-design-text]')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const nodes = [];
      let current;
      while ((current = walker.nextNode())) nodes.push(current);
      let sequence = 1;
      for (const node of nodes) {
        let id;
        do {
          id = 't' + String(sequence++).padStart(5, '0');
        } while (textTargets.has(id));
        // 원본의 넓은 span 선택자가 중첩 배경·간격을 만들지 않도록 인라인 전용 요소를 씁니다.
        const span = element('design-text', { 'data-design-text': id }, node.textContent);
        node.replaceWith(span);
        textTargets.set(id, span);
      }
    }

    function prepareFieldTargets() {
      let sequence = 1;
      const fields = document.querySelectorAll('input, textarea, select');
      for (const field of fields) {
        if (field.closest('[data-designer-ui], [data-design-ignore], [data-design-lock]')) continue;
        if (
          field.tagName === 'INPUT' &&
          /^(file|password|hidden|submit|reset|button|image)$/.test(field.type)
        )
          continue;
        let id = field.dataset.designField;
        if (!/^f\d{5}$/.test(id || '') || fieldTargets.has(id)) {
          do {
            id = 'f' + String(sequence++).padStart(5, '0');
          } while (fieldTargets.has(id));
          field.dataset.designField = id;
        }
        fieldTargets.set(id, field);
      }
    }

    function describeStructure() {
      return JSON.stringify({
        text: Array.from(textTargets, ([id, target]) => [id, target.parentElement.tagName]).sort(
          (first, second) => first[0].localeCompare(second[0]),
        ),
        field: Array.from(fieldTargets, ([id, target]) => [
          id,
          target.tagName,
          target.getAttribute('type') || '',
          target.id,
          target.tagName === 'SELECT' ? Array.from(target.options, (option) => option.value) : null,
        ]).sort((first, second) => first[0].localeCompare(second[0])),
      });
    }

    function buildToolbar() {
      toolbar = element('section', {
        class: 'dg-toolbar',
        'data-designer-ui': 'toolbar',
        'aria-label': '디자이너 편집 도구',
      });
      const heading = element('div', { class: 'dg-toolbar-heading' });
      heading.append(
        element('a', { class: 'dg-brand', href: base + 'index.html' }, '보안길잡이 · 디자인 작업'),
      );
      heading.append(element('span', { class: 'dg-screen-name' }, screenId));
      const guide = element(
        'a',
        { class: 'dg-guide', href: base + 'docs/DESIGN_GUIDE.html' },
        '작업 가이드',
      );
      heading.append(guide);
      const reveal = button(
        '편집 도구 열기',
        () => {
          toolbar.hidden = false;
          reveal.hidden = true;
          editButton.focus();
        },
        'show-tools',
      );
      reveal.classList.add('dg-reveal');
      reveal.dataset.designerUi = 'reveal';
      reveal.hidden = true;
      heading.append(
        button(
          '도구 접기',
          () => {
            setEditing(false);
            toolbar.hidden = true;
            reveal.hidden = false;
            reveal.focus();
          },
          'hide-tools',
        ),
      );
      toolbar.append(heading);
      toolbar.append(
        element(
          'p',
          { class: 'dg-toolbar-help' },
          '문구·입력값·토큰을 수정한 뒤 파일로 내려받으세요. 원본 파일에 자동 저장되지 않습니다.',
        ),
      );
      const actions = element('div', { class: 'dg-actions' });
      editButton = button('문구 편집 켜기', () => setEditing(!state.editing), 'edit', true);
      editButton.setAttribute('aria-pressed', 'false');
      actions.append(editButton);
      actions.append(
        button(
          '디자인 토큰',
          () => {
            syncTokenControls();
            tokenDialog.showModal();
            tokenControls.get('--sf-primary').input.focus();
          },
          'tokens',
        ),
      );
      actions.append(button('HTML 내려받기', exportHtml, 'export-html'));
      actions.append(button('변경본 백업', exportBackup, 'export-backup'));
      const importFile = element('input', {
        type: 'file',
        accept: '.json,application/json',
        hidden: '',
        'aria-label': '변경본 JSON 백업 선택',
        'data-designer-ui': 'import-file',
      });
      const importButton = button('백업 불러오기', () => importFile.click(), 'import-backup');
      importFile.addEventListener('change', async () => {
        const file = importFile.files && importFile.files[0];
        if (!file) return;
        const revision = state.revision;
        const sequence = ++state.importSequence;
        importButton.disabled = true;
        try {
          if (!/\.json$/i.test(file.name) || file.size > MAX_BACKUP_BYTES) {
            throw new Error('2 MiB 이하의 JSON 백업 파일을 선택해 주세요.');
          }
          const bytes = await file.arrayBuffer();
          const contents = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          const backup = JSON.parse(contents);
          validateBackup(backup);
          if (sequence !== state.importSequence || revision !== state.revision) {
            throw new Error(
              '파일을 읽는 동안 화면이 바뀌었습니다. 현재 내용을 보관한 뒤 다시 불러와 주세요.',
            );
          }
          applyBackup(backup);
          announce(
            '이 화면의 문구·입력값·토큰을 백업에서 불러왔습니다. 파일을 수정하려면 HTML을 내려받으세요.',
          );
        } catch (error) {
          const message =
            error instanceof Error && error.name === 'Error'
              ? error.message
              : '백업을 읽지 못했습니다. 이 화면에서 내려받은 UTF-8 JSON 파일인지 확인해 주세요.';
          announce(message, true);
        } finally {
          importFile.value = '';
          importButton.disabled = false;
        }
      });
      const standaloneButton = button('단독 시안', exportStandalone, 'export-standalone');
      standaloneButton.title =
        '기본 CSS와 현재 문구·토큰을 담습니다. CSS 파일을 직접 고쳤다면 전체 폴더를 전달하세요.';
      actions.append(importButton, standaloneButton);
      toolbar.append(actions, importFile);
      status = element(
        'p',
        {
          class: 'dg-status',
          role: 'status',
          'aria-live': 'polite',
          'aria-atomic': 'true',
        },
        '새로고침하거나 다른 화면으로 이동하기 전에 변경본을 내려받으세요.',
      );
      toolbar.append(status);
      document.body.prepend(toolbar);
      document.body.append(reveal);
    }

    function setEditing(enabled) {
      state.editing = enabled;
      document.documentElement.dataset.designEditing = String(enabled);
      editButton.textContent = enabled ? '문구 편집 끄기' : '문구 편집 켜기';
      editButton.setAttribute('aria-pressed', String(enabled));
      for (const target of textTargets.values()) {
        if (enabled) {
          target.setAttribute('contenteditable', 'plaintext-only');
          target.setAttribute('tabindex', '0');
          target.setAttribute('role', 'textbox');
          target.setAttribute('aria-label', '시안 문구 편집');
          target.setAttribute('spellcheck', 'false');
        } else clearEditingAttributes(target);
      }
      announce(
        enabled
          ? '화면 문구를 클릭하거나 Tab으로 이동해 수정하세요. 링크와 업무 버튼의 실행은 멈춥니다. Escape로 편집을 마칩니다.'
          : '문구 편집을 마쳤습니다. 변경 내용은 아직 원본 파일에 저장되지 않았습니다.',
      );
    }

    function clearEditingAttributes(target) {
      for (const name of ['contenteditable', 'tabindex', 'role', 'aria-label', 'spellcheck']) {
        target.removeAttribute(name);
      }
    }

    function installEditingEvents() {
      document.addEventListener(
        'click',
        (event) => {
          if (!state.editing || !(event.target instanceof Element)) return;
          if (event.target.closest('[data-designer-ui]')) return;
          const textTarget = event.target.closest('[data-design-text]');
          if (
            event.target.closest('a, button, label') &&
            !event.target.matches('input, select, textarea')
          ) {
            event.preventDefault();
            if (textTarget) textTarget.focus();
          }
          event.stopImmediatePropagation();
        },
        true,
      );
      document.addEventListener(
        'submit',
        (event) => {
          if (state.editing && !event.target.closest('[data-designer-ui]')) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        },
        true,
      );
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.editing && !tokenDialog.open) {
          event.preventDefault();
          setEditing(false);
          editButton.focus();
        }
      });
      document.addEventListener('beforeinput', (event) => {
        if (!state.editing || !(event.target instanceof Element)) return;
        if (event.target.closest('[data-design-text]') && event.inputType.startsWith('format'))
          event.preventDefault();
      });
      document.addEventListener('paste', (event) => {
        if (!state.editing || !(event.target instanceof Element)) return;
        const target = event.target.closest('[data-design-text]');
        if (!target || !event.clipboardData) return;
        event.preventDefault();
        const pasted = event.clipboardData
          .getData('text/plain')
          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (!target.contains(range.commonAncestorContainer)) return;
        const available = MAX_TEXT_LENGTH - target.textContent.length + range.toString().length;
        const inserted = document.createTextNode(pasted.slice(0, Math.max(0, available)));
        range.deleteContents();
        range.insertNode(inserted);
        range.setStartAfter(inserted);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        markChanged();
      });
      document.addEventListener('drop', (event) => {
        if (
          state.editing &&
          event.target instanceof Element &&
          event.target.closest('[data-design-text]')
        ) {
          event.preventDefault();
          announce(
            '문구에는 일반 텍스트만 붙여넣을 수 있습니다. 파일이나 HTML을 끌어 넣지 않습니다.',
            true,
          );
        }
      });
      document.addEventListener('input', (event) => {
        if (!(event.target instanceof Element) || event.target.closest('[data-designer-ui]'))
          return;
        const target = event.target.closest('[data-design-text]');
        if (target && state.editing) {
          if (target.children.length || target.textContent.length > MAX_TEXT_LENGTH) {
            target.textContent = target.textContent.slice(0, MAX_TEXT_LENGTH);
          }
          markChanged();
        } else if (event.target.matches('[data-design-field]')) markChanged();
      });
      document.addEventListener('change', (event) => {
        if (event.target instanceof Element && event.target.matches('[data-design-field]')) {
          if (event.target.type === 'checkbox' && !event.target.indeterminate) {
            event.target.removeAttribute('data-design-indeterminate');
          }
          markChanged();
        }
      });
    }

    function readTokens() {
      const computed = getComputedStyle(document.documentElement);
      const values = {};
      for (const spec of TOKEN_SPECS) {
        const raw = computed.getPropertyValue(spec[0]).trim();
        values[spec[0]] = validToken(spec, raw) ? raw.toLowerCase() : spec[3];
      }
      return values;
    }

    function validToken(spec, value) {
      if (typeof value !== 'string') return false;
      if (spec[2] === 'color') return /^#[0-9a-f]{6}$/i.test(value);
      if (!/^\d{1,2}px$/.test(value)) return false;
      const number = Number.parseInt(value, 10);
      return number >= spec[4] && number <= spec[5] && number % spec[6] === 0;
    }

    function tokenCss(tokens) {
      return (
        '/* 보안길잡이 디자인 수정값 · KRDS 공급 원본은 유지합니다. */\n:root {\n' +
        TOKEN_SPECS.map((spec) => '  ' + spec[0] + ': ' + tokens[spec[0]] + ';').join('\n') +
        '\n}\n' +
        (tokens['--sf-body-size'] !== '17px'
          ? 'body { font-size: var(--sf-body-size, 17px); }\n'
          : '') +
        (tokens['--sf-panel-space'] !== '24px'
          ? '.sf-panel:not(.list-panel) { padding: var(--sf-panel-space, 24px); }\n'
          : '')
      );
    }

    function applyTokens() {
      let style = document.getElementById('design-overrides');
      if (!style) {
        style = element('style', { id: 'design-overrides' });
        document.head.append(style);
      }
      style.textContent = tokenCss(state.tokens);
      updateContrast();
    }

    function buildTokenDialog() {
      tokenDialog = element('dialog', {
        class: 'dg-dialog',
        'data-designer-ui': 'tokens',
        'aria-labelledby': 'dg-token-title',
        'aria-describedby': 'dg-token-description',
      });
      const heading = element('div', { class: 'dg-dialog-heading' });
      heading.append(element('h2', { id: 'dg-token-title' }, '디자인 토큰'));
      const close = button('닫기', () => tokenDialog.close(), 'close-tokens');
      close.setAttribute('aria-label', '디자인 토큰 닫기');
      close.classList.add('dg-dialog-close');
      tokenDialog.append(heading);
      tokenDialog.append(
        element(
          'p',
          { id: 'dg-token-description', class: 'dg-dialog-description' },
          '유효한 값을 입력하면 현재 화면에 바로 반영됩니다. 전체 화면에 적용하려면 CSS를 내려받아 assets/css/design-overrides.css를 교체하세요.',
        ),
      );
      const grid = element('div', { class: 'dg-token-grid' });
      for (let index = 0; index < TOKEN_SPECS.length; index += 1) {
        const spec = TOKEN_SPECS[index];
        const row = element('div', { class: 'dg-token-field' });
        const id = 'dg-token-' + index;
        row.append(element('label', { for: id }, spec[1]));
        const controls = element('div', { class: 'dg-token-controls' });
        const input = element('input', {
          id,
          type: spec[2] === 'color' ? 'text' : 'number',
          'data-token': spec[0],
          'aria-describedby': id + '-help',
          autocomplete: 'off',
          spellcheck: 'false',
        });
        let picker;
        if (spec[2] === 'color') {
          input.maxLength = 7;
          input.pattern = '#[0-9A-Fa-f]{6}';
          picker = element('input', {
            type: 'color',
            'aria-label': spec[1] + ' 색상 선택',
          });
          picker.addEventListener('input', () => {
            input.value = picker.value;
            changeToken();
          });
          controls.append(picker);
        } else {
          input.min = String(spec[4]);
          input.max = String(spec[5]);
          input.step = String(spec[6]);
        }
        function changeToken() {
          const value = spec[2] === 'color' ? input.value.toLowerCase() : input.value + 'px';
          const valid = validToken(spec, value);
          input.setAttribute('aria-invalid', String(!valid));
          input.setCustomValidity(valid ? '' : '표시된 형식과 범위에 맞는 값을 입력해 주세요.');
          if (!valid) return;
          if (picker) picker.value = value;
          state.tokens[spec[0]] = value;
          applyTokens();
          markChanged();
        }
        input.addEventListener('input', changeToken);
        controls.append(input);
        row.append(controls);
        row.append(
          element(
            'small',
            { id: id + '-help' },
            spec[2] === 'color'
              ? spec[0] + ' · #RRGGBB'
              : spec[0] + ' · ' + spec[4] + '–' + spec[5] + 'px / ' + spec[6] + 'px 간격',
          ),
        );
        grid.append(row);
        tokenControls.set(spec[0], { input, picker, spec });
      }
      tokenDialog.append(grid);
      contrastOutput = element('p', { class: 'dg-contrast' });
      tokenDialog.append(contrastOutput);
      tokenDialog.append(
        element(
          'p',
          { class: 'dg-dialog-note' },
          '대비 수치는 이 두 색 조합만 계산한 참고값입니다. 상태·강조 문구·초점과 실제 화면은 별도로 확인하세요.',
        ),
      );
      const actions = element('div', { class: 'dg-dialog-actions' });
      actions.append(
        button(
          '이 화면의 초기값',
          () => {
            state.tokens = { ...initialTokens };
            applyTokens();
            syncTokenControls();
            markChanged();
          },
          'reset-tokens',
        ),
      );
      actions.append(
        button(
          '토큰 CSS 내려받기',
          () => {
            download('design-overrides.css', tokenCss(state.tokens), 'text/css;charset=utf-8');
            announce(
              'CSS 다운로드를 요청했습니다. assets/css/design-overrides.css 교체 후 다른 화면을 다시 열어 적용하세요.',
            );
          },
          'export-css',
          true,
        ),
      );
      // 읽기 순서는 제목·내용·행동·닫기이며, 닫기의 시각 위치만 CSS로 옮깁니다.
      tokenDialog.append(actions, close);
      tokenDialog.addEventListener('close', () => {
        const opener = toolbar.querySelector('[data-dg-action="tokens"]');
        if (opener) opener.focus();
      });
      document.body.append(tokenDialog);
      syncTokenControls();
    }

    function syncTokenControls() {
      for (const [name, control] of tokenControls) {
        control.input.value =
          control.spec[2] === 'color'
            ? state.tokens[name]
            : String(Number.parseInt(state.tokens[name], 10));
        control.input.setCustomValidity('');
        control.input.setAttribute('aria-invalid', 'false');
        if (control.picker) control.picker.value = state.tokens[name];
      }
      updateContrast();
    }

    function updateContrast() {
      if (!contrastOutput) return;
      const bodyRatio = contrast(state.tokens['--sf-text'], state.tokens['--sf-background']);
      const buttonRatio = contrast('#ffffff', state.tokens['--sf-primary']);
      const low = bodyRatio < 4.5 || buttonRatio < 4.5;
      contrastOutput.textContent =
        '본문/배경 ' +
        bodyRatio.toFixed(2) +
        ':1 · 주요 버튼/흰 글자 ' +
        buttonRatio.toFixed(2) +
        ':1' +
        (low
          ? ' — 일반 크기 글자의 4.5:1 기준보다 낮은 조합이 있습니다.'
          : ' — 두 조합 모두 4.5:1 이상입니다.');
      contrastOutput.classList.toggle('dg-contrast-low', low);
    }

    function contrast(first, second) {
      function luminance(color) {
        const values = [1, 3, 5]
          .map((start) => Number.parseInt(color.slice(start, start + 2), 16) / 255)
          .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      }
      const a = luminance(first);
      const b = luminance(second);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }

    function fieldState(field) {
      if (field.tagName === 'SELECT') {
        return {
          kind: 'select',
          selected: Array.from(field.options).flatMap((option, index) =>
            option.selected ? [index] : [],
          ),
        };
      }
      if (field.type === 'checkbox' || field.type === 'radio') {
        return {
          kind: 'checked',
          checked: field.checked,
          indeterminate: field.indeterminate,
        };
      }
      return { kind: 'value', value: field.value };
    }

    function backupData() {
      return {
        schema: SCHEMA,
        screenId,
        structure,
        savedAt: new Date().toISOString(),
        tokens: { ...state.tokens },
        texts: Object.fromEntries(
          Array.from(textTargets, ([id, target]) => [id, target.textContent]),
        ),
        fields: Object.fromEntries(
          Array.from(fieldTargets, ([id, field]) => [id, fieldState(field)]),
        ),
      };
    }

    function exactKeys(object, keys) {
      return (
        plainObject(object) &&
        Object.keys(object).length === keys.length &&
        keys.every((key) => Object.prototype.hasOwnProperty.call(object, key))
      );
    }

    function validateBackup(data) {
      if (
        !exactKeys(data, [
          'schema',
          'screenId',
          'structure',
          'savedAt',
          'tokens',
          'texts',
          'fields',
        ]) ||
        data.schema !== SCHEMA
      ) {
        throw new Error('지원하는 보안길잡이 디자인 백업 형식이 아닙니다.');
      }
      if (data.screenId !== screenId || data.structure !== structure) {
        throw new Error(
          '현재 화면과 구조가 다른 백업입니다. 백업을 만든 같은 화면 파일에서 불러와 주세요.',
        );
      }
      if (
        typeof data.savedAt !== 'string' ||
        data.savedAt.length > 40 ||
        !Number.isFinite(Date.parse(data.savedAt))
      ) {
        throw new Error('백업의 생성 정보가 올바르지 않습니다.');
      }
      if (
        !exactKeys(
          data.tokens,
          TOKEN_SPECS.map((spec) => spec[0]),
        ) ||
        !TOKEN_SPECS.every((spec) => validToken(spec, data.tokens[spec[0]]))
      ) {
        throw new Error('백업에 허용하지 않은 색상·크기 토큰이 있습니다.');
      }
      if (
        !exactKeys(data.texts, Array.from(textTargets.keys())) ||
        !Object.values(data.texts).every((value) => safeText(value, MAX_TEXT_LENGTH))
      ) {
        throw new Error('백업의 문구 식별자 또는 문구 길이가 현재 화면과 맞지 않습니다.');
      }
      if (!exactKeys(data.fields, Array.from(fieldTargets.keys()))) {
        throw new Error('백업의 입력 필드가 현재 화면과 맞지 않습니다.');
      }
      for (const [id, field] of fieldTargets) {
        const value = data.fields[id];
        const kind = fieldState(field).kind;
        let valid = false;
        if (
          kind === 'select' &&
          exactKeys(value, ['kind', 'selected']) &&
          value.kind === kind &&
          Array.isArray(value.selected)
        ) {
          valid =
            value.selected.length <= (field.multiple ? field.options.length : 1) &&
            new Set(value.selected).size === value.selected.length &&
            value.selected.every(
              (index) => Number.isInteger(index) && index >= 0 && index < field.options.length,
            );
        } else if (kind === 'checked' && exactKeys(value, ['kind', 'checked', 'indeterminate'])) {
          valid =
            value.kind === kind &&
            typeof value.checked === 'boolean' &&
            typeof value.indeterminate === 'boolean';
        } else if (
          kind === 'value' &&
          exactKeys(value, ['kind', 'value']) &&
          value.kind === kind &&
          safeText(value.value, MAX_FIELD_LENGTH)
        ) {
          const test = field.cloneNode(true);
          test.value = value.value;
          valid = test.value === value.value;
        }
        if (!valid) throw new Error('백업에 현재 입력 필드와 맞지 않는 값이 있습니다.');
      }
    }

    function applyBackup(data) {
      for (const [id, target] of textTargets) target.textContent = data.texts[id];
      for (const [id, field] of fieldTargets) {
        const value = data.fields[id];
        if (value.kind === 'select') {
          Array.from(field.options).forEach((option, index) => {
            option.selected = value.selected.includes(index);
          });
          if (!value.selected.length) field.selectedIndex = -1;
        } else if (value.kind === 'checked') {
          field.checked = value.checked;
          field.indeterminate = value.indeterminate;
        } else field.value = value.value;
      }
      state.tokens = { ...data.tokens };
      applyTokens();
      syncTokenControls();
      state.revision += 1;
    }

    function exportBackup() {
      const data = backupData();
      try {
        validateBackup(data);
        download(
          filename.replace(/\.html$/i, '.design.json'),
          JSON.stringify(data, null, 2) + '\n',
          'application/json;charset=utf-8',
        );
        announce(
          'JSON 백업 다운로드를 요청했습니다. 문구·입력값·토큰을 같은 화면에서 복원할 수 있습니다.',
        );
      } catch (error) {
        announce(error instanceof Error ? error.message : '백업을 만들지 못했습니다.', true);
      }
    }

    function copyCurrentDocument() {
      const clone = document.documentElement.cloneNode(true);
      const liveFields = document.querySelectorAll('input, textarea, select');
      const cloneFields = clone.querySelectorAll('input, textarea, select');
      // 도구 필드를 제거하기 전에 같은 DOM 순서로 현재 값을 직렬화합니다.
      liveFields.forEach((source, index) => {
        const target = cloneFields[index];
        if (source.tagName === 'TEXTAREA') target.textContent = source.value;
        else if (source.tagName === 'SELECT') {
          Array.from(target.options).forEach((option, optionIndex) =>
            option.toggleAttribute('selected', source.options[optionIndex].selected),
          );
          if (source.selectedIndex === -1) target.setAttribute('data-design-no-selection', 'true');
          else target.removeAttribute('data-design-no-selection');
        } else if (source.type === 'checkbox' || source.type === 'radio') {
          target.toggleAttribute('checked', source.checked);
          if (source.indeterminate) target.setAttribute('data-design-indeterminate', 'true');
          else target.removeAttribute('data-design-indeterminate');
        } else if (source.type !== 'file' && source.type !== 'password')
          target.setAttribute('value', source.value);
      });
      clone.removeAttribute('data-design-editing');
      clone.querySelectorAll('[data-designer-ui]').forEach((node) => node.remove());
      clone.querySelectorAll('[data-design-text]').forEach(clearEditingAttributes);
      clone.querySelectorAll('dialog[open]').forEach((dialog) => dialog.removeAttribute('open'));
      // 파일 선택 경로와 비밀번호는 시안 파일에 복제하지 않습니다.
      clone
        .querySelectorAll('input[type="file"], input[type="password"]')
        .forEach((field) => field.removeAttribute('value'));
      return clone;
    }

    function exportHtml() {
      const clone = copyCurrentDocument();
      download(filename, '<!doctype html>\n' + clone.outerHTML + '\n', 'text/html;charset=utf-8');
      announce(
        'HTML 다운로드를 요청했습니다. 기존 파일과 같은 폴더 위치에 놓아 주세요. 원본은 자동으로 덮어쓰지 않습니다.',
      );
    }

    function exportStandalone() {
      const assets = window.BOAN_DESIGN_ASSETS;
      if (
        !assets ||
        typeof assets.cssText !== 'string' ||
        assets.cssText.length > 4 * 1024 * 1024
      ) {
        announce(
          '단독 시안용 자산을 불러오지 못했습니다. 패키지의 assets 폴더가 함께 있는지 확인해 주세요.',
          true,
        );
        return;
      }
      const clone = copyCurrentDocument();
      clone
        .querySelectorAll('script, link, base, iframe, object, embed, audio, video')
        .forEach((node) => node.remove());
      clone.querySelectorAll('*').forEach((node) => {
        Array.from(node.attributes).forEach((attribute) => {
          if (attribute.name.startsWith('on')) node.removeAttribute(attribute.name);
        });
      });
      const head = clone.querySelector('head');
      const sheet = element('style', { id: 'dg-standalone-styles' }, assets.cssText);
      const firstStyle = head.querySelector('style');
      if (firstStyle) firstStyle.before(sheet);
      else head.append(sheet);
      // 공통 CSS에서 읽은 초기 토큰도 단독 파일에 보존하고, 열린 원본 문서는 바꾸지 않습니다.
      let overrides = clone.querySelector('#design-overrides');
      if (!overrides) {
        overrides = element('style', { id: 'design-overrides' });
        head.append(overrides);
      }
      overrides.textContent = tokenCss(state.tokens);
      head.prepend(
        element('meta', {
          'http-equiv': 'Content-Security-Policy',
          content:
            "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; form-action 'none'; base-uri 'none';",
        }),
      );
      clone.querySelectorAll('a[href]').forEach((link) => {
        if (!link.getAttribute('href').startsWith('#')) {
          link.removeAttribute('href');
          link.setAttribute('aria-disabled', 'true');
          link.setAttribute('title', '정적 시안에서는 다른 화면으로 이동하지 않습니다.');
        }
      });
      clone.querySelectorAll('button').forEach((control) => control.setAttribute('type', 'button'));
      clone.querySelectorAll('form').forEach((form) => {
        form.removeAttribute('action');
        form.setAttribute('method', 'dialog');
      });
      const note = element(
        'div',
        { class: 'dg-static-note' },
        '정적 디자인 시안 · 합성 자료 · 화면 이동·저장·전송 기능 없음',
      );
      clone.querySelector('body').prepend(note);
      download(
        filename.replace(/\.html$/i, '-standalone.html'),
        '<!doctype html>\n' + clone.outerHTML + '\n',
        'text/html;charset=utf-8',
      );
      announce(
        '기본 CSS와 현재 문구·토큰으로 단독 시안 다운로드를 요청했습니다. CSS 파일을 직접 수정했다면 전체 폴더를 전달하세요.',
      );
    }

    function download(name, contents, type) {
      const url = URL.createObjectURL(new Blob([contents], { type }));
      const link = element('a', {
        href: url,
        download: name,
        hidden: '',
        'data-designer-ui': 'download',
      });
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    for (const field of fieldTargets.values()) {
      if (field.dataset.designIndeterminate === 'true' && field.type === 'checkbox')
        field.indeterminate = true;
      if (field.dataset.designNoSelection === 'true' && field.tagName === 'SELECT')
        field.selectedIndex = -1;
    }
  }

  function safeFilename(screenId) {
    const basename = String(screenId).split('/').pop();
    return /^[a-z0-9][a-z0-9._-]{0,120}\.html$/i.test(basename) ? basename : 'design-screen.html';
  }

  function plainObject(value) {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  function safeText(value, maximum) {
    return typeof value === 'string' && value.length <= maximum && !CONTROL_CHARACTERS.test(value);
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
