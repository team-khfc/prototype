/* 화면 목록은 정적 HTML로 제공하고 검색과 축소 배치만 보완합니다. */
(() => {
  'use strict';

  const cards = Array.from(document.querySelectorAll('[data-screen-card]'));
  const form = document.getElementById('screen-filters');
  const search = document.getElementById('screen-search');
  const role = document.getElementById('screen-role');
  const count = document.getElementById('screen-count');
  const empty = document.getElementById('screen-empty');
  if (!form || !search || !role || !count || !empty) return;

  function applyFilters() {
    const query = search.value.trim().toLocaleLowerCase('ko');
    let visible = 0;
    for (const card of cards) {
      const matchesText = card.textContent.toLocaleLowerCase('ko').includes(query);
      const matchesRole =
        role.value === 'ALL' || card.dataset.roles.split(',').includes(role.value);
      card.hidden = !(matchesText && matchesRole);
      if (!card.hidden) visible += 1;
    }
    count.textContent = `${visible}개 화면 · 전체 ${cards.length}개`;
    empty.hidden = visible !== 0;
  }

  function resizePreview(container) {
    const frame = container.querySelector('iframe');
    if (!frame) return;
    const scale = container.clientWidth / 1920;
    frame.style.transform = `scale(${scale})`;
    container.style.height = `${Math.round(1080 * scale)}px`;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilters();
  });
  search.addEventListener('input', (event) => {
    if (!event.isComposing) applyFilters();
  });
  search.addEventListener('compositionend', applyFilters);
  role.addEventListener('change', applyFilters);
  form.addEventListener('reset', () => {
    requestAnimationFrame(() => {
      applyFilters();
      search.focus();
    });
  });
  const previews = Array.from(document.querySelectorAll('.studio-preview'));
  for (const preview of previews) resizePreview(preview);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) resizePreview(entry.target);
    });
    for (const preview of previews) observer.observe(preview);
  } else {
    window.addEventListener('resize', () => previews.forEach(resizePreview));
  }
})();
