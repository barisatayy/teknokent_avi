/**
 * Teknokent Avı — Türkiye Teknokent Firmaları Platformu
 * İstemci Taraflı (Serverless / GitHub Pages) Arama ve Filtreleme Motoru
 */

(() => {
  'use strict';

  // ============================================================================
  // UYGULAMA DURUMU (STATE)
  // ============================================================================
  let allFirms = [];
  let metaData = null;
  let filteredFirms = [];

  // Uygulanmış Aktif Filtreler (Set nesneleri)
  const appliedFilters = {
    sektorler: new Set(),
    altKategoriler: new Set(),
    sehirler: new Set(),
    teknokentler: new Set()
  };

  // Modal İçindeki Taslak Filtreler
  const draftFilters = {
    sektorler: new Set(),
    altKategoriler: new Set(),
    sehirler: new Set(),
    teknokentler: new Set()
  };

  let searchQuery = '';
  let currentPage = 1;
  let pageSize = 50;

  // Sayı Formatlayıcı (Türkçe)
  const numberFormat = new Intl.NumberFormat('tr-TR');

  // ============================================================================
  // TÜRKÇE DİAKRİTİK VE ARAMA NORMALİZASYONU
  // ============================================================================
  function normalizeTR(str) {
    if (!str) return '';
    return String(str)
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .trim();
  }

  // ============================================================================
  // DOM ELEMANLARI
  // ============================================================================
  const dom = {
    // Giriş Tanıtım Ekranı
    introScreen: document.getElementById('intro-screen'),
    introCtaSection: document.getElementById('intro-cta-section'),
    btnIntroBrowse: document.getElementById('btn-intro-browse'),
    btnReopenIntro: document.getElementById('btn-reopen-intro'),

    // Metrikler
    metricFirms: document.getElementById('metric-firms'),
    metricTeknokent: document.getElementById('metric-teknokent'),
    metricCities: document.getElementById('metric-cities'),

    // Arama
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    btnOpenFilter: document.getElementById('btn-open-filter'),
    filterBadge: document.getElementById('filter-badge'),

    // Aktif Filtre Çubuğu
    activeFiltersBar: document.getElementById('active-filters-bar'),
    activeChipsContainer: document.getElementById('active-chips-container'),
    btnClearAll: document.getElementById('btn-clear-all'),

    // Sonuçlar & Kontroller
    totalCount: document.getElementById('total-count'),
    pageSizeSelect: document.getElementById('page-size-select'),
    loadingSkeleton: document.getElementById('loading-skeleton'),
    emptyState: document.getElementById('empty-state'),
    tableContainer: document.getElementById('table-container'),
    firmsTbody: document.getElementById('firms-tbody'),
    cardsContainer: document.getElementById('cards-container'),
    paginationContainer: document.getElementById('pagination-container'),

    // Filtreleme Modalı
    filterModalOverlay: document.getElementById('filter-modal-overlay'),
    btnCloseFilterModal: document.getElementById('btn-close-filter-modal'),
    tabBtnSektor: document.getElementById('tab-btn-sektor'),
    tabBtnKonum: document.getElementById('tab-btn-konum'),
    tabPaneSektor: document.getElementById('tab-pane-sektor'),
    tabPaneKonum: document.getElementById('tab-pane-konum'),

    // Filtre Kolonları ve Listeleri
    listSektor: document.getElementById('list-sektor'),
    listAlt: document.getElementById('list-alt'),
    listSehir: document.getElementById('list-sehir'),
    listTekno: document.getElementById('list-tekno'),

    searchFilterSektor: document.getElementById('search-filter-sektor'),
    searchFilterAlt: document.getElementById('search-filter-alt'),
    searchFilterSehir: document.getElementById('search-filter-sehir'),
    searchFilterTekno: document.getElementById('search-filter-tekno'),

    btnSelectAllSektor: document.getElementById('btn-select-all-sektor'),
    btnClearSektor: document.getElementById('btn-clear-sektor'),
    btnSelectAllAlt: document.getElementById('btn-select-all-alt'),
    btnClearAlt: document.getElementById('btn-clear-alt'),
    btnSelectAllSehir: document.getElementById('btn-select-all-sehir'),
    btnClearSehir: document.getElementById('btn-clear-sehir'),
    btnSelectAllTekno: document.getElementById('btn-select-all-tekno'),
    btnClearTekno: document.getElementById('btn-clear-tekno'),

    draftCountNum: document.getElementById('draft-count-num'),
    btnModalResetAll: document.getElementById('btn-modal-reset-all'),
    btnModalCancel: document.getElementById('btn-modal-cancel'),
    btnModalApply: document.getElementById('btn-modal-apply'),

    // Detay Modalı
    detailModalOverlay: document.getElementById('detail-modal-overlay'),
    btnCloseDetailModal: document.getElementById('btn-close-detail-modal'),
    btnDetailCloseBottom: document.getElementById('btn-detail-close-bottom'),
    detailFirmName: document.getElementById('detail-firm-name'),
    detailFirmLink: document.getElementById('detail-firm-link'),
    detailLinkText: document.getElementById('detail-link-text'),
    detailSector: document.getElementById('detail-sector'),
    detailLocation: document.getElementById('detail-location'),
    detailTags: document.getElementById('detail-tags'),
    detailSummary: document.getElementById('detail-summary'),
    detailFirmId: document.getElementById('detail-firm-id')
  };

  // ============================================================================
  // VERİ YÜKLEME
  // ============================================================================
  async function init() {
    // Giriş tanıtım ekranı butonlarını veri indirmesini beklemeden anında bağla
    if (dom.btnIntroBrowse) dom.btnIntroBrowse.addEventListener('click', closeIntro);
    if (dom.btnReopenIntro) dom.btnReopenIntro.addEventListener('click', openIntro);

    try {
      let rawFirms = null;

      // 1. Script tag ile önceden yüklenmiş veri varsa (file:// ve tüm ortamlarda anında çalışır)
      const gMeta = window.TEKNOKENT_AVI_META || window.TEKNOREHBER_META;
      const gFirms = window.TEKNOKENT_AVI_FIRMALAR || window.TEKNOREHBER_FIRMALAR;

      if (gMeta && gFirms) {
        metaData = gMeta;
        rawFirms = gFirms;
      } else {
        // 2. Fetch ile dinamik yükleme (GitHub Pages veya Web sunucusu üzerinden)
        const [metaResp, firmsResp] = await Promise.all([
          fetch('data/meta.json'),
          fetch('data/firmalar.json')
        ]);

        if (!metaResp.ok || !firmsResp.ok) {
          throw new Error('Veri dosyaları yüklenemedi.');
        }

        metaData = await metaResp.json();
        rawFirms = await firmsResp.json();
      }

      // Firma verilerini normalize edip hızlı arama indeksini oluştur
      allFirms = rawFirms.map(firm => {
        const altStr = Array.isArray(firm.alt) ? firm.alt.join(' ') : (firm.alt || '');
        const searchTokens = [
          firm.ad || '',
          firm.tekno || '',
          firm.sehir || '',
          firm.ana || '',
          altStr,
          firm.ozet || ''
        ].join(' ');

        return {
          ...firm,
          alt: Array.isArray(firm.alt) ? firm.alt : (firm.alt ? [firm.alt] : []),
          _searchIndex: normalizeTR(searchTokens)
        };
      });

      // Metrikleri güncelle
      if (dom.metricFirms) dom.metricFirms.textContent = numberFormat.format(metaData.total_firms || allFirms.length);
      if (dom.metricTeknokent) dom.metricTeknokent.textContent = metaData.total_teknokent || 78;
      if (dom.metricCities) dom.metricCities.textContent = metaData.total_sehir || 48;

      // İskeleti gizle, container'ları aç (CSS medya sorgularına bırak)
      if (dom.loadingSkeleton) dom.loadingSkeleton.style.display = 'none';
      if (dom.tableContainer) dom.tableContainer.style.display = '';
      if (dom.cardsContainer) dom.cardsContainer.style.display = '';

      // İlk filtreleme ve render
      applyFilterPipeline();
      setupEventListeners();

    } catch (err) {
      console.error('Yükleme hatası:', err);
      if (dom.loadingSkeleton) {
        const isFileProtocol = window.location.protocol === 'file:';
        dom.loadingSkeleton.innerHTML = `
          <div style="padding: 40px; text-align: center; color: #f87171;">
            <p style="font-weight: 700; font-size: 16px;">Veriler Yüklenirken Bir Hata Oluştu</p>
            <p style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
              ${isFileProtocol 
                ? 'Tarayıcı güvenlik kısıtlamaları nedeniyle veri dosyaları doğrudan çift tıklama (file://) ile okunamaz. GitHub Pages üzerinde veya yerel web sunucusu (http://localhost:8080) ile çalıştırınız.' 
                : 'Lütfen sayfayı yenilemeyi deneyin veya internet bağlantınızı kontrol edin.'}
            </p>
          </div>
        `;
      }
    }
  }

  // ============================================================================
  // FİLTRELEME & ARAMA BORU HATTI (PIPELINE)
  // ============================================================================
  function applyFilterPipeline() {
    const hasSektor = appliedFilters.sektorler.size > 0;
    const hasAlt = appliedFilters.altKategoriler.size > 0;
    const hasSehir = appliedFilters.sehirler.size > 0;
    const hasTekno = appliedFilters.teknokentler.size > 0;

    const queryTokens = searchQuery
      ? normalizeTR(searchQuery).split(/\s+/).filter(Boolean)
      : [];

    filteredFirms = allFirms.filter(firm => {
      // 1. Sektör Filtresi
      if (hasSektor && !appliedFilters.sektorler.has(firm.ana)) {
        return false;
      }

      // 2. Alt Kategori Filtresi (firmadaki alt kategorilerden en az biri seçilenler arasında olmalı)
      if (hasAlt) {
        if (!firm.alt || firm.alt.length === 0) return false;
        const matchesAnyAlt = firm.alt.some(a => appliedFilters.altKategoriler.has(a));
        if (!matchesAnyAlt) return false;
      }

      // 3. Şehir Filtresi
      if (hasSehir && !appliedFilters.sehirler.has(firm.sehir)) {
        return false;
      }

      // 4. Teknokent Filtresi
      if (hasTekno && !appliedFilters.teknokentler.has(firm.tekno)) {
        return false;
      }

      // 5. Metin Araması (Tüm token'lar eşleşmeli - AND mantığı)
      if (queryTokens.length > 0) {
        for (let i = 0; i < queryTokens.length; i++) {
          if (!firm._searchIndex.includes(queryTokens[i])) {
            return false;
          }
        }
      }

      return true;
    });

    currentPage = 1;
    renderResults();
    renderActiveFilterChips();
    updateFilterBadge();
  }

  // ============================================================================
  // RENDER: SONUÇLAR VE SAYFALAMA
  // ============================================================================
  function renderResults() {
    const total = filteredFirms.length;
    if (dom.totalCount) dom.totalCount.textContent = numberFormat.format(total);

    if (total === 0) {
      if (dom.emptyState) dom.emptyState.style.display = 'flex';
      if (dom.tableContainer) dom.tableContainer.style.display = 'none';
      if (dom.cardsContainer) dom.cardsContainer.style.display = 'none';
      if (dom.paginationContainer) dom.paginationContainer.innerHTML = '';
      return;
    }

    if (dom.emptyState) dom.emptyState.style.display = 'none';
    if (dom.tableContainer) dom.tableContainer.style.display = '';
    if (dom.cardsContainer) dom.cardsContainer.style.display = '';

    // Sayfa dilimi
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = filteredFirms.slice(startIndex, startIndex + pageSize);

    // 1. Masaüstü Tablo Satırları
    renderTableRows(pageItems);

    // 2. Mobil / Tablet Kartları
    renderCards(pageItems);

    // 3. Sayfalama Çubuğu
    renderPagination(total);
  }

  // Masaüstü Tablo Görünümü
  function renderTableRows(items) {
    if (!dom.firmsTbody) return;

    let html = '';
    for (let i = 0; i < items.length; i++) {
      const firm = items[i];
      const tags = (firm.alt || []).slice(0, 3);
      const remainingCount = (firm.alt || []).length - 3;

      let tagsHtml = tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('');
      if (remainingCount > 0) {
        tagsHtml += `<span class="tag-pill" style="opacity: 0.75;">+${remainingCount}</span>`;
      }

      let webLinkHtml = '';
      if (firm.link) {
        const cleanHost = cleanUrl(firm.link);
        webLinkHtml = `
          <a href="${escapeHtml(firm.link)}" target="_blank" rel="noopener noreferrer" class="company-link" title="${escapeHtml(firm.link)}">
            <span>${escapeHtml(cleanHost)}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        `;
      }

      html += `
        <tr>
          <td class="col-company">
            <span class="company-name">${escapeHtml(firm.ad)}</span>
            ${webLinkHtml}
          </td>
          <td>
            <span class="badge-sector">${escapeHtml(firm.ana || 'Genel')}</span>
          </td>
          <td class="col-location">
            <span class="location-tekno">${escapeHtml(firm.tekno || '-')}</span>
            <span class="location-city">${escapeHtml(firm.sehir || '-')}</span>
          </td>
          <td class="col-tags">
            <div class="tag-list">${tagsHtml || '<span class="tag-pill" style="opacity:0.5;">Belirtilmemiş</span>'}</div>
          </td>
          <td class="col-summary" title="${escapeHtml(firm.ozet || '')}">
            ${escapeHtml(firm.ozet || 'Açıklama bulunmuyor.')}
          </td>
          <td class="col-action">
            <button type="button" class="btn-inspect" data-action="inspect" data-id="${firm.id}">İncele</button>
          </td>
        </tr>
      `;
    }

    dom.firmsTbody.innerHTML = html;
  }

  // Mobil / Tablet Kart Görünümü
  function renderCards(items) {
    if (!dom.cardsContainer) return;

    let html = '';
    for (let i = 0; i < items.length; i++) {
      const firm = items[i];
      const tags = (firm.alt || []).slice(0, 3);
      const remainingCount = (firm.alt || []).length - 3;

      let tagsHtml = tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('');
      if (remainingCount > 0) {
        tagsHtml += `<span class="tag-pill" style="opacity: 0.75;">+${remainingCount}</span>`;
      }

      let webLinkHtml = '';
      if (firm.link) {
        const cleanHost = cleanUrl(firm.link);
        webLinkHtml = `
          <a href="${escapeHtml(firm.link)}" target="_blank" rel="noopener noreferrer" class="company-link" style="max-width: 180px;">
            <span>${escapeHtml(cleanHost)}</span>
          </a>
        `;
      }

      html += `
        <article class="firm-card">
          <div class="card-top">
            <div class="card-name-group">
              <h2 class="card-company-name">${escapeHtml(firm.ad)}</h2>
              <div class="card-meta-row">
                <span class="card-location-item">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  ${escapeHtml(firm.sehir || '')} • ${escapeHtml(firm.tekno || '')}
                </span>
              </div>
            </div>
            <span class="badge-sector" style="font-size: 10.5px;">${escapeHtml(firm.ana || 'Genel')}</span>
          </div>

          <div class="card-summary">
            ${escapeHtml(firm.ozet || 'Açıklama bulunmuyor.')}
          </div>

          <div class="tag-list" style="margin-top: 2px;">
            ${tagsHtml}
          </div>

          <div class="card-footer">
            <div>${webLinkHtml}</div>
            <button type="button" class="btn-card-inspect" data-action="inspect" data-id="${firm.id}">
              Detayları Gör
            </button>
          </div>
        </article>
      `;
    }

    dom.cardsContainer.innerHTML = html;
  }

  // Sayfalama Çubuğu Oluşturucu
  function renderPagination(totalItems) {
    if (!dom.paginationContainer) return;

    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) {
      dom.paginationContainer.innerHTML = '';
      return;
    }

    let buttons = [];

    // Önceki Butonu
    buttons.push(`
      <button type="button" class="btn-page" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled aria-disabled="true"' : ''} aria-label="Önceki Sayfa">
        &lsaquo;
      </button>
    `);

    // Sayfa Numarası Hesaplama (Akıllı Aralık)
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    for (let p of rangeWithDots) {
      if (p === '...') {
        buttons.push(`<span class="btn-page" style="border:none; background:none; cursor:default;">…</span>`);
      } else {
        const isActive = p === currentPage;
        buttons.push(`
          <button type="button" class="btn-page ${isActive ? 'is-active' : ''}" data-page="${p}" ${isActive ? 'aria-current="page"' : ''}>
            ${p}
          </button>
        `);
      }
    }

    // Sonraki Butonu
    buttons.push(`
      <button type="button" class="btn-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled aria-disabled="true"' : ''} aria-label="Sonraki Sayfa">
        &rsaquo;
      </button>
    `);

    dom.paginationContainer.innerHTML = buttons.join('');
  }

  // ============================================================================
  // AKTİF FİLTRE ÇİPLERİ & ROZET
  // ============================================================================
  function renderActiveFilterChips() {
    if (!dom.activeChipsContainer || !dom.activeFiltersBar) return;

    const chips = [];

    appliedFilters.sektorler.forEach(item => {
      chips.push({ type: 'sektorler', label: `Sektör: ${item}`, value: item });
    });
    appliedFilters.altKategoriler.forEach(item => {
      chips.push({ type: 'altKategoriler', label: `Uzmanlık: ${item}`, value: item });
    });
    appliedFilters.sehirler.forEach(item => {
      chips.push({ type: 'sehirler', label: `Şehir: ${item}`, value: item });
    });
    appliedFilters.teknokentler.forEach(item => {
      chips.push({ type: 'teknokentler', label: `Teknokent: ${item}`, value: item });
    });

    if (chips.length === 0) {
      dom.activeFiltersBar.style.display = 'none';
      dom.activeChipsContainer.innerHTML = '';
      return;
    }

    dom.activeFiltersBar.style.display = 'flex';
    dom.activeChipsContainer.innerHTML = chips.map(chip => `
      <span class="active-filter-chip">
        <span>${escapeHtml(chip.label)}</span>
        <button type="button" class="chip-remove" data-type="${chip.type}" data-value="${escapeHtml(chip.value)}" aria-label="Kaldır: ${escapeHtml(chip.label)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </span>
    `).join('');
  }

  function updateFilterBadge() {
    const totalSelected = appliedFilters.sektorler.size +
                          appliedFilters.altKategoriler.size +
                          appliedFilters.sehirler.size +
                          appliedFilters.teknokentler.size;

    if (dom.filterBadge) {
      if (totalSelected > 0) {
        dom.filterBadge.textContent = totalSelected;
        dom.filterBadge.style.display = 'inline-block';
        dom.btnOpenFilter.classList.add('has-filters');
      } else {
        dom.filterBadge.style.display = 'none';
        dom.btnOpenFilter.classList.remove('has-filters');
      }
    }
  }

  // ============================================================================
  // GELİŞMİŞ FİLTRELEME MODALI MANTIĞI
  // ============================================================================
  function openFilterModal() {
    // Uygulanan aktif filtreleri taslak (draft) durumuna kopyala
    draftFilters.sektorler = new Set(appliedFilters.sektorler);
    draftFilters.altKategoriler = new Set(appliedFilters.altKategoriler);
    draftFilters.sehirler = new Set(appliedFilters.sehirler);
    draftFilters.teknokentler = new Set(appliedFilters.teknokentler);

    // Listeleri oluştur ve doldur
    populateModalLists();
    updateModalDraftCounter();

    dom.filterModalOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeFilterModal() {
    dom.filterModalOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function updateModalDraftCounter() {
    const count = draftFilters.sektorler.size +
                  draftFilters.altKategoriler.size +
                  draftFilters.sehirler.size +
                  draftFilters.teknokentler.size;
    if (dom.draftCountNum) dom.draftCountNum.textContent = count;
  }

  // Modal Kolon Listelerini Doldurma (Kademeli / Cascading Filtre)
  function populateModalLists() {
    if (!metaData) return;

    // 1. Sektörler Listesi
    renderCheckboxList(
      dom.listSektor,
      metaData.sektorler || [],
      draftFilters.sektorler,
      dom.searchFilterSektor ? dom.searchFilterSektor.value : '',
      'sektor'
    );

    // 2. Alt Uzmanlıklar Listesi (Kademeli: Eğer sektör seçilmişse sadece o sektörlerin alt kategorilerini sun)
    let altItems = [];
    const subcategoryCountMap = {};

    // Sektör bazlı filtreleme
    const activeSektorList = draftFilters.sektorler.size > 0
      ? Array.from(draftFilters.sektorler)
      : (metaData.sektorler || []).map(s => s.name);

    // İlgili alt kategorileri topla
    const allowedSubcategories = new Set();
    if (metaData.sektor_alt_map) {
      activeSektorList.forEach(sek => {
        const subs = metaData.sektor_alt_map[sek] || [];
        subs.forEach(s => {
          const name = typeof s === 'string' ? s : (s && s.name ? s.name : '');
          if (name) allowedSubcategories.add(name);
        });
      });
    }

    // Alt kategori sayılarını firmalardan hesapla
    allFirms.forEach(firm => {
      if (draftFilters.sektorler.size === 0 || draftFilters.sektorler.has(firm.ana)) {
        (firm.alt || []).forEach(sub => {
          if (allowedSubcategories.size === 0 || allowedSubcategories.has(sub)) {
            subcategoryCountMap[sub] = (subcategoryCountMap[sub] || 0) + 1;
          }
        });
      }
    });

    altItems = Object.keys(subcategoryCountMap).map(subName => ({
      name: subName,
      count: subcategoryCountMap[subName]
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'));

    renderCheckboxList(
      dom.listAlt,
      altItems,
      draftFilters.altKategoriler,
      dom.searchFilterAlt ? dom.searchFilterAlt.value : '',
      'alt'
    );

    // 3. Şehirler Listesi
    renderCheckboxList(
      dom.listSehir,
      metaData.sehirler || [],
      draftFilters.sehirler,
      dom.searchFilterSehir ? dom.searchFilterSehir.value : '',
      'sehir'
    );

    // 4. Teknokentler Listesi (Kademeli: Eğer şehir seçilmişse sadece o şehirlerin teknokentlerini sun)
    let teknoItems = [];
    const activeSehirList = draftFilters.sehirler.size > 0
      ? Array.from(draftFilters.sehirler)
      : (metaData.sehirler || []).map(s => s.name);

    const allowedTeknokentler = new Set();
    if (metaData.city_teknokent_map) {
      activeSehirList.forEach(c => {
        const parks = metaData.city_teknokent_map[c] || [];
        parks.forEach(p => {
          const name = typeof p === 'string' ? p : (p && p.name ? p.name : '');
          if (name) allowedTeknokentler.add(name);
        });
      });
    }

    const teknoCountMap = {};
    allFirms.forEach(firm => {
      if (draftFilters.sehirler.size === 0 || draftFilters.sehirler.has(firm.sehir)) {
        if (allowedTeknokentler.size === 0 || allowedTeknokentler.has(firm.tekno)) {
          teknoCountMap[firm.tekno] = (teknoCountMap[firm.tekno] || 0) + 1;
        }
      }
    });

    teknoItems = Object.keys(teknoCountMap).map(teknoName => ({
      name: teknoName,
      count: teknoCountMap[teknoName]
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'));

    renderCheckboxList(
      dom.listTekno,
      teknoItems,
      draftFilters.teknokentler,
      dom.searchFilterTekno ? dom.searchFilterTekno.value : '',
      'tekno'
    );
  }

  // Genel Onay Kutusu Listesi Oluşturucu
  function renderCheckboxList(container, items, selectedSet, searchText, groupKey) {
    if (!container) return;

    const query = normalizeTR(searchText);
    const filtered = items.filter(item => {
      if (!query) return true;
      return normalizeTR(item.name).includes(query);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">
          Eşleşen seçenek bulunamadı.
        </div>
      `;
      return;
    }

    let html = '';
    for (let i = 0; i < filtered.length; i++) {
      const it = filtered[i];
      const isChecked = selectedSet.has(it.name);
      const safeId = `chk_${groupKey}_${i}_${Math.random().toString(36).substr(2, 4)}`;

      html += `
        <label class="filter-checkbox-item ${isChecked ? 'is-checked' : ''}" for="${safeId}">
          <div class="checkbox-left">
            <input type="checkbox" id="${safeId}" data-group="${groupKey}" data-value="${escapeHtml(it.name)}" ${isChecked ? 'checked' : ''}>
            <span class="checkbox-label" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span>
          </div>
          <span class="checkbox-count">${numberFormat.format(it.count)}</span>
        </label>
      `;
    }

    container.innerHTML = html;
  }

  // ============================================================================
  // DETAY MODALI
  // ============================================================================
  function openDetailModal(firmId) {
    const firm = allFirms.find(f => f.id === firmId);
    if (!firm) return;

    if (dom.detailFirmName) dom.detailFirmName.textContent = firm.ad;
    if (dom.detailFirmId) dom.detailFirmId.textContent = `Firma ID: #${firm.id}`;

    if (dom.detailFirmLink && dom.detailLinkText) {
      if (firm.link) {
        dom.detailFirmLink.style.display = 'inline-flex';
        dom.detailFirmLink.href = firm.link;
        dom.detailLinkText.textContent = cleanUrl(firm.link);
      } else {
        dom.detailFirmLink.style.display = 'none';
      }
    }

    if (dom.detailSector) dom.detailSector.textContent = firm.ana || 'Genel';
    if (dom.detailLocation) dom.detailLocation.textContent = `${firm.tekno || ''} (${firm.sehir || ''})`;

    if (dom.detailTags) {
      if (firm.alt && firm.alt.length > 0) {
        dom.detailTags.innerHTML = firm.alt.map(t => `<span class="tag-pill" style="font-size:12px; padding: 4px 10px;">${escapeHtml(t)}</span>`).join('');
      } else {
        dom.detailTags.innerHTML = '<span class="tag-pill" style="opacity:0.6;">Belirtilmemiş</span>';
      }
    }

    if (dom.detailSummary) {
      dom.detailSummary.textContent = firm.ozet || 'Firma hakkında özet bilgi bulunmuyor.';
    }

    dom.detailModalOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeDetailModal() {
    dom.detailModalOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // ============================================================================
  // OLAY DİNLEYİCİLERİ (EVENT LISTENERS)
  // ============================================================================
  function setupEventListeners() {
    // 1. Arama Girdisi (Anlık, Sıfır Gecikmeli Filtreleme)
    dom.searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      if (dom.searchClearBtn) {
        dom.searchClearBtn.style.display = searchQuery ? 'flex' : 'none';
      }
      applyFilterPipeline();
    });

    if (dom.searchClearBtn) {
      dom.searchClearBtn.addEventListener('click', () => {
        dom.searchInput.value = '';
        searchQuery = '';
        dom.searchClearBtn.style.display = 'none';
        dom.searchInput.focus();
        applyFilterPipeline();
      });
    }

    // 2. Sayfa Başı Firma Sayısı Seçimi
    dom.pageSizeSelect.addEventListener('change', (e) => {
      pageSize = parseInt(e.target.value, 10) || 50;
      currentPage = 1;
      renderResults();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 3. Sayfalama Tıklamaları (Event Delegation)
    dom.paginationContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-page');
      if (!btn || btn.disabled) return;
      const targetPage = parseInt(btn.dataset.page, 10);
      if (targetPage && targetPage !== currentPage) {
        currentPage = targetPage;
        renderResults();
        window.scrollTo({ top: 180, behavior: 'smooth' });
      }
    });

    // 4. Detay İncele Butonları (Table & Cards - Event Delegation)
    const handleInspectClick = (e) => {
      const btn = e.target.closest('[data-action="inspect"]');
      if (btn) {
        const firmId = parseInt(btn.dataset.id, 10);
        if (firmId) openDetailModal(firmId);
      }
    };
    dom.tableContainer.addEventListener('click', handleInspectClick);
    dom.cardsContainer.addEventListener('click', handleInspectClick);

    // 5. Aktif Filtre Çipleri Kaldırma & Tümünü Temizleme
    dom.activeFiltersBar.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.chip-remove');
      if (removeBtn) {
        const { type, value } = removeBtn.dataset;
        if (appliedFilters[type]) {
          appliedFilters[type].delete(value);
          applyFilterPipeline();
        }
      }
    });

    dom.btnClearAll.addEventListener('click', () => {
      appliedFilters.sektorler.clear();
      appliedFilters.altKategoriler.clear();
      appliedFilters.sehirler.clear();
      appliedFilters.teknokentler.clear();
      applyFilterPipeline();
    });

    // 6. Modal Açma / Kapatma
    dom.btnOpenFilter.addEventListener('click', openFilterModal);
    dom.btnCloseFilterModal.addEventListener('click', closeFilterModal);
    dom.btnModalCancel.addEventListener('click', closeFilterModal);

    // Modal Dışına Tıklama ile Kapatma
    dom.filterModalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.filterModalOverlay) closeFilterModal();
    });
    dom.detailModalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.detailModalOverlay) closeDetailModal();
    });

    dom.btnCloseDetailModal.addEventListener('click', closeDetailModal);
    dom.btnDetailCloseBottom.addEventListener('click', closeDetailModal);

    // ESC Tuşu ile Modal Kapatma
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.filterModalOverlay.classList.contains('is-open')) closeFilterModal();
        if (dom.detailModalOverlay.classList.contains('is-open')) closeDetailModal();
      }
    });

    // 7. Modal Sekme Geçişleri
    dom.tabBtnSektor.addEventListener('click', () => {
      dom.tabBtnSektor.classList.add('is-active');
      dom.tabBtnKonum.classList.remove('is-active');
      dom.tabPaneSektor.classList.add('is-active');
      dom.tabPaneKonum.classList.remove('is-active');
    });

    dom.tabBtnKonum.addEventListener('click', () => {
      dom.tabBtnKonum.classList.add('is-active');
      dom.tabBtnSektor.classList.remove('is-active');
      dom.tabPaneKonum.classList.add('is-active');
      dom.tabPaneSektor.classList.remove('is-active');
    });

    // 8. Modal İçi Checkbox Değişimleri (Event Delegation)
    const handleCheckboxChange = (e) => {
      if (e.target.type !== 'checkbox') return;
      const { group, value } = e.target.dataset;
      const isChecked = e.target.checked;

      let targetSet;
      if (group === 'sektor') targetSet = draftFilters.sektorler;
      else if (group === 'alt') targetSet = draftFilters.altKategoriler;
      else if (group === 'sehir') targetSet = draftFilters.sehirler;
      else if (group === 'tekno') targetSet = draftFilters.teknokentler;

      if (!targetSet) return;

      if (isChecked) {
        targetSet.add(value);
      } else {
        targetSet.delete(value);
      }

      // Kademeli (Cascading) ilişkiyi yeniden hesapla
      if (group === 'sektor' || group === 'sehir') {
        populateModalLists();
      } else {
        updateModalDraftCounter();
        // Checkbox parent stilini güncelle
        const parentLabel = e.target.closest('.filter-checkbox-item');
        if (parentLabel) {
          parentLabel.classList.toggle('is-checked', isChecked);
        }
      }
    };

    dom.listSektor.addEventListener('change', handleCheckboxChange);
    dom.listAlt.addEventListener('change', handleCheckboxChange);
    dom.listSehir.addEventListener('change', handleCheckboxChange);
    dom.listTekno.addEventListener('change', handleCheckboxChange);

    // 9. Kolon İçi Hızlı Aramalar
    dom.searchFilterSektor.addEventListener('input', () => populateModalLists());
    dom.searchFilterAlt.addEventListener('input', () => populateModalLists());
    dom.searchFilterSehir.addEventListener('input', () => populateModalLists());
    dom.searchFilterTekno.addEventListener('input', () => populateModalLists());

    // 10. Kolon "Tümünü Seç" ve "Temizle" Butonları
    dom.btnSelectAllSektor.addEventListener('click', () => {
      (metaData.sektorler || []).forEach(s => draftFilters.sektorler.add(s.name));
      populateModalLists();
      updateModalDraftCounter();
    });
    dom.btnClearSektor.addEventListener('click', () => {
      draftFilters.sektorler.clear();
      populateModalLists();
      updateModalDraftCounter();
    });

    dom.btnSelectAllAlt.addEventListener('click', () => {
      const inputs = dom.listAlt.querySelectorAll('input[type="checkbox"]');
      inputs.forEach(inp => draftFilters.altKategoriler.add(inp.dataset.value));
      populateModalLists();
      updateModalDraftCounter();
    });
    dom.btnClearAlt.addEventListener('click', () => {
      draftFilters.altKategoriler.clear();
      populateModalLists();
      updateModalDraftCounter();
    });

    dom.btnSelectAllSehir.addEventListener('click', () => {
      (metaData.sehirler || []).forEach(c => draftFilters.sehirler.add(c.name));
      populateModalLists();
      updateModalDraftCounter();
    });
    dom.btnClearSehir.addEventListener('click', () => {
      draftFilters.sehirler.clear();
      populateModalLists();
      updateModalDraftCounter();
    });

    dom.btnSelectAllTekno.addEventListener('click', () => {
      const inputs = dom.listTekno.querySelectorAll('input[type="checkbox"]');
      inputs.forEach(inp => draftFilters.teknokentler.add(inp.dataset.value));
      populateModalLists();
      updateModalDraftCounter();
    });
    dom.btnClearTekno.addEventListener('click', () => {
      draftFilters.teknokentler.clear();
      populateModalLists();
      updateModalDraftCounter();
    });

    // 11. Modal Altı: Filtreleri Sıfırla (Reset All)
    dom.btnModalResetAll.addEventListener('click', () => {
      draftFilters.sektorler.clear();
      draftFilters.altKategoriler.clear();
      draftFilters.sehirler.clear();
      draftFilters.teknokentler.clear();
      populateModalLists();
      updateModalDraftCounter();
    });

    // 12. Modal Altı: Filtreleri Uygula
    dom.btnModalApply.addEventListener('click', () => {
      appliedFilters.sektorler = new Set(draftFilters.sektorler);
      appliedFilters.altKategoriler = new Set(draftFilters.altKategoriler);
      appliedFilters.sehirler = new Set(draftFilters.sehirler);
      appliedFilters.teknokentler = new Set(draftFilters.teknokentler);

      closeFilterModal();
      applyFilterPipeline();
    });

    }

  // Giriş Ekranını Kapatma & Asıl Uygulamaya Geçiş
  function closeIntro() {
    if (!dom.introScreen) return;
    dom.introScreen.classList.add('is-exiting');
    setTimeout(() => {
      dom.introScreen.style.display = 'none';
    }, 500);
  }

  // Giriş Ekranını Yeniden Açma
  function openIntro() {
    if (!dom.introScreen) return;
    dom.introScreen.style.display = 'flex';
    dom.introScreen.classList.remove('is-exiting');
    if (dom.introCtaSection) {
      dom.introCtaSection.classList.add('is-visible');
    }
  }

  // ============================================================================
  // YARDIMCI ARAÇLAR (HELPERS)
  // ============================================================================
  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cleanUrl(url) {
    if (!url) return '';
    return url
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/, '');
  }

  // Sayfa Yüklendiğinde Başlat
  document.addEventListener('DOMContentLoaded', init);
})();
