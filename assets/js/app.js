/* ============================================================
   StyleVault · 应用主逻辑
   纯静态站点：风格库 / 抽卡 / 剧本匹配 / 我的风格
   ============================================================ */
(function () {
  'use strict';

  const LIB = window.STYLE_LIBRARY || [];
  const CATS = window.STYLE_CATEGORIES || [];
  const byId = new Map(LIB.map((s) => [s.id, s]));

  const RARITY = {
    R: { label: '常见', color: '#8ea0b8', glow: 'rgba(142,160,184,.45)' },
    SR: { label: '稀有', color: '#7cb3ff', glow: 'rgba(124,179,255,.6)' },
    SSR: { label: '典藏', color: '#c084fc', glow: 'rgba(192,132,252,.85)' },
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------------- 存储 ---------------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sv_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('sv_' + k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  let favs = new Set(store.get('favs', []));
  let recent = store.get('recent', []);
  let drawHistory = store.get('draws', []);

  /* ---------------- 工具 ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { t.hidden = true; }, 320);
    }, 2200);
  }

  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg || '已复制到剪贴板');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(okMsg || '已复制到剪贴板'); }
      catch { toast('复制失败，请手动选择'); }
      ta.remove();
    }
  }

  const fmt = (n) => (n >= 10000 ? (n / 10000).toFixed(1) + 'w' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n || 0));

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function highlightTokens(text) {
    return escapeHtml(text).replace(/\{(场景|角色|镜头|动作|情绪|时长)\}/g, '<span class="tok">{$1}</span>');
  }

  /* ---------------- HERO ---------------- */
  function initHero() {
    const title = $('#heroTitle');
    const text = '让每一帧 都有画风';
    title.innerHTML = [...text].map((c, i) =>
      `<span class="ch" style="animation-delay:${i * 0.045}s">${c === ' ' ? '&nbsp;' : escapeHtml(c)}</span>`).join('');

    // 计数
    const cats = new Set();
    LIB.forEach((s) => (s.cats || [s.cat]).forEach((c) => cats.add(c)));
    const targets = { 0: LIB.length, 1: cats.size, 2: 3, 3: 100 };
    const nodes = $$('#heroStats .count');
    let started = false;
    const runCounters = () => {
      if (started) return; started = true;
      nodes.forEach((n, i) => {
        const to = targets[i] ?? 0;
        const suffix = n.dataset.suffix || '';
        const dur = 1100;
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          n.textContent = Math.round(to * e) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { runCounters(); io.disconnect(); } }), { threshold: 0.3 });
    io.observe($('#heroStats'));

    // 跑马灯
    const track = $('#marqueeTrack');
    const names = LIB.slice(0, 26).map((s) => s.name);
    const line = names.join('　✦　');
    track.innerHTML = `<span>${escapeHtml(line)}</span><span>${escapeHtml(line)}</span>`;

    $('#footStyles').textContent = `${LIB.length} 套画风 · ${cats.size} 个分类`;
  }

  /* ---------------- 风格库 ---------------- */
  const state = { cat: 'all', q: '', sort: 'hot' };

  function catCount(key) {
    if (key === 'all') return LIB.length;
    return LIB.filter((s) => (s.cats || [s.cat]).includes(key)).length;
  }

  function initChips() {
    const wrap = $('#catChips');
    wrap.innerHTML = CATS.map((c) =>
      `<button class="chip${c.key === 'all' ? ' active' : ''}" data-cat="${c.key}">${escapeHtml(c.label)}<span class="cnt">${catCount(c.key)}</span></button>`).join('');
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      $$('.chip', wrap).forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.cat = btn.dataset.cat;
      renderGrid();
    });
  }

  function filtered() {
    let list = LIB.filter((s) => {
      if (state.cat !== 'all' && !(s.cats || [s.cat]).includes(state.cat)) return false;
      if (!state.q) return true;
      const q = state.q.toLowerCase();
      return (s.name + ' ' + (s.en || '') + ' ' + (s.catLabel || '') + ' ' + (s.desc || '') + ' ' + (s.tags || []).join(' ') + ' ' + (s.keywords || []).join(' ')).toLowerCase().includes(q);
    });
    const order = { R: 1, SR: 2, SSR: 3 };
    if (state.sort === 'hot') list.sort((a, b) => (b.uses || 0) - (a.uses || 0));
    else if (state.sort === 'new') list.sort((a, b) => (b.new ? 1 : 0) - (a.new ? 1 : 0) || (b.uses || 0) - (a.uses || 0));
    else if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    else if (state.sort === 'rarity') list.sort((a, b) => (order[b.rarity] || 0) - (order[a.rarity] || 0) || (b.uses || 0) - (a.uses || 0));
    return list;
  }

  function cardHTML(s, i) {
    const r = RARITY[s.rarity] || RARITY.R;
    const fav = favs.has(s.id);
    const badges = [];
    if (s.hot) badges.push('<span class="badge hot">🔥 Hot</span>');
    else if (s.new) badges.push('<span class="badge new">✦ New</span>');
    badges.push(`<span class="badge rarity" style="--rc:${r.color};--rg:${r.glow}">${s.rarity}</span>`);
    return `
      <article class="card" data-id="${s.id}" style="animation-delay:${Math.min(i * 0.025, 0.6)}s" tabindex="0">
        <div class="card-media">
          <img src="${s.thumb}" alt="${escapeHtml(s.name)}" loading="lazy" decoding="async" />
          <div class="card-shade"></div>
          ${badges.join('')}
          <button class="card-fav${fav ? ' on' : ''}" data-fav="${s.id}" title="收藏" aria-label="收藏">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20.5s-7.5-4.7-7.5-10A4.5 4.5 0 0 1 12 7.5a4.5 4.5 0 0 1 7.5 3c0 5.3-7.5 10-7.5 10z"/></svg>
          </button>
          <h3 class="card-title">${escapeHtml(s.name)}</h3>
          <span class="card-en">${escapeHtml(s.en || s.catLabel)}</span>
        </div>
        <div class="card-foot">
          <span class="creator"><i>${escapeHtml((s.creator || 'O')[0])}</i><span>${escapeHtml(s.creator || 'OiiOii')}</span></span>
          <span class="uses">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M5 10l7-7 7 7"/></svg>
            ${fmt(s.uses)}
          </span>
        </div>
      </article>`;
  }

  function renderGrid() {
    const list = filtered();
    const grid = $('#styleGrid');
    grid.innerHTML = list.map(cardHTML).join('');
    $('#gridEmpty').hidden = list.length > 0;
  }

  function pushRecent(id) {
    recent = [id, ...recent.filter((x) => x !== id)].slice(0, 12);
    store.set('recent', recent);
  }

  function toggleFav(id) {
    if (favs.has(id)) { favs.delete(id); toast('已取消收藏'); }
    else { favs.add(id); toast('已收藏到「我的风格」'); }
    store.set('favs', [...favs]);
    updateFavCount();
    renderMine();
    $$(`[data-fav="${id}"]`).forEach((b) => b.classList.toggle('on', favs.has(id)));
    const mf = $('#modalFavBtn');
    if (mf && $('#styleModal').dataset.id === id) mf.textContent = favs.has(id) ? '已收藏 ✓' : '收藏';
  }

  function updateFavCount() { $('#favCount').textContent = String(favs.size); }

  /* ---------------- 详情弹窗 ---------------- */
  let lastFocus = null;
  function openModal(id) {
    const s = byId.get(id);
    if (!s) return;
    lastFocus = document.activeElement;
    const m = $('#styleModal');
    m.dataset.id = id;
    const r = RARITY[s.rarity] || RARITY.R;

    $('#modalImg').src = s.thumb;
    $('#modalImg').alt = s.name;
    $('#modalRarity').textContent = `${s.rarity} · ${r.label}`;
    $('#modalRarity').style.color = r.color;
    $('#modalRarity').style.boxShadow = `0 0 18px ${r.glow}`;
    $('#modalTitle').textContent = s.name;
    $('#modalEn').textContent = `${s.en || ''}${s.en ? ' · ' : ''}${s.catLabel}`;
    $('#modalTags').innerHTML = (s.tags || []).map((t) => `<span class="hit">${escapeHtml(t)}</span>`).join('')
      + `<span class="hit">作者 ${escapeHtml(s.creator || 'OiiOii')}</span>`
      + `<span class="hit">使用 ${fmt(s.uses)}</span>`;

    $('#modalDesc').textContent = s.desc || '';

    const facets = s.facets || [];
    $('#modalSpecs').innerHTML = facets.length
      ? facets.map((f) => `<div><dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(f.text)}</dd></div>`).join('')
      : `<div><dt>画风说明</dt><dd>${escapeHtml(s.full || s.desc || '')}</dd></div>`;

    const refGrid = $('#modalRefs');
    if (refGrid) {
      refGrid.innerHTML = (s.refs || []).map((r) =>
        `<img src="${r.file}" alt="${escapeHtml(r.label)}参考图" loading="lazy" title="${escapeHtml(r.label)}" />`).join('');
      refGrid.hidden = !(s.refs || []).length;
    }

    $('#modalPrompt').innerHTML = highlightTokens(s.full || s.desc || '');
    const tpl = `使用【${s.name}】画风。${s.full || s.desc || ''}\n场景：{场景}\n角色：{角色}\n镜头：{镜头}\n风格一致性：保持同一套材质、光线与色彩分级。`;
    $('#modalTemplate').innerHTML = highlightTokens(tpl);
    $('#modalNegative').textContent = s.negative || '（源站未提供负向描述）';

    $('#modalFavBtn').textContent = favs.has(id) ? '已收藏 ✓' : '收藏';
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    pushRecent(id);
    renderMine();
  }

  function closeModal() {
    $('#styleModal').hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function initModal() {
    const m = $('#styleModal');
    m.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !m.hidden) closeModal();
    });
    $('#copyPrompt').addEventListener('click', () => {
      const s = byId.get(m.dataset.id);
      if (s) copyText(s.full || s.desc || '', '风格提示词已复制');
    });
    $('#copyTemplate').addEventListener('click', () => {
      const s = byId.get(m.dataset.id);
      if (!s) return;
      copyText(`使用【${s.name}】画风。${s.full || s.desc || ''}\n场景：{场景}\n角色：{角色}\n镜头：{镜头}\n风格一致性：保持同一套材质、光线与色彩分级。`, '套用模板已复制');
    });
    $('#modalFavBtn').addEventListener('click', () => toggleFav(m.dataset.id));
    $('#modalDrawBtn').addEventListener('click', () => { closeModal(); scrollTo$('#gacha'); drawOne(); });
    $('#modalMatchBtn').addEventListener('click', () => { closeModal(); scrollTo$('#matcher'); });
  }

  function scrollTo$(sel) {
    const el = $(sel);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
  }

  /* ---------------- 抽卡 ---------------- */
  function rarityWeights() {
    const counts = { R: 0, SR: 0, SSR: 0 };
    LIB.forEach((s) => { counts[s.rarity] = (counts[s.rarity] || 0) + 1; });
    const total = LIB.length || 1;
    return counts;
  }

  function pickRandomStyle() {
    const w = rarityWeights();
    const total = LIB.length || 1;
    const r = Math.random() * total;
    let acc = 0;
    for (const k of ['R', 'SR', 'SSR']) {
      acc += w[k];
      if (r <= acc) {
        const pool = LIB.filter((s) => s.rarity === k);
        if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
        break;
      }
    }
    return LIB[Math.floor(Math.random() * LIB.length)];
  }

  let drawing = false;
  function drawOne() {
    if (drawing) return;
    drawing = true;
    const stage = $('#gachaStage');
    const deck = $('#deck');
    const status = $('#drawStatus');
    const rays = $('#gachaRays');
    deck.classList.add('shuffle');
    rays.classList.remove('on');
    status.textContent = '抽取中…';
    status.classList.add('on');

    setTimeout(() => {
      const s = pickRandomStyle();
      revealCard(s, () => {
        drawHistory = [{ id: s.id, ts: Date.now() }, ...drawHistory].slice(0, 30);
        store.set('draws', drawHistory);
        renderDrawHistory();
        deck.classList.remove('shuffle');
        status.textContent = `抽中：${s.name}（${s.rarity}）`;
        drawing = false;
      });
    }, 900);
  }

  function revealCard(s, done) {
    const stage = $('#gachaStage');
    const rays = $('#gachaRays');
    const r = RARITY[s.rarity] || RARITY.R;

    const card = document.createElement('div');
    card.className = 'draw-card';
    card.innerHTML = `
      <div class="face back"></div>
      <div class="face front">
        <img src="${s.thumb}" alt="${escapeHtml(s.name)}" />
        <span class="cap">${escapeHtml(s.name)}</span>
      </div>`;
    card.style.boxShadow = `0 30px 70px rgba(0,0,0,.65), 0 0 40px ${r.glow}`;
    stage.appendChild(card);

    requestAnimationFrame(() => {
      card.classList.add('flip');
      if (s.rarity === 'SSR') { rays.classList.add('on'); burst(stage, r); }
      else if (s.rarity === 'SR') { burst(stage, r, 26); }
    });

    setTimeout(() => {
      card.classList.remove('flip');
      setTimeout(() => {
        card.remove();
        rays.classList.remove('on');
        if (done) done();
      }, 850);
    }, 1500);
  }

  function drawTen() {
    if (drawing) return;
    drawing = true;
    const status = $('#drawStatus');
    const results = $('#drawResults');
    status.textContent = '十连抽取中…';
    status.classList.add('on');
    results.hidden = true;

    setTimeout(() => {
      const picks = [];
      for (let i = 0; i < 10; i++) picks.push(pickRandomStyle());
      results.innerHTML = picks.map((s, i) => `
        <article class="card" data-id="${s.id}" style="animation-delay:${i * 0.06}s" tabindex="0">
          <div class="card-media">
            <img src="${s.thumb}" alt="${escapeHtml(s.name)}" loading="lazy" />
            <div class="card-shade"></div>
            <span class="badge rarity" style="--rc:${(RARITY[s.rarity] || RARITY.R).color};--rg:${(RARITY[s.rarity] || RARITY.R).glow}">${s.rarity}</span>
            <h3 class="card-title">${escapeHtml(s.name)}</h3>
            <span class="card-en">${escapeHtml(s.en || s.catLabel)}</span>
          </div>
        </article>`).join('');
      results.hidden = false;
      picks.forEach((s) => {
        drawHistory = [{ id: s.id, ts: Date.now() }, ...drawHistory].slice(0, 30);
      });
      store.set('draws', drawHistory);
      renderDrawHistory();
      status.textContent = `十连完成：最高稀有度 ${picks.reduce((a, b) => (['R', 'SR', 'SSR'].indexOf(b.rarity) > ['R', 'SR', 'SSR'].indexOf(a.rarity) ? b : a)).rarity}`;
      drawing = false;
      results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 900);
  }

  function renderDrawHistory() {
    const box = $('#drawHistory');
    if (!drawHistory.length) { box.innerHTML = '<p class="muted">还没有抽取记录</p>'; return; }
    box.innerHTML = drawHistory.slice(0, 12).map((d) => {
      const s = byId.get(d.id);
      if (!s) return '';
      const r = RARITY[s.rarity] || RARITY.R;
      return `<div class="row" data-id="${s.id}"><img src="${s.thumb}" alt="" /><span>${escapeHtml(s.name)}</span><span class="r" style="color:${r.color}">${s.rarity}</span></div>`;
    }).join('');
  }

  /* ---------------- 粒子特效 ---------------- */
  function burst(stage, r, count) {
    const canvas = $('#gachaFx');
    if (!canvas) return;
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = rect.width / 2, cy = rect.height / 2;
    const n = count || (r.color === '#c084fc' ? 70 : 40);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 7;
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2,
        life: 1, size: 1 + Math.random() * 2.6,
        color: Math.random() > 0.45 ? r.color : '#ffffff',
      });
    }
    let raf;
    const loop = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      let alive = false;
      parts.forEach((p) => {
        if (p.life <= 0) return;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.99; p.vy *= 0.99; p.life -= 0.017;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (alive) raf = requestAnimationFrame(loop);
    };
    loop();
    setTimeout(() => cancelAnimationFrame(raf), 2200);
  }

  /* ---------------- 智能匹配 ---------------- */
  const SAMPLE = `【分镜 01】深夜，霓虹雨夜。林晚撑着一把黑伞站在天台边缘，风衣被风掀起。
旁白：她已经三年没有回过这座城市了。

【分镜 02】出租屋内，她打开母亲的旧木盒，里面是一张八十年代的照片。
林晚：妈，你到底还藏了多少事？

【分镜 03】办公室里，甲方把方案推了回来。
主管：这一稿，重做。

【分镜 04】深夜的写字楼，她独自加班到最后一层，咖啡凉了。

【分镜 05】地铁上，她收到一条陌生短信：「你以为她真的不在了？」`;

  const STEPS = [
    '读取文本并分句',
    '提取题材 / 时代 / 情绪 / 媒介',
    `检索风格库 ${LIB.length} 条画风特征`,
    '语义加权打分与去重',
    '生成 Top3 推荐',
  ];

  function initMatcher() {
    const drop = $('#dropzone');
    const file = $('#fileInput');
    const ta = $('#scriptInput');

    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') file.click(); });
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) { toast('文件超过 3MB，已读取前 3MB'); }
      const fr = new FileReader();
      fr.onload = () => {
        ta.value = String(fr.result || '').slice(0, 200000);
        toast(`已读取 ${f.name}`);
        $('#matchHint').textContent = `已载入 ${f.name}（${ta.value.length} 字）`;
      };
      fr.readAsText(f, 'utf-8');
    });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => { ta.value = String(fr.result || '').slice(0, 200000); toast(`已读取 ${f.name}`); };
      fr.readAsText(f, 'utf-8');
    });

    $('#sampleBtn').addEventListener('click', () => { ta.value = SAMPLE; toast('已载入示例剧本'); $('#matchHint').textContent = `示例剧本（${SAMPLE.length} 字）`; });
    $('#clearBtn').addEventListener('click', () => { ta.value = ''; $('#matchHint').textContent = '文本越长，匹配越准（建议 300 字以上）'; });
    $('#matchBtn').addEventListener('click', runMatch);
  }

  function runMatch() {
    const ta = $('#scriptInput');
    const text = ta.value.trim();
    if (text.length < 20) { toast('内容太短，至少 20 字才能匹配'); ta.focus(); return; }

    $('#scanIdle').hidden = true;
    $('#matchResult').hidden = true;
    $('#scanRunning').hidden = false;
    $('#scanSteps').innerHTML = STEPS.map((s, i) => `<div class="step" data-i="${i}"><span class="dot"></span><span>${escapeHtml(s)}</span></div>`).join('');

    const steps = $$('#scanSteps .step');
    let i = 0;
    const timer = setInterval(() => {
      if (i > 0) { steps[i - 1].classList.remove('on'); steps[i - 1].classList.add('done'); }
      if (i < steps.length) { steps[i].classList.add('on'); i++; }
      else {
        clearInterval(timer);
        setTimeout(showResults, 320);
      }
    }, 360);
  }

  function showResults() {
    const text = $('#scriptInput').value.trim();
    const { analysis, results } = window.StyleMatcher.match(text, LIB, 3);

    $('#scanRunning').hidden = true;
    $('#scanIdle').hidden = true;

    const chips = [];
    analysis.genres.forEach((g) => chips.push(`<span class="detect genre">${escapeHtml(g.label)}</span>`));
    analysis.eras.forEach((g) => chips.push(`<span class="detect">时代 · ${escapeHtml(g.label)}</span>`));
    analysis.moods.forEach((g) => chips.push(`<span class="detect">情绪 · ${escapeHtml(g.label)}</span>`));
    analysis.media.forEach((g) => chips.push(`<span class="detect">媒介 · ${escapeHtml(g.label)}</span>`));
    analysis.scenes.forEach((s) => chips.push(`<span class="detect">${escapeHtml(s)}</span>`));
    analysis.chars.forEach((s) => chips.push(`<span class="detect">${escapeHtml(s)}</span>`));

    const cards = results.map((r, i) => {
      const s = r.style;
      const rc = (RARITY[s.rarity] || RARITY.R).color;
      const hits = r.hits.slice(0, 5).map((h) => `<span class="hit${h.strong ? ' strong' : ''}">${escapeHtml(h.term)}</span>`).join('');
      const prompt = `使用【${s.name}】画风。${s.full || s.desc}`;
      return `
        <article class="match-card" data-id="${s.id}">
          <img src="${s.thumb}" alt="${escapeHtml(s.name)}" loading="lazy" />
          <div class="mc-body">
            <div class="mc-head">
              <h4>${escapeHtml(s.name)}</h4>
              <span class="hit">${escapeHtml(s.catLabel)}</span>
              <div class="score-ring" style="--p:${r.percent};--sc:${rc}"><span>${r.percent}</span></div>
            </div>
            <p class="mc-reason">${r.reason}</p>
            <div class="hit-tags">${hits}</div>
            <div class="mc-prompt">${escapeHtml(prompt)}</div>
            <div class="mc-actions">
              <button class="mini-btn" data-copy="${s.id}">复制提示词</button>
              <button class="mini-btn" data-detail="${s.id}">查看详情</button>
              <button class="mini-btn" data-fav2="${s.id}">收藏</button>
            </div>
          </div>
        </article>`;
    }).join('');

    $('#matchResult').innerHTML = `
      <div class="detect-strip">${chips.join('')}</div>
      ${cards}`;
    $('#matchResult').hidden = false;
    $('#matchHint').textContent = `匹配完成：${analysis.length} 字 · ${LIB.length} 条画风参与打分`;
    toast('已生成 3 种推荐画风');
  }

  /* ---------------- 我的风格 ---------------- */
  function renderMine() {
    const ids = [...favs, ...recent.filter((id) => !favs.has(id))];
    const list = ids.map((id) => byId.get(id)).filter(Boolean);
    $('#mineGrid').innerHTML = list.map((s, i) => cardHTML(s, i)).join('');
    $('#mineEmpty').hidden = list.length > 0;
    updateFavCount();
  }

  /* ---------------- 事件绑定 ---------------- */
  function initEvents() {
    $('#searchInput').addEventListener('input', (e) => { state.q = e.target.value.trim(); renderGrid(); });
    $('#sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });

    $('#styleGrid').addEventListener('click', (e) => {
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) { e.stopPropagation(); toggleFav(favBtn.dataset.fav); return; }
      const card = e.target.closest('.card');
      if (card) openModal(card.dataset.id);
    });
    $('#styleGrid').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const card = e.target.closest('.card');
      if (card) openModal(card.dataset.id);
    });
    $('#styleGrid').addEventListener('mousemove', (e) => {
      const media = e.target.closest('.card-media');
      if (!media) return;
      const rect = media.getBoundingClientRect();
      media.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
      media.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });

    $('#drawResults').addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) openModal(card.dataset.id);
    });
    $('#drawHistory').addEventListener('click', (e) => {
      const row = e.target.closest('.row');
      if (row) openModal(row.dataset.id);
    });
    $('#mineGrid').addEventListener('click', (e) => {
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) { e.stopPropagation(); toggleFav(favBtn.dataset.fav); return; }
      const card = e.target.closest('.card');
      if (card) openModal(card.dataset.id);
    });

    $('#matchResult').addEventListener('click', (e) => {
      const cp = e.target.closest('[data-copy]');
      if (cp) {
        const s = byId.get(cp.dataset.copy);
        if (s) copyText(`使用【${s.name}】画风。${s.full || s.desc}`, `【${s.name}】提示词已复制`);
        return;
      }
      const dt = e.target.closest('[data-detail]');
      if (dt) { openModal(dt.dataset.detail); return; }
      const f2 = e.target.closest('[data-fav2]');
      if (f2) { toggleFav(f2.dataset.fav2); return; }
      const card = e.target.closest('.match-card');
      if (card) openModal(card.dataset.id);
    });

    $('#drawOneBtn').addEventListener('click', drawOne);
    $('#drawTenBtn').addEventListener('click', drawTen);
    $('#navDrawBtn').addEventListener('click', () => { scrollTo$('#gacha'); setTimeout(drawOne, 420); });
    $('#navFavBtn').addEventListener('click', () => scrollTo$('#mine'));
    $('#clearMineBtn').addEventListener('click', () => {
      favs = new Set(); recent = []; store.set('favs', []); store.set('recent', []);
      renderMine(); toast('已清空本地收藏与记录');
    });

    $$('[data-scroll]').forEach((b) => b.addEventListener('click', () => scrollTo$(b.dataset.scroll)));

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== $('#scriptInput') && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault(); $('#searchInput').focus();
      }
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    initHero();
    initChips();
    initEvents();
    initModal();
    initMatcher();
    renderGrid();
    renderMine();
    renderDrawHistory();

    // 概率展示按真实库统计
    const w = rarityWeights();
    const rows = $$('.rate-row');
    const order = [['R', w.R], ['SR', w.SR], ['SSR', w.SSR]];
    rows.forEach((row, i) => {
      const b = row.querySelector('b');
      if (b && order[i]) b.textContent = ((order[i][1] / (LIB.length || 1)) * 100).toFixed(1) + '%';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
