(async function () {
  'use strict';

  const subjects = window.SUBJECTS || {};
  const order = window.SUBJECT_ORDER || Object.keys(subjects);
  const areas = window.AREA_ORDER || [];

  const state = {
    audience: 'grade1',
    area: 'all',
    category: 'all',
    suneung: 'all',
    semester: 'all',
    search: '',
  };

  const videoMap = {};

  const semesterLabels = {
    '2-1': '2학년 1학기',
    '2-2': '2학년 2학기',
    '3-1': '3학년 1학기',
    '3-2': '3학년 2학기',
  };

  const els = {
    search: document.getElementById('subject-search'),
    grid: document.getElementById('subject-grid'),
    count: document.getElementById('result-count'),
    chips: document.getElementById('area-chips'),
    semesterChips: document.getElementById('semester-chips'),
    category: document.getElementById('category-filter'),
    suneung: document.getElementById('suneung-filter'),
    empty: document.getElementById('empty-state'),
    modal: document.getElementById('subject-modal'),
    modalContent: document.getElementById('modal-content'),
  };

  let pdfjsLib = null;
  let pdfjsReady = null;

  function loadPdfRenderer() {
    if (pdfjsLib) return Promise.resolve(pdfjsLib);
    if (!pdfjsReady) {
      pdfjsReady = import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs')
        .then(module => {
          module.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
          pdfjsLib = module;
          queueThumbnailRendering();
          return module;
        })
        .catch(error => {
          console.warn('PDF 썸네일 렌더러를 불러오지 못했습니다.', error);
          return null;
        });
    }
    return pdfjsReady;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function pdfPath(subjectId) {
    const subject = subjects[subjectId];
    const index = order.indexOf(subjectId);
    const no = String(index + 1).padStart(2, '0');
    const filename = `${no}-${subject.area}-${subject.name}.pdf`;
    return `pdf-output/individual/${encodeURIComponent(filename)}`;
  }

  function posterImagePath(subjectId) {
    const subject = subjects[subjectId];
    const index = order.indexOf(subjectId);
    const no = String(index + 1).padStart(2, '0');
    const filename = `${no}-${subject.area}-${subject.name}.jpg`;
    return `poster-images/${encodeURIComponent(filename)}`;
  }

  function targetSemesters() {
    return state.audience === 'grade1'
      ? ['2-1', '2-2', '3-1', '3-2']
      : ['3-1', '3-2'];
  }

  function offeringKey(offering) {
    return `${offering.grade}-${offering.semester}`;
  }

  function subjectOfferingsInAudience(subject) {
    const allowed = new Set(targetSemesters());
    return (subject.offerings || []).filter(offering => allowed.has(offeringKey(offering)));
  }

  function formatOffering(offering) {
    if (!offering) return '';
    const credit = offering.creditsEach ? `${offering.creditsEach}학점` : '';
    const choice = offering.choose ? `${offering.choose}과목 선택` : '';
    return [semesterLabels[offeringKey(offering)], offering.groupLabel, choice, credit].filter(Boolean).join(' · ');
  }

  function getSearchBlob(subject) {
    return (subject.name || '').toLowerCase();
  }

  function passesFilters(subject) {
    if (!subjectOfferingsInAudience(subject).length) return false;
    if (state.semester !== 'all') {
      const keys = subjectOfferingsInAudience(subject).map(offeringKey);
      if (!keys.includes(state.semester)) return false;
    }
    if (state.area !== 'all' && subject.area !== state.area) return false;
    if (state.category !== 'all' && subject.category !== state.category) return false;
    if (state.suneung === 'suneung' && !subject.suneung) return false;
    if (state.suneung === 'non-suneung' && subject.suneung) return false;
    if (state.search && !getSearchBlob(subject).includes(state.search.toLowerCase())) return false;
    return true;
  }

  function renderPosterThumb(subjectId, subject, interactive = false) {
    const label = `${subject.name} 포스터`;
    const imageHref = posterImagePath(subjectId);
    const fallback = `
      <div class="thumb-fallback" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <span class="thumb-title">${escapeHtml(subject.name)}</span>
    `;
    if (interactive) {
      return `
        <a class="poster-thumb poster-thumb-link is-rendered" href="${imageHref}" target="_blank" rel="noopener" aria-label="${escapeHtml(label)} 이미지 열기">
          <img src="${imageHref}" alt="${escapeHtml(label)}">
          ${fallback}
        </a>
      `;
    }
    return `
      <div class="poster-thumb is-rendered" aria-label="${escapeHtml(label)} 썸네일">
        <img src="${imageHref}" alt="${escapeHtml(label)}">
        ${fallback}
      </div>
    `;
  }

  function renderKeywords(subject, limit = 4) {
    return (subject.keywords || [])
      .slice(0, limit)
      .map(keyword => `<span>${escapeHtml(keyword)}</span>`)
      .join('');
  }

  function renderCard(subjectId, semesterKey) {
    const subject = subjects[subjectId];
    const offering = (subject.offerings || []).find(item => offeringKey(item) === semesterKey) || subject.primaryOffering;
    return `
      <article class="subject-card" data-subject-id="${escapeHtml(subjectId)}">
        <div>
          ${renderPosterThumb(subjectId, subject)}
          <div class="subject-meta">
            <span class="area-badge">${escapeHtml(subject.area)}</span>
            <span class="category-text">${escapeHtml(subject.category)}</span>
          </div>
          <h3>${escapeHtml(subject.name)}</h3>
          <p>${escapeHtml(subject.description || '')}</p>
          <p class="offering-line">${escapeHtml(formatOffering(offering))}</p>
          <div class="keyword-row">${renderKeywords(subject)}</div>
        </div>
        <div class="card-actions">
          <button type="button" data-open-subject="${escapeHtml(subjectId)}">상세 보기</button>
        </div>
      </article>
    `;
  }

  function renderChips() {
    const visibleAreaSet = new Set(order
      .map(id => subjects[id])
      .filter(subject => subjectOfferingsInAudience(subject).length)
      .map(subject => subject.area));
    const chips = [
      { value: 'all', label: '전체' },
      ...areas
        .filter(area => visibleAreaSet.has(area))
        .map(area => ({ value: area, label: area })),
    ];
    if (state.area !== 'all' && !chips.some(chip => chip.value === state.area)) {
      state.area = 'all';
    }
    els.chips.innerHTML = chips.map(chip => `
      <button
        type="button"
        class="area-chip"
        role="option"
        aria-selected="${chip.value === state.area ? 'true' : 'false'}"
        data-area="${escapeHtml(chip.value)}"
      >${escapeHtml(chip.label)}</button>
    `).join('');
  }

  function renderSemesterChips() {
    const chips = [
      { value: 'all', label: '전체 학기' },
      ...targetSemesters().map(key => ({ value: key, label: semesterLabels[key] })),
    ];
    if (state.semester !== 'all' && !chips.some(chip => chip.value === state.semester)) {
      state.semester = 'all';
    }
    els.semesterChips.innerHTML = chips.map(chip => `
      <button
        type="button"
        class="semester-chip"
        role="option"
        aria-selected="${chip.value === state.semester ? 'true' : 'false'}"
        data-semester="${escapeHtml(chip.value)}"
      >${escapeHtml(chip.label)}</button>
    `).join('');
  }

  function groupedVisibleSubjects() {
    const groupKeys = state.semester === 'all' ? targetSemesters() : [state.semester];
    const groups = groupKeys.map(key => ({ key, ids: [] }));
    const seen = new Set();

    order.forEach(id => {
      const subject = subjects[id];
      if (!passesFilters(subject)) return;
      seen.add(id);
      const subjectKeys = new Set(subjectOfferingsInAudience(subject).map(offeringKey));
      groups.forEach(group => {
        if (subjectKeys.has(group.key)) group.ids.push(id);
      });
    });

    return { groups: groups.filter(group => group.ids.length), uniqueCount: seen.size };
  }

  function renderGrid() {
    const { groups, uniqueCount } = groupedVisibleSubjects();
    els.count.textContent = String(uniqueCount);
    els.grid.innerHTML = groups.map(group => `
      <section class="semester-section" aria-labelledby="semester-${group.key}">
        <div class="semester-heading">
          <h3 id="semester-${group.key}">${semesterLabels[group.key]}</h3>
          <span>${group.ids.length}개 과목</span>
        </div>
        <div class="subject-grid">
          ${group.ids.map(id => renderCard(id, group.key)).join('')}
        </div>
      </section>
    `).join('');
    els.empty.hidden = uniqueCount !== 0;
    queueThumbnailRendering();
  }

  function renderAll() {
    renderChips();
    renderSemesterChips();
    renderGrid();
  }

  function infoList(items, emptyText, limit = 12) {
    const list = (items || []).filter(Boolean).slice(0, limit);
    if (!list.length) return `<p class="description">${escapeHtml(emptyText)}</p>`;
    return `<ul class="info-list">${list.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function plainList(items, emptyText, limit = 16) {
    const list = (items || []).filter(Boolean).slice(0, limit);
    if (!list.length) return `<p class="description">${escapeHtml(emptyText)}</p>`;
    return `<ul class="plain-list">${list.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function explorationList(items) {
    const list = (items || []).filter(Boolean);
    if (!list.length) return '<p class="description">탐구 활동 정보가 준비 중입니다.</p>';
    return `
      <ul class="activity-list">
        ${list.map(item => `
          <li>
            <strong>${escapeHtml(String(item.task || '').replace(/\n/g, ' '))}</strong>
            ${plainList(item.examples || [], '예시 활동 정보가 준비 중입니다.', 4)}
          </li>
        `).join('')}
      </ul>
    `;
  }

  function renderVideo(subjectId) {
    const video = videoMap[subjectId];
    if (!video) {
      return '<div class="video-box">영상은 준비되는 대로 연결됩니다.</div>';
    }
    if (video.type === 'youtube') {
      return `<div class="video-box"><iframe src="${escapeHtml(video.src)}" title="과목 소개 영상" allowfullscreen></iframe></div>`;
    }
    return `
      <div class="video-box">
        <video controls preload="metadata" src="${escapeHtml(video.src)}"></video>
      </div>
    `;
  }

  function openSubject(subjectId) {
    const subject = subjects[subjectId];
    if (!subject) return;
    const offerings = subjectOfferingsInAudience(subject);
    const offeringText = offerings.length
      ? offerings.map(formatOffering).join('<br>')
      : (subject.offerings || []).map(formatOffering).join('<br>');

    els.modalContent.innerHTML = `
      <div class="detail">
        <div class="detail-grid">
          <div>
            ${renderVideo(subjectId)}
            <h2 id="modal-title">${escapeHtml(subject.name)}</h2>
            <p class="hook">${escapeHtml(subject.hook || '')}</p>
            <p class="description">${escapeHtml(subject.description || '')}</p>
            <dl class="meta-table">
              <dt>영역</dt><dd>${escapeHtml(subject.area || '')}</dd>
              <dt>선택 유형</dt><dd>${escapeHtml(subject.category || '')}</dd>
              <dt>개설 학기</dt><dd>${offeringText || '개설 정보 없음'}</dd>
              <dt>평가</dt><dd>${escapeHtml(subject.assessment || '')}</dd>
              <dt>수능</dt><dd>${subject.suneung ? '수능 출제 과목' : '수능 미출제 과목'}</dd>
            </dl>
            <div class="detail-actions">
              <a class="primary-action" href="${posterImagePath(subjectId)}" target="_blank" rel="noopener">포스터 이미지 열기</a>
              <a href="pdf-output/%EC%84%A0%ED%83%9D%EA%B3%BC%EB%AA%A9%ED%8F%AC%EC%8A%A4%ED%84%B0-%ED%86%B5%ED%95%A9.pdf" target="_blank" rel="noopener">전체 PDF</a>
            </div>
          </div>
          <aside class="detail-poster">
            ${renderPosterThumb(subjectId, subject, true)}
            <div class="info-section">
              <h3>추천 키워드</h3>
              ${infoList(subject.keywords, '키워드 정보가 없습니다.')}
            </div>
          </aside>
        </div>
        <div class="detail-info">
          <section class="info-panel wide">
            <h3>이런 학생에게 추천</h3>
            ${plainList(subject.recommendedFor, '추천 대상 정보가 준비 중입니다.')}
          </section>
          <section class="info-panel">
            <h3>${escapeHtml(subject.departmentLabel || '관련 학과')}</h3>
            ${infoList(subject.departments, '관련 학과 정보가 준비 중입니다.')}
          </section>
          <section class="info-panel">
            <h3>관련 진로</h3>
            ${infoList(subject.careers, '관련 진로 정보가 준비 중입니다.')}
          </section>
          <section class="info-panel wide">
            <h3>핵심 질문</h3>
            ${plainList(subject.keyIdeas, '핵심 질문 정보가 준비 중입니다.')}
          </section>
          <section class="info-panel wide">
            <h3>수업 활동</h3>
            ${plainList(subject.learningActivities, '수업 활동 정보가 준비 중입니다.')}
          </section>
          <section class="info-panel wide">
            <h3>탐구 활동 예시</h3>
            ${explorationList(subject.explorationActivities)}
          </section>
        </div>
      </div>
    `;

    els.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    history.replaceState(null, '', `#subject=${encodeURIComponent(subjectId)}`);
    queueThumbnailRendering(els.modalContent);
  }

  function closeModal() {
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    els.modalContent.innerHTML = '';
    if (location.hash.startsWith('#subject=')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  const renderedThumbs = new WeakSet();
  let thumbObserver = null;

  async function renderPdfThumbnail(canvas) {
    if (!pdfjsLib || renderedThumbs.has(canvas)) return;
    renderedThumbs.add(canvas);
    const url = canvas.dataset.pdfThumb;
    try {
      const pdf = await pdfjsLib.getDocument(url).promise;
      const page = await pdf.getPage(1);
      const box = canvas.parentElement.getBoundingClientRect();
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.max(box.width / baseViewport.width, box.height / baseViewport.height) * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
      canvas.parentElement.classList.add('is-rendered');
    } catch (error) {
      console.warn('PDF 썸네일 렌더링 실패:', url, error);
    }
  }

  function queueThumbnailRendering(scope = document) {
    const canvases = scope.querySelectorAll('canvas[data-pdf-thumb]');
    if (!canvases.length) return;
    if (!pdfjsLib) {
      loadPdfRenderer();
      return;
    }
    if (!thumbObserver) {
      thumbObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            thumbObserver.unobserve(entry.target);
            const canvas = entry.target.querySelector('canvas[data-pdf-thumb]');
            if (canvas) renderPdfThumbnail(canvas);
          }
        });
      }, { rootMargin: '300px 0px' });
    }
    scope.querySelectorAll('.poster-thumb').forEach(thumb => {
      const canvas = thumb.querySelector('canvas[data-pdf-thumb]');
      if (canvas && !renderedThumbs.has(canvas)) thumbObserver.observe(thumb);
    });
  }

  function bindEvents() {
    document.querySelectorAll('[data-scroll-target]').forEach(button => {
      button.addEventListener('click', () => {
        document.getElementById(button.dataset.scrollTarget)?.scrollIntoView({ behavior: 'smooth' });
      });
    });

    document.querySelectorAll('[data-audience]').forEach(button => {
      button.addEventListener('click', () => {
        state.audience = button.dataset.audience;
        state.semester = 'all';
        document.querySelectorAll('[data-audience]').forEach(item => {
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        });
        renderGrid();
      });
    });

    document.querySelector('.hero-search').addEventListener('submit', event => {
      event.preventDefault();
      state.search = els.search.value.trim();
      renderGrid();
      document.getElementById('subjects')?.scrollIntoView({ behavior: 'smooth' });
    });

    els.search.addEventListener('input', () => {
      state.search = els.search.value.trim();
      renderGrid();
    });

    els.chips.addEventListener('click', event => {
      const chip = event.target.closest('[data-area]');
      if (!chip) return;
      state.area = chip.dataset.area;
      renderAll();
    });

    els.semesterChips.addEventListener('click', event => {
      const chip = event.target.closest('[data-semester]');
      if (!chip) return;
      state.semester = chip.dataset.semester;
      renderSemesterChips();
      renderGrid();
    });

    els.category.addEventListener('change', () => {
      state.category = els.category.value;
      renderGrid();
    });

    els.suneung.addEventListener('change', () => {
      state.suneung = els.suneung.value;
      renderGrid();
    });

    els.grid.addEventListener('click', event => {
      if (event.target.closest('[data-pdf-link]')) return;
      const opener = event.target.closest('[data-open-subject]');
      const card = event.target.closest('[data-subject-id]');
      const subjectId = opener?.dataset.openSubject || card?.dataset.subjectId;
      if (subjectId) openSubject(subjectId);
    });

    document.querySelectorAll('[data-close-modal]').forEach(close => {
      close.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && els.modal.getAttribute('aria-hidden') === 'false') {
        closeModal();
      }
    });
  }

  function openHashSubject() {
    if (!location.hash.startsWith('#subject=')) return;
    const subjectId = decodeURIComponent(location.hash.replace('#subject=', ''));
    openSubject(subjectId);
  }

  renderAll();
  bindEvents();
  openHashSubject();
}());
