/* ================================================
   EMLAK OFİSİ YÖNETİM — Frontend v2 (UI Premium)
   ================================================ */

const API = '/api';

// ─── API ────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Sunucu hatası' }));
    throw new Error(err.error || 'Hata oluştu');
  }
  return res.json();
}

// ─── UI Helpers ─────────────────────────────────────
function setContent(html) {
  document.getElementById('main-content').innerHTML = html;
}

function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('modal-overlay').classList.add('hidden');
}

let _toastTimer;
function toast(msg, type = 'ok') {
  const el  = document.getElementById('toast');
  const msg_el = document.getElementById('toast-msg');
  msg_el.textContent = msg;
  msg_el.className = `px-5 py-3 rounded-xl shadow-xl text-sm font-medium text-white ${type === 'err' ? 'bg-red-600' : 'bg-slate-900'}`;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function fmt(n) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('tr-TR') + ' ₺';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}
function relDate(d) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (diff === 0) return 'bugün';
  if (diff === 1) return 'dün';
  if (diff < 0)  return 'yakında';
  return `${diff} gün önce`;
}
const STATUS_LABELS = {
  yeni             : 'Yeni',
  sicak            : 'Sıcak',
  ilik             : 'Ilık',
  soguk            : 'Soğuk',
  'aktif-musteri'  : 'Aktif Müşteri',
  aktif            : 'Aktif',
  opsiyonda        : 'Opsiyonda',
  satildi          : 'Satıldı',
  arsivlendi       : 'Arşivlendi',
  'kapandi-basarili': 'Kapandı ✓',
  'kapandi-vazgecti': 'Vazgeçti',
};
const STATUS_CSS = {
  yeni:'badge-yeni', sicak:'badge-sicak', ilik:'badge-ilik', soguk:'badge-soguk',
  'aktif-musteri':'badge-aktif', aktif:'badge-aktif', opsiyonda:'badge-opsiyonda',
  satildi:'badge-satildi', arsivlendi:'badge-arsivlendi',
  'kapandi-basarili':'badge-aktif', 'kapandi-vazgecti':'badge-soguk'
};
function statusBadge(s) {
  return `<span class="badge ${STATUS_CSS[s] || 'badge-soguk'}">${STATUS_LABELS[s] || s}</span>`;
}

// ─── Router ─────────────────────────────────────────
const routes = {
  '#/'          : renderDashboard,
  '#/portfoy'   : renderListings,
  '#/musteriler': renderCustomers,
  '#/pipeline'  : renderPipeline,
  '#/gorevler'  : renderTasks,
  '#/ayarlar'   : renderSettings,
};

function navigate() {
  const hash = location.hash || '#/pipeline';
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.getAttribute('href') === hash);
  });
  (routes[hash] || renderPipeline)();
}

window.addEventListener('hashchange', navigate);
window.addEventListener('load', () => {
  document.getElementById('current-date').textContent =
    new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });
  loadOfficeName();
  updateTaskBadge();
  if (!location.hash || location.hash === '#/') {
    location.hash = '#/pipeline';
  } else {
    navigate();
  }
});

async function loadOfficeName() {
  try {
    const s = await apiFetch('/settings');
    const name = s.office_name || 'Emlak Ofisi';
    document.getElementById('office-name-sidebar').textContent = name;
    if (s.logo_path) {
      const img = document.getElementById('sidebar-logo');
      img.src = s.logo_path + '?t=' + Date.now();
      img.classList.remove('hidden');
      document.getElementById('sidebar-logo-placeholder').classList.add('hidden');
    }
  } catch (_) {}
}

async function updateTaskBadge() {
  try {
    const tasks = await apiFetch('/tasks?status=bekliyor');
    const badge = document.getElementById('task-badge');
    if (tasks.length > 0) {
      badge.textContent = `${tasks.length} bekleyen görev`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (_) {}
}

// ─── Global Search ───────────────────────────────────
document.getElementById('global-search').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const q = e.target.value.trim();
  if (!q) return;
  try {
    const [listings, customers] = await Promise.all([
      apiFetch(`/listings?q=${encodeURIComponent(q)}`),
      apiFetch(`/customers?q=${encodeURIComponent(q)}`),
    ]);
    setContent(`
      <h2 class="text-lg font-bold text-gray-900 mb-5">"${q}" için sonuçlar</h2>
      ${listings.length ? `
        <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Portföyler (${listings.length})</h3>
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <table class="data-table">
            <thead><tr><th>Portföy</th><th>Konum</th><th>Oda</th><th>Fiyat</th><th>Durum</th><th></th></tr></thead>
            <tbody>${listings.map(tableRowListing).join('')}</tbody>
          </table>
        </div>` : ''}
      ${customers.length ? `
        <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Müşteriler (${customers.length})</h3>
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table class="data-table">
            <thead><tr><th>Ad Soyad</th><th>Telefon</th><th>Durum</th><th>Bütçe</th><th></th></tr></thead>
            <tbody>${customers.map(tableRowCustomer).join('')}</tbody>
          </table>
        </div>` : ''}
      ${!listings.length && !customers.length ? '<p class="text-gray-400 text-center mt-20 text-sm">Sonuç bulunamadı</p>' : ''}
    `);
  } catch (err) { toast(err.message, 'err'); }
});

// ─── DASHBOARD ──────────────────────────────────────
async function renderDashboard() {
  setContent(`<div class="text-center text-gray-400 mt-20 text-sm">Yükleniyor...</div>`);
  try {
    const { stats, recentInteractions, pendingTasks, callList } = await apiFetch('/dashboard');
    setContent(`
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Kontrol Paneli</h1>
          <p class="text-sm text-gray-400 mt-0.5">Günlük operasyon özeti</p>
        </div>
      </div>

      <!-- Hızlı İşlemler -->
      <div class="flex gap-3 mb-6 items-center">
        <button onclick="openCustomerModal()" class="btn-primary flex items-center gap-2 h-9">
          <span>👤</span> Yeni Aday Müşteri
        </button>
        <button onclick="openListingModal()" class="btn-secondary flex items-center gap-2 h-9">
          <span>🏢</span> Yeni Portföy
        </button>
        <button onclick="openNewTaskModal()" class="btn-secondary flex items-center gap-2 h-9">
          <span>✅</span> Görev Ekle
        </button>
      </div>

      <!-- KPI -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="kpi-blue rounded-xl px-5 py-4 text-white shadow-sm">
          <div class="text-2xl font-bold">${stats.activeListings}</div>
          <div class="text-xs text-blue-100 mt-0.5 font-medium">Aktif Portföy</div>
        </div>
        <div class="kpi-green rounded-xl px-5 py-4 text-white shadow-sm">
          <div class="text-2xl font-bold">${stats.activeCustomers}</div>
          <div class="text-xs text-green-100 mt-0.5 font-medium">Aktif Müşteri</div>
        </div>
        <div class="kpi-orange rounded-xl px-5 py-4 text-white shadow-sm">
          <div class="text-2xl font-bold">${stats.hotLeads}</div>
          <div class="text-xs text-orange-100 mt-0.5 font-medium">Sıcak Aday</div>
        </div>
        <div class="kpi-purple rounded-xl px-5 py-4 text-white shadow-sm">
          <div class="text-2xl font-bold">${stats.pendingTasks}</div>
          <div class="text-xs text-purple-100 mt-0.5 font-medium">Bekleyen Görev</div>
        </div>
      </div>

      <!-- Bugün Kimi Aramalıyım -->
      ${callList && callList.length > 0 ? `
      <div class="bg-white rounded-xl border border-orange-200 overflow-hidden shadow-sm mb-5">
        <div class="flex items-center justify-between px-5 py-4 border-b border-orange-100 bg-orange-50">
          <h2 class="font-semibold text-orange-900 text-sm">📞 Bugün Kimi Aramalıyım?</h2>
          <span class="text-xs text-orange-600 font-medium">${callList.length} kişi</span>
        </div>
        <div class="divide-y divide-gray-50">
          ${callList.map(c => `
            <div class="flex items-center gap-4 px-5 py-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-gray-900 text-sm">${c.name}</span>
                  ${statusBadge(c.status)}
                </div>
                <p class="text-xs text-gray-500 mt-0.5">${c.call_reason}</p>
              </div>
              <a href="tel:${c.phone}" class="font-mono text-sm text-blue-600 hover:text-blue-800 shrink-0">${c.phone}</a>
              <button onclick="openCustomerDetail(${c.id})" class="btn-ghost shrink-0">Profil</button>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Alt İki Panel -->
      <div class="grid lg:grid-cols-2 gap-5">

        <!-- Görevler -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 class="font-semibold text-gray-900 text-sm">Bekleyen Görevler</h2>
            <a href="#/gorevler" class="text-xs text-blue-600 hover:underline font-medium">Tümü →</a>
          </div>
          <div class="divide-y divide-gray-50">
            ${pendingTasks.length === 0
              ? `<p class="text-gray-400 text-xs text-center py-5">Bekleyen görev yok 🎉</p>`
              : pendingTasks.map(t => `
                  <div class="flex items-center gap-3 px-5 py-3">
                    <button onclick="completeTask(${t.id})" class="w-4 h-4 rounded border-2 border-gray-300 shrink-0 hover:border-blue-500 transition-colors"></button>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-gray-800 truncate">${t.title}</p>
                      ${t.customer_name ? `<p class="text-xs text-gray-400">${t.customer_name}</p>` : ''}
                    </div>
                    <span class="text-xs prio-${t.priority} shrink-0">${t.priority}</span>
                  </div>`).join('')
            }
          </div>
          <div class="px-5 py-3 border-t border-gray-100">
            <button onclick="openNewTaskModal()" class="text-xs text-blue-600 hover:underline font-medium">+ Yeni görev ekle</button>
          </div>
        </div>

        <!-- Son Etkileşimler -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 class="font-semibold text-gray-900 text-sm">Son Etkileşimler</h2>
            <a href="#/musteriler" class="text-xs text-blue-600 hover:underline font-medium">Müşteriler →</a>
          </div>
          <div class="divide-y divide-gray-50">
            ${recentInteractions.length === 0
              ? `<p class="text-gray-400 text-xs text-center py-5">Henüz etkileşim yok</p>`
              : recentInteractions.map(i => `
                  <div class="px-5 py-3.5">
                    <div class="flex items-center justify-between mb-1">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded shrink-0">${i.type}</span>
                        <span class="text-sm font-semibold text-gray-900 truncate">${i.customer_name}</span>
                      </div>
                      <span class="text-xs text-gray-400 shrink-0 ml-2">${relDate(i.created_at)}</span>
                    </div>
                    <p class="text-xs text-gray-500 leading-relaxed truncate">${i.content}</p>
                  </div>`).join('')
            }
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<p class="text-red-500 text-center mt-20 text-sm">Hata: ${err.message}</p>`);
  }
}

// ─── PIPELINE / KANBAN ───────────────────────────────
const STAGE_LABELS = {
  lead       : 'Aday Müşteri',
  nitelikli  : 'Nitelikli',
  gosterim   : 'Gösterim',
  teklif     : 'Teklif',
  pazarlik   : 'Pazarlık',
  kapandi    : 'Kapandı ✓',
  kaybedildi : 'Kaybedildi ✗',
};
const STAGE_COLORS = {
  lead       : 'bg-slate-100 border-slate-300',
  nitelikli  : 'bg-blue-50  border-blue-300',
  gosterim   : 'bg-purple-50 border-purple-300',
  teklif     : 'bg-amber-50  border-amber-300',
  pazarlik   : 'bg-orange-50 border-orange-300',
  kapandi    : 'bg-green-50  border-green-300',
  kaybedildi : 'bg-red-50    border-red-300',
};
const STAGE_HEADER = {
  lead       : 'bg-slate-300  text-slate-900',
  nitelikli  : 'bg-blue-200   text-blue-900',
  gosterim   : 'bg-purple-200 text-purple-900',
  teklif     : 'bg-amber-200  text-amber-900',
  pazarlik   : 'bg-orange-200 text-orange-900',
  kapandi    : 'bg-green-200  text-green-900',
  kaybedildi : 'bg-red-200    text-red-900',
};

async function renderPipeline() {
  setContent(`<div class="text-center text-gray-400 mt-20 text-sm">Yükleniyor...</div>`);
  try {
    const { stages, grouped, kpi } = await apiFetch('/pipeline');

    // KPI bar
    const totalActive = stages.filter(s => !['kapandi','kaybedildi'].includes(s))
      .reduce((a, s) => a + kpi[s], 0);

    setContent(`
      <div class="flex items-center justify-between mb-5">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Satış Süreci</h1>
          <p class="text-sm text-gray-400 mt-0.5">${totalActive} aktif fırsat</p>
        </div>
        <button onclick="openPipelineModal()" class="btn-primary">+ Yeni Fırsat</button>
      </div>

      <!-- KPI özet -->
      <div class="flex gap-3 mb-5 flex-wrap">
        ${stages.map(s => `
          <div class="bg-white border border-gray-200 rounded-xl px-5 py-3 text-center shadow-sm" style="min-width:90px;">
            <div class="text-2xl font-bold text-gray-900">${kpi[s]}</div>
            <div class="text-xs font-medium text-gray-500 mt-0.5">${STAGE_LABELS[s]}</div>
          </div>`).join('')}
      </div>

      <!-- Kanban board -->
      <div class="flex gap-4 overflow-x-auto pb-4" style="min-height:500px;">
        ${stages.map(s => `
          <div class="shrink-0 w-64 flex flex-col" style="min-width:240px;">
            <div class="flex items-center justify-between px-3 py-2 rounded-t-lg ${STAGE_HEADER[s]}">
              <span class="text-xs font-semibold uppercase tracking-wide">${STAGE_LABELS[s]}</span>
              <span class="text-xs font-bold bg-white/60 px-1.5 py-0.5 rounded-full">${kpi[s]}</span>
            </div>
            <div class="flex-1 border-x border-b border-gray-200 rounded-b-lg p-2 space-y-2 bg-gray-50/50 overflow-y-auto" style="max-height:480px;">
              ${grouped[s].length === 0
                ? `<p class="text-xs text-gray-300 text-center mt-6">Boş</p>`
                : grouped[s].map(item => pipelineCard(item, stages)).join('')
              }
              <button onclick="openPipelineModal(null,'${s}')"
                class="btn-primary w-full text-xs mt-1">
                + Ekle
              </button>
            </div>
          </div>`).join('')}
      </div>
    `);
  } catch (err) {
    setContent(`<p class="text-red-500 text-center mt-20 text-sm">Hata: ${err.message}</p>`);
  }
}

function pipelineCard(item, stages) {
  const stageOptions = stages.map(s =>
    `<option value="${s}" ${item.stage === s ? 'selected' : ''}>${STAGE_LABELS[s]}</option>`
  ).join('');
  return `
    <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
      <div class="flex items-start justify-between gap-2 mb-2">
        <p class="text-sm font-semibold text-gray-900 leading-tight">${item.title}</p>
        <button onclick="deletePipelineItem(${item.id})" class="text-gray-200 hover:text-red-400 text-base shrink-0">×</button>
      </div>
      ${item.customer_name ? `<p class="text-xs text-gray-600 font-medium mb-0.5">👤 ${item.customer_name}</p>` : ''}
      ${item.listing_title ? `<p class="text-xs text-gray-400 mb-1">🏢 ${item.listing_title}</p>` : ''}
      ${item.value ? `<p class="text-sm font-bold text-blue-700 mt-1 mb-1">${fmt(item.value)}</p>` : ''}
      ${item.notes ? `<p class="text-xs text-gray-400 italic mb-2 truncate">${item.notes}</p>` : ''}
      <div class="mt-2">
        <select onchange="movePipelineStage(${item.id}, this.value)"
          class="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50 text-gray-700 cursor-pointer">
          ${stageOptions}
        </select>
      </div>
      <p class="text-xs text-gray-300 mt-1">${relDate(item.updated_at)}</p>
    </div>`;
}

async function movePipelineStage(id, stage) {
  try {
    await apiFetch(`/pipeline/${id}/stage`, { method: 'PATCH', body: { stage } });
    toast('Aşama güncellendi');
    renderPipeline();
  } catch (err) { toast(err.message, 'err'); }
}

async function deletePipelineItem(id) {
  if (!confirm('Bu fırsatı silmek istiyor musunuz?')) return;
  await apiFetch(`/pipeline/${id}`, { method: 'DELETE' });
  toast('Fırsat silindi');
  renderPipeline();
}

async function openPipelineModal(id, defaultStage) {
  // Müşteri ve portföy listesi için dropdown
  const [customers, listings] = await Promise.all([
    apiFetch('/customers?status=tumu'),
    apiFetch('/listings?status=aktif'),
  ]);
  let item = {};
  if (id) { try { /* basit: mevcut veriyi yenile */ } catch (_) {} }

  const STAGES_ARR = ['lead','nitelikli','gosterim','teklif','pazarlik','kapandi','kaybedildi'];
  openModal(`
    <div class="p-6">
      <h2 class="text-lg font-bold text-gray-900 mb-5">${id ? 'Fırsatı Düzenle' : 'Yeni Fırsat Ekle'}</h2>
      <form id="pipeline-form" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-gray-700">Başlık *</label>
          <input name="title" required value="${item.title||''}" class="inp mt-1" placeholder="Müşteri adı veya portföy" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Aşama</label>
            <select name="stage" class="inp mt-1">
              ${STAGES_ARR.map(s => `<option value="${s}" ${(defaultStage||item.stage||'lead')===s?'selected':''}>${STAGE_LABELS[s]}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Tahmini Değer (₺)</label>
            <input name="value" type="number" value="${item.value||''}" class="inp mt-1" />
          </div>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Müşteri</label>
          <select name="customer_id" class="inp mt-1">
            <option value="">— Seçiniz —</option>
            ${customers.map(c => `<option value="${c.id}" ${item.customer_id==c.id?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Portföy</label>
          <select name="listing_id" class="inp mt-1">
            <option value="">— Seçiniz —</option>
            ${listings.map(l => `<option value="${l.id}" ${item.listing_id==l.id?'selected':''}>${l.title}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Notlar</label>
          <textarea name="notes" rows="2" class="inp mt-1">${item.notes||''}</textarea>
        </div>
        <div class="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onclick="closeModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">Kaydet</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('pipeline-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      if (id) await apiFetch(`/pipeline/${id}`, { method: 'PUT', body: data });
      else     await apiFetch('/pipeline', { method: 'POST', body: data });
      closeModal();
      toast(id ? 'Fırsat güncellendi' : 'Fırsat eklendi');
      renderPipeline();
    } catch (err) { toast(err.message, 'err'); }
  });
}

// ─── PORTFÖY (Tablo Görünümü) ────────────────────────
async function renderListings(filterStatus = 'aktif') {
  setContent(`<div class="text-center text-gray-400 mt-20 text-sm">Yükleniyor...</div>`);
  try {
    const listings = await apiFetch(`/listings?status=${filterStatus}`);
    const tabs = [
      { val: 'aktif',      label: 'Aktif' },
      { val: 'opsiyonda',  label: 'Opsiyonda' },
      { val: 'satildi',    label: 'Satıldı' },
      { val: 'arsivlendi', label: 'Arşivlendi' },
    ];
    setContent(`
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Portföy</h1>
          <p class="text-sm text-gray-400 mt-0.5">${listings.length} kayıt</p>
        </div>
        <button onclick="openListingModal()" class="btn-primary">+ Yeni Portföy</button>
      </div>

      <div class="flex gap-2 mb-5">
        ${tabs.map(t => `
          <button onclick="renderListings('${t.val}')"
            class="text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${filterStatus === t.val
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}">${t.label}
          </button>`).join('')}
      </div>

      ${listings.length === 0
        ? `<div class="text-center text-gray-400 mt-20">
             <div class="text-5xl mb-4">🏢</div>
             <p class="font-medium text-gray-500">Bu kategoride portföy yok</p>
             <button onclick="openListingModal()" class="mt-4 btn-primary">+ Portföy Ekle</button>
           </div>`
        : `<div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm" style="border-top:3px solid #2563eb;">
             <table class="data-table">
               <thead>
                 <tr>
                   <th>Portföy</th>
                   <th>Konum</th>
                   <th>Oda</th>
                   <th>m²</th>
                   <th>Fiyat</th>
                   <th>Durum</th>
                   <th style="width:90px"></th>
                 </tr>
               </thead>
               <tbody>
                 ${listings.map(tableRowListing).join('')}
               </tbody>
             </table>
           </div>`
      }
    `);
  } catch (err) {
    setContent(`<p class="text-red-500 text-center mt-20 text-sm">Hata: ${err.message}</p>`);
  }
}

function tableRowListing(l) {
  const typeLabel = l.type === 'satilik'
    ? `<span class="text-blue-600 font-semibold">Satılık</span>`
    : l.type === 'kiralik'
    ? `<span class="text-green-600 font-semibold">Kiralık</span>`
    : (l.type || '');
  return `
    <tr>
      <td>
        <div class="font-bold text-gray-900">${l.title}</div>
        <div class="text-xs mt-0.5">${typeLabel}</div>
      </td>
      <td class="text-gray-600">${[l.district, l.province].filter(Boolean).join(', ') || '—'}</td>
      <td class="text-gray-600">${l.room_count || '—'}</td>
      <td class="text-gray-600">${l.net_sqm ? l.net_sqm + ' m²' : '—'}</td>
      <td class="font-bold text-blue-700">${fmt(l.price)}</td>
      <td>${statusBadge(l.status)}</td>
      <td>
        <div class="flex gap-1.5">
          <button onclick="openListingDetail(${l.id})" class="btn-ghost">Detay</button>
          <button onclick="openListingModal(${l.id})" class="btn-ghost">Düzenle</button>
        </div>
      </td>
    </tr>`;
}

// ─── MÜŞTERİLER (Tablo Görünümü) ────────────────────
async function renderCustomers(filterStatus = 'tumu') {
  setContent(`<div class="text-center text-gray-400 mt-20 text-sm">Yükleniyor...</div>`);
  try {
    const customers = await apiFetch(`/customers?status=${filterStatus}`);
    const tabs = [
      { val: 'tumu',           label: 'Tümü' },
      { val: 'yeni',           label: 'Yeni' },
      { val: 'aktif-musteri',  label: 'Aktif Müşteri' },
    ];
    setContent(`
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Müşteriler</h1>
          <p class="text-sm text-gray-400 mt-0.5">${customers.length} kayıt</p>
        </div>
        <button onclick="openCustomerModal()" class="btn-primary">+ Yeni Aday Müşteri</button>
      </div>

      <div class="flex gap-2 mb-5 flex-wrap">
        ${tabs.map(t => `
          <button onclick="renderCustomers('${t.val}')"
            class="text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${filterStatus === t.val
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}">${t.label}
          </button>`).join('')}
      </div>

      ${customers.length === 0
        ? `<div class="text-center text-gray-400 mt-20">
             <div class="text-5xl mb-4">👥</div>
             <p class="font-medium text-gray-500">Müşteri bulunamadı</p>
             <button onclick="openCustomerModal()" class="mt-4 btn-primary">+ Aday Müşteri Ekle</button>
           </div>`
        : `<div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
             <table class="data-table">
               <thead>
                 <tr>
                   <th>Ad Soyad</th>
                   <th>Telefon</th>
                   <th>Durum</th>
                   <th>Kaynak</th>
                   <th>Bütçe</th>
                   <th>Son İletişim</th>
                   <th style="width:100px"></th>
                 </tr>
               </thead>
               <tbody>
                 ${customers.map(tableRowCustomer).join('')}
               </tbody>
             </table>
           </div>`
      }
    `);
  } catch (err) {
    setContent(`<p class="text-red-500 text-center mt-20 text-sm">Hata: ${err.message}</p>`);
  }
}

function tableRowCustomer(c) {
  return `
    <tr>
      <td class="font-semibold text-gray-900">${c.name}</td>
      <td class="text-gray-600 font-mono text-xs">${c.phone}</td>
      <td>${statusBadge(c.status)}</td>
      <td class="text-gray-500 text-xs">${c.source || '—'}</td>
      <td class="text-gray-600">${c.max_price ? fmt(c.max_price) : '—'}</td>
      <td class="text-gray-400 text-xs">${c.last_contact_at ? relDate(c.last_contact_at) : 'hiç'}</td>
      <td>
        <div class="flex gap-1">
          <button onclick="openCustomerDetail(${c.id})" class="btn-ghost">Profil</button>
          <button onclick="openCustomerModal(${c.id})" class="btn-ghost">Düzenle</button>
        </div>
      </td>
    </tr>`;
}

const TL_DOT = {
  arama:'tl-arama', not:'tl-not', gorusum:'tl-gorusum',
  gosterim:'tl-gosterim', teklif:'tl-teklif',
  email:'tl-email', mesaj:'tl-mesaj', gosteriminotu:'tl-gosterim'
};
const TL_ICON = {
  arama:'📞', not:'📝', gorusum:'🤝', email:'📧', mesaj:'💬',
  gosterim:'🏠', gosteriminotu:'🏠', teklif:'💰'
};

function buildTimeline(interactions, showings) {
  const items = [
    ...interactions.map(i => ({ ...i, _kind: 'interaction', _date: i.created_at })),
    ...showings.map(s => ({ ...s, _kind: 'showing', _date: s.date || s.created_at })),
  ].sort((a, b) => new Date(b._date) - new Date(a._date));

  if (items.length === 0) {
    return `<p class="text-gray-400 text-sm text-center py-6">Henüz aktivite yok</p>`;
  }

  return `<div class="timeline">${items.map(item => {
    if (item._kind === 'interaction') {
      const dotClass = TL_DOT[item.type] || 'tl-not';
      const icon = TL_ICON[item.type] || '📝';
      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotClass}">${icon}</div>
          <div class="ml-1">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">${item.type}</span>
              <span class="text-xs text-gray-400 ml-auto">${relDate(item.created_at)}</span>
            </div>
            <p class="text-sm text-gray-700">${item.content}</p>
            ${item.listing_title ? `<p class="text-xs text-gray-400 mt-0.5">🏢 ${item.listing_title}</p>` : ''}
          </div>
        </div>`;
    } else {
      return `
        <div class="timeline-item">
          <div class="timeline-dot tl-gosterim">🏠</div>
          <div class="ml-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold text-amber-700">Gösterim</span>
              <span class="badge result-${item.result} text-xs">${item.result}</span>
              ${item.price_feedback ? `<span class="badge pf-${item.price_feedback} text-xs">Fiyat: ${item.price_feedback}</span>` : ''}
              <span class="text-xs text-gray-400 ml-auto">${fmtDate(item._date)}</span>
            </div>
            ${item.listing_title ? `<p class="text-sm text-gray-700">🏢 ${item.listing_title}</p>` : ''}
            ${item.reason ? `<p class="text-xs text-gray-500 italic mt-0.5">${item.reason}</p>` : ''}
          </div>
        </div>`;
    }
  }).join('')}</div>`;
}

// ─── MÜŞTERİ DETAY ──────────────────────────────────
async function openCustomerDetail(id) {
  try {
    const c = await apiFetch(`/customers/${id}`);
    const n = c.needs || {};
    setContent(`
      <div class="mb-5">
        <button onclick="renderCustomers()" class="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          Müşteri listesine dön
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-5 shadow-sm">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex gap-2 mb-2">${statusBadge(c.status)}</div>
            <h1 class="text-2xl font-bold text-gray-900">${c.name}</h1>
            <p class="text-gray-500 mt-1 text-sm">📞 ${c.phone}${c.phone2 ? ' · ' + c.phone2 : ''}</p>
            ${c.email ? `<p class="text-gray-500 text-sm">✉️ ${c.email}</p>` : ''}
            <p class="text-xs text-gray-400 mt-2">Kaynak: ${c.source || '—'} · Eklenme: ${fmtDate(c.created_at)}</p>
          </div>
          <button onclick="openCustomerModal(${c.id})" class="btn-secondary text-sm">Düzenle</button>
        </div>
        ${n.intent ? `
          <div class="mt-5 pt-5 border-t border-gray-100">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Arama Kriteri</p>
            <p class="text-sm text-gray-700">
              ${[n.intent === 'alma' ? 'Almak istiyor' : 'Kiralamak istiyor',
                 n.room_counts,
                 n.districts,
                 n.min_price || n.max_price
                   ? (n.min_price ? fmt(n.min_price) : '?') + ' – ' + (n.max_price ? fmt(n.max_price) : '?')
                   : null,
                 n.urgency && n.urgency !== 'belirsiz' ? n.urgency : null,
                 n.financing && n.financing !== 'belirsiz' ? n.financing : null
               ].filter(Boolean).join(' · ')}
            </p>
            ${n.raw_note ? `<p class="text-xs text-gray-400 mt-1 italic">"${n.raw_note}"</p>` : ''}
          </div>` : ''}
      </div>

      <div class="grid lg:grid-cols-2 gap-5">

        <!-- Timeline (Etkileşimler + Gösterimler) -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 class="font-semibold text-gray-900 text-sm">Aktivite Zaman Çizelgesi</h2>
            <div class="flex gap-2">
              <button onclick="openShowingModal(${c.id})" class="btn-ghost">📍 Gösterim</button>
              <button onclick="openInteractionModal(${c.id})" class="btn-ghost">+ Not</button>
            </div>
          </div>
          <div class="p-5 max-h-96 overflow-y-auto">
            ${buildTimeline(c.interactions, c.showings || [])}
          </div>
        </div>

        <!-- Görevler -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 class="font-semibold text-gray-900 text-sm">Görevler</h2>
            <button onclick="openNewTaskModal(${c.id})" class="btn-ghost">+ Görev</button>
          </div>
          <div class="divide-y divide-gray-50">
            ${c.tasks.length === 0
              ? `<p class="text-gray-400 text-sm text-center py-8">Görev yok</p>`
              : c.tasks.map(t => `
                  <div class="flex items-center gap-3 px-5 py-3">
                    <input type="checkbox" ${t.status === 'tamamlandi' ? 'checked' : ''}
                      onchange="completeTask(${t.id}, this.checked)"
                      class="rounded border-gray-300 text-blue-600 cursor-pointer" />
                    <span class="text-sm flex-1 ${t.status === 'tamamlandi' ? 'line-through text-gray-400' : 'text-gray-800'}">${t.title}</span>
                    <span class="text-xs text-gray-400">${t.due_date || ''}</span>
                  </div>`).join('')
            }
          </div>
        </div>
      </div>
    `);
  } catch (err) { toast(err.message, 'err'); }
}

// ─── PORTFÖY MODAL ───────────────────────────────────
async function openListingModal(id) {
  let l = {};
  if (id) { try { l = await apiFetch(`/listings/${id}`); } catch (_) {} }
  const sel = (name, val) => name === val ? 'selected' : '';
  openModal(`
    <div class="p-6">
      <h2 class="text-lg font-bold text-gray-900 mb-5">${id ? 'Portföy Düzenle' : 'Yeni Portföy Ekle'}</h2>
      <form id="listing-form" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-gray-700">Başlık *</label>
          <input name="title" value="${l.title || ''}" required class="inp mt-1" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Tür</label>
            <select name="type" class="inp mt-1">
              <option value="satilik" ${sel(l.type,'satilik')}>Satılık</option>
              <option value="kiralik" ${sel(l.type,'kiralik')}>Kiralık</option>
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Oda Sayısı</label>
            <select name="room_count" class="inp mt-1">
              ${['','1+0','1+1','2+1','3+1','4+1','5+1','6+1'].map(r =>
                `<option value="${r}" ${sel(l.room_count,r)}>${r || '—'}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Brüt m²</label>
            <input name="gross_sqm" type="number" value="${l.gross_sqm || ''}" class="inp mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Net m²</label>
            <input name="net_sqm" type="number" value="${l.net_sqm || ''}" class="inp mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Fiyat (₺) *</label>
            <input name="price" type="number" value="${l.price || ''}" required class="inp mt-1" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Bulunduğu Kat</label>
            <input name="floor_number" type="number" value="${l.floor_number || ''}" class="inp mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Toplam Kat</label>
            <input name="total_floors" type="number" value="${l.total_floors || ''}" class="inp mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Bina Yaşı</label>
            <input name="building_age" type="number" value="${l.building_age || ''}" class="inp mt-1" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Cephe</label>
            <select name="facing" class="inp mt-1">
              ${['','kuzey','güney','doğu','batı','çift cephe'].map(f => `<option value="${f}" ${sel(l.facing,f)}>${f||'—'}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Isınma</label>
            <select name="heating_type" class="inp mt-1">
              ${[['kombi','Kombi'],['merkezi','Merkezi Sistem'],['yerden','Yerden Isıtma'],['klima','Klima'],['yok','Yok']].map(([v,t]) => `<option value="${v}" ${sel(l.heating_type,v)}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Tapu Tipi</label>
            <select name="deed_status" class="inp mt-1">
              ${[['','—'],['kat-mulkiyeti','Kat Mülkiyeti'],['kat-irtifaki','Kat İrtifakı'],['arsa-payi','Arsa Payı'],['hisseli','Hisseli']].map(([v,t]) => `<option value="${v}" ${sel(l.deed_status,v)}>${t}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Kullanım Durumu</label>
            <select name="occupancy_status" class="inp mt-1">
              ${[['bos','Boş'],['kirada','Kirada'],['mal-sahibi','Mal Sahibi Kullanıyor']].map(([v,t]) => `<option value="${v}" ${sel(l.occupancy_status,v)}>${t}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Aidat (₺/ay)</label>
            <input name="monthly_dues" type="number" value="${l.monthly_dues || ''}" class="inp mt-1" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex items-center gap-2 mt-1">
            <input name="is_furnished" type="checkbox" ${l.is_furnished ? 'checked' : ''} class="rounded border-gray-300 text-blue-600" />
            <label class="text-sm font-medium text-gray-700">Eşyalı</label>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <input name="is_in_site" type="checkbox" ${l.is_in_site ? 'checked' : ''} class="rounded border-gray-300 text-blue-600" />
            <label class="text-sm font-medium text-gray-700">Site İçi</label>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">İl</label>
            <input name="province" value="${l.province || 'İstanbul'}" class="inp mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">İlçe</label>
            <input name="district" value="${l.district || ''}" class="inp mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Mahalle</label>
            <input name="neighborhood" value="${l.neighborhood || ''}" class="inp mt-1" />
          </div>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Adres</label>
          <input name="address" value="${l.address || ''}" class="inp mt-1" />
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Açıklama</label>
          <textarea name="description" rows="3" class="inp mt-1">${l.description || ''}</textarea>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">İç Notlar</label>
          <textarea name="internal_notes" rows="2" class="inp mt-1">${l.internal_notes || ''}</textarea>
        </div>
        <div class="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onclick="closeModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">${id ? 'Güncelle' : 'Kaydet'}</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('listing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      if (id) await apiFetch(`/listings/${id}`, { method: 'PUT', body: data });
      else     await apiFetch('/listings', { method: 'POST', body: data });
      closeModal();
      toast(id ? 'Portföy güncellendi' : 'Portföy eklendi');
      renderListings();
    } catch (err) { toast(err.message, 'err'); }
  });
}

// ─── PORTFÖY DETAY ────────────────────────────────────
async function openListingDetail(id) {
  setContent(`<div class="text-center text-gray-400 mt-20 text-sm">Yükleniyor...</div>`);
  try {
    const { listing: l, matches } = await apiFetch(`/listings/${id}/matches`);

    const SCORE_COLOR = s => s >= 70 ? 'text-green-600' : s >= 40 ? 'text-amber-600' : 'text-gray-500';
    const SCORE_BG    = s => s >= 70 ? 'bg-green-50 border-green-200' : s >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200';

    setContent(`
      <div class="mb-5">
        <button onclick="renderListings()" class="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          Portföy listesine dön
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-5 shadow-sm">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex gap-2 mb-2">${statusBadge(l.status)}</div>
            <h1 class="text-2xl font-bold text-gray-900">${l.title}</h1>
            <p class="text-gray-500 mt-1 text-sm">${[l.neighborhood, l.district, l.province].filter(Boolean).join(', ')}</p>
            <div class="flex gap-4 mt-2 text-sm text-gray-600">
              ${l.room_count ? `<span>🛏 ${l.room_count}</span>` : ''}
              ${l.net_sqm ? `<span>📐 ${l.net_sqm} m²</span>` : ''}
              ${l.floor_number ? `<span>🏢 Kat ${l.floor_number}</span>` : ''}
            </div>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold text-blue-700">${fmt(l.price)}</p>
            ${l.monthly_dues ? `<p class="text-sm text-gray-400">Aidat: ${fmt(l.monthly_dues)}/ay</p>` : ''}
            <button onclick="openListingModal(${l.id})" class="btn-secondary text-sm mt-3">Düzenle</button>
          </div>
        </div>
        ${l.description ? `<p class="text-sm text-gray-600 mt-4 pt-4 border-t border-gray-100">${l.description}</p>` : ''}
        ${l.internal_notes ? `<p class="text-xs text-gray-400 italic mt-2">İç not: ${l.internal_notes}</p>` : ''}
      </div>

      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 class="font-semibold text-gray-900 text-sm">🎯 Kime Uygun?</h2>
          <span class="text-xs text-gray-500">${matches.length} eşleşme bulundu</span>
        </div>
        ${matches.length === 0
          ? `<p class="text-gray-400 text-sm text-center py-10">Kriterlere uyan müşteri bulunamadı</p>`
          : `<div class="divide-y divide-gray-50">
              ${matches.map(c => `
                <div class="flex items-center gap-4 px-5 py-4 ${SCORE_BG(c.score)} border-l-2 ${SCORE_BG(c.score)}">
                  <div class="shrink-0 text-center w-14">
                    <div class="text-xl font-bold ${SCORE_COLOR(c.score)}">${c.score}%</div>
                    <div class="text-xs text-gray-400">uyum</div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-semibold text-gray-900 text-sm">${c.name}</span>
                      ${statusBadge(c.status)}
                    </div>
                    <div class="flex flex-wrap gap-1">
                      ${c.reasons.map(r => `<span class="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded">${r}</span>`).join('')}
                    </div>
                    ${c.max_price ? `<p class="text-xs text-gray-400 mt-1">Bütçe: maks ${fmt(c.max_price)}</p>` : ''}
                  </div>
                  <div class="shrink-0 flex flex-col gap-1 items-end">
                    <a href="tel:${c.phone}" class="font-mono text-xs text-blue-600">${c.phone}</a>
                    <button onclick="openCustomerDetail(${c.id})" class="btn-ghost">Profil</button>
                  </div>
                </div>`).join('')}
            </div>`
        }
      </div>
    `);
  } catch (err) {
    setContent(`<p class="text-red-500 text-center mt-20 text-sm">Hata: ${err.message}</p>`);
  }
}

// ─── MÜŞTERİ MODAL ───────────────────────────────────
async function openCustomerModal(id) {
  let c = {};
  if (id) { try { c = await apiFetch(`/customers/${id}`); } catch (_) {} }
  const n = c.needs || {};
  const sel = (a, b) => a === b ? 'selected' : '';
  openModal(`
    <div class="p-6">
      <h2 class="text-lg font-bold text-gray-900 mb-5">${id ? 'Müşteri Düzenle' : 'Yeni Aday Müşteri Ekle'}</h2>
      <form id="customer-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Ad Soyad *</label>
            <input name="name" value="${c.name || ''}" required class="inp mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Telefon *</label>
            <input name="phone" value="${c.phone || ''}" required class="inp mt-1" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Durum</label>
            <select name="status" class="inp mt-1">
              ${[['yeni','Yeni'],['sicak','Sıcak'],['ilik','Ilık'],['soguk','Soğuk'],['aktif-musteri','Aktif Müşteri']].map(([v,t]) =>
                `<option value="${v}" ${sel(c.status,v)}>${t}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Kaynak</label>
            <select name="source" class="inp mt-1">
              ${[['sahibinden','Sahibinden'],['hurriyet','Hürriyet'],['referans','Referans'],['sosyal-medya','Sosyal Medya'],['tabela','Tabela'],['diger','Diğer']].map(([v,t]) =>
                `<option value="${v}" ${sel(c.source,v)}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="border-t border-gray-100 pt-4">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Arama Kriteri</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-sm font-medium text-gray-700">İşlem Tipi</label>
              <select name="intent" class="inp mt-1">
                <option value="alma" ${sel(n.intent,'alma')}>Almak istiyor</option>
                <option value="kiralama" ${sel(n.intent,'kiralama')}>Kiralamak istiyor</option>
              </select>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700">Oda Tercihi</label>
              <input name="room_counts" value="${n.room_counts || ''}" placeholder="3+1, 2+1" class="inp mt-1" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label class="text-sm font-medium text-gray-700">Min Bütçe (₺)</label>
              <input name="min_price" type="number" value="${n.min_price || ''}" class="inp mt-1" />
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700">Max Bütçe (₺)</label>
              <input name="max_price" type="number" value="${n.max_price || ''}" class="inp mt-1" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label class="text-sm font-medium text-gray-700">Min m²</label>
              <input name="min_sqm" type="number" value="${n.min_sqm || ''}" class="inp mt-1" />
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700">Max m²</label>
              <input name="max_sqm" type="number" value="${n.max_sqm || ''}" class="inp mt-1" />
            </div>
          </div>
          <div class="mt-3">
            <label class="text-sm font-medium text-gray-700">Tercih Semt/İlçe</label>
            <input name="districts" value="${n.districts || ''}" placeholder="Kadıköy, Beşiktaş" class="inp mt-1" />
          </div>
          <div class="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label class="text-sm font-medium text-gray-700">Aciliyet</label>
              <select name="urgency" class="inp mt-1">
                ${[['belirsiz','Belirsiz'],['acil-1ay','Acil (1 Ay)'],['3-ay','3 Ay İçinde'],['6-ay','6 Ay İçinde']].map(([v,t]) => `<option value="${v}" ${sel(n.urgency,v)}>${t}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700">Finansman</label>
              <select name="financing" class="inp mt-1">
                ${[['belirsiz','Belirsiz'],['nakit','Nakit'],['kredi','Kredi'],['karma','Karma']].map(([v,t]) => `<option value="${v}" ${sel(n.financing,v)}>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="mt-3">
            <label class="text-sm font-medium text-gray-700">Notlar</label>
            <textarea name="raw_note" rows="2" class="inp mt-1">${n.raw_note || ''}</textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onclick="closeModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">${id ? 'Güncelle' : 'Kaydet'}</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      if (id) await apiFetch(`/customers/${id}`, { method: 'PUT', body: data });
      else     await apiFetch('/customers', { method: 'POST', body: data });
      closeModal();
      toast(id ? 'Müşteri güncellendi' : 'Aday Müşteri eklendi');
      renderCustomers();
    } catch (err) { toast(err.message, 'err'); }
  });
}

// ─── ETKİLEŞİM MODAL ────────────────────────────────
function openInteractionModal(customerId) {
  openModal(`
    <div class="p-6">
      <h2 class="text-lg font-bold text-gray-900 mb-5">Not / Etkileşim Ekle</h2>
      <form id="interaction-form" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-gray-700">Tür</label>
          <select name="type" class="inp mt-1">
            ${['not','arama','mesaj','gorusum','gosteriminotu','email'].map(t =>
              `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">İçerik *</label>
          <textarea name="content" rows="4" required class="inp mt-1" placeholder="Görüşme notu, hatırlatıcı..."></textarea>
        </div>
        <div class="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onclick="closeModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">Kaydet</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('interaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await apiFetch(`/customers/${customerId}/interactions`, { method: 'POST', body: data });
      closeModal();
      toast('Not kaydedildi');
      openCustomerDetail(customerId);
    } catch (err) { toast(err.message, 'err'); }
  });
}

// ─── GÖSTERİM MODAL ─────────────────────────────────
async function openShowingModal(customerId) {
  let listings = [];
  try { listings = await apiFetch('/listings?status=aktif'); } catch (_) {}

  openModal(`
    <div class="p-6">
      <h2 class="text-lg font-bold text-gray-900 mb-5">📍 Gösterim Kaydı Ekle</h2>
      <form id="showing-form" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-gray-700">Portföy</label>
          <select name="listing_id" class="inp mt-1">
            <option value="">— Seçiniz —</option>
            ${listings.map(l => `<option value="${l.id}">${l.title} · ${l.district || ''} · ${fmt(l.price)}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Sonuç</label>
            <select name="result" class="inp mt-1">
              <option value="begendi">Beğendi</option>
              <option value="kararsiz" selected>Kararsız</option>
              <option value="begenmedi">Beğenmedi</option>
              <option value="teklif_verdi">Teklif Verdi</option>
              <option value="iptal">İptal</option>
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Fiyat Görüşü</label>
            <select name="price_feedback" class="inp mt-1">
              <option value="uygun" selected>Uygun</option>
              <option value="yuksek">Yüksek</option>
              <option value="dusuk">Düşük</option>
            </select>
          </div>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Gösterim Tarihi</label>
          <input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" class="inp mt-1" />
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Neden / Açıklama</label>
          <textarea name="reason" rows="3" class="inp mt-1" placeholder="Müşterinin yorumu, neden beğendi/beğenmedi..."></textarea>
        </div>
        <div class="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onclick="closeModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">Kaydet</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('showing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.customer_id = customerId;
    try {
      await apiFetch('/showings', { method: 'POST', body: data });
      closeModal();
      toast('Gösterim kaydedildi');
      openCustomerDetail(customerId);
    } catch (err) { toast(err.message, 'err'); }
  });
}

// ─── GÖREVLER ────────────────────────────────────────
async function renderTasks(filterStatus = 'bekliyor') {
  setContent(`<div class="text-center text-gray-400 mt-20 text-sm">Yükleniyor...</div>`);
  try {
    const tasks = await apiFetch(`/tasks?status=${filterStatus}`);
    setContent(`
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Görevler</h1>
          <p class="text-sm text-gray-400 mt-0.5">${tasks.length} kayıt</p>
        </div>
        <button onclick="openNewTaskModal()" class="btn-primary">+ Yeni Görev</button>
      </div>

      <div class="flex gap-2 mb-5">
        ${[{val:'bekliyor',label:'Bekleyenler'},{val:'tamamlandi',label:'Tamamlananlar'}].map(t => `
          <button onclick="renderTasks('${t.val}')"
            class="text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${filterStatus === t.val
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}">${t.label}
          </button>`).join('')}
      </div>

      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        ${tasks.length === 0
          ? `<div class="text-center text-gray-400 py-16">
               <div class="text-4xl mb-3">${filterStatus === 'bekliyor' ? '🎉' : '📋'}</div>
               <p class="text-sm">${filterStatus === 'bekliyor' ? 'Bekleyen görev yok!' : 'Tamamlanan görev yok'}</p>
             </div>`
          : `<table class="data-table">
               <thead>
                 <tr>
                   <th style="width:36px"></th>
                   <th>Görev</th>
                   <th>Müşteri</th>
                   <th>Son Tarih</th>
                   <th>Öncelik</th>
                   <th style="width:40px"></th>
                 </tr>
               </thead>
               <tbody>
                 ${tasks.map(t => `
                   <tr>
                     <td>
                       <input type="checkbox" ${t.status === 'tamamlandi' ? 'checked' : ''}
                         onchange="completeTask(${t.id}, this.checked)"
                         class="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                     </td>
                     <td class="font-medium ${t.status === 'tamamlandi' ? 'line-through text-gray-400' : 'text-gray-800'}">${t.title}</td>
                     <td class="text-gray-500 text-xs">${t.customer_name || '—'}</td>
                     <td class="text-gray-500 text-xs">${t.due_date || '—'}</td>
                     <td><span class="prio-${t.priority} text-xs font-medium">${t.priority}</span></td>
                     <td>
                       <button onclick="deleteTask(${t.id})" class="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                     </td>
                   </tr>`).join('')}
               </tbody>
             </table>`
        }
      </div>
    `);
  } catch (err) {
    setContent(`<p class="text-red-500 text-center mt-20 text-sm">Hata: ${err.message}</p>`);
  }
}

function openNewTaskModal(customerId) {
  openModal(`
    <div class="p-6">
      <h2 class="text-lg font-bold text-gray-900 mb-5">Yeni Görev</h2>
      <form id="task-form" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-gray-700">Görev *</label>
          <input name="title" required class="inp mt-1" placeholder="Görevi açıkla..." />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Son Tarih</label>
            <input name="due_date" type="date" class="inp mt-1" />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Öncelik</label>
            <select name="priority" class="inp mt-1">
              <option value="normal">Normal</option>
              <option value="acil">Acil</option>
              <option value="dusuk">Düşük</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onclick="closeModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">Ekle</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (customerId) data.customer_id = customerId;
    try {
      await apiFetch('/tasks', { method: 'POST', body: data });
      closeModal();
      toast('Görev eklendi');
      updateTaskBadge();
      renderTasks();
    } catch (err) { toast(err.message, 'err'); }
  });
}

async function completeTask(id, checked = true) {
  await apiFetch(`/tasks/${id}`, { method: 'PATCH', body: { status: checked ? 'tamamlandi' : 'bekliyor' } });
  updateTaskBadge();
  toast(checked ? '✓ Görev tamamlandı' : 'Görev yeniden açıldı');
}

async function deleteTask(id) {
  await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
  toast('Görev silindi');
  renderTasks();
  updateTaskBadge();
}

// ─── AYARLAR ─────────────────────────────────────────
async function renderSettings() {
  const s = await apiFetch('/settings');
  setContent(`
    <div class="max-w-xl space-y-5">
      <h1 class="text-2xl font-bold text-gray-900">Ayarlar</h1>

      <!-- Ofis Bilgileri -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 class="font-semibold text-gray-900 text-sm">Ofis Bilgileri</h2>
        </div>
        <div class="p-6">

          <!-- Logo -->
          <div class="flex items-start gap-5 mb-6 pb-6 border-b border-gray-100">
            <div>
              <div class="bg-white border border-gray-200 flex items-center justify-center overflow-hidden"
                   style="width:160px; height:100px; padding:16px; border-radius:12px;">
                <img id="logo-preview" src="${s.logo_path || ''}"
                     class="${s.logo_path ? '' : 'hidden'} object-contain"
                     style="max-width:128px; max-height:68px;" />
                <div id="logo-placeholder" class="${s.logo_path ? 'hidden' : ''} text-gray-300 text-xs text-center">
                  <div class="text-3xl mb-1">🏠</div>Logo yok
                </div>
              </div>
              <p class="text-xs text-gray-400 mt-2 text-center">PNG, JPG veya SVG · Maks 2 MB</p>
            </div>
            <div class="pt-2">
              <p class="text-sm font-medium text-gray-700 mb-3">Ofis Logosu</p>
              <label class="cursor-pointer">
                <span class="btn-secondary inline-block">Logo Yükle</span>
                <input type="file" id="logo-input" accept="image/png,image/jpeg,image/svg+xml"
                       class="hidden" onchange="uploadLogo(this)" />
              </label>
            </div>
          </div>

          <!-- Office + Advisor -->
          <form id="settings-form" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-gray-700">Ofis Adı</label>
                <input name="office_name" value="${s.office_name || ''}" class="inp mt-1" />
              </div>
              <div>
                <label class="text-sm font-medium text-gray-700">Danışman Adı</label>
                <input name="advisor_name" value="${s.advisor_name || ''}" class="inp mt-1" />
              </div>
            </div>

            <div class="border-t border-gray-100 pt-4">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">AI Ayarları</p>
              <div>
                <label class="text-sm font-medium text-gray-700">OpenAI API Key</label>
                <input name="ai_api_key" type="password" value="${s.ai_api_key || ''}"
                       placeholder="sk-..." class="inp mt-1 font-mono" />
                <p class="text-xs text-gray-400 mt-1">API key olmadan uygulama tam çalışır; AI özellikleri devre dışı kalır.</p>
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <button type="submit" class="btn-primary">Kaydet</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `);

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await apiFetch('/settings', { method: 'PUT', body: data });
      document.getElementById('office-name-sidebar').textContent = data.office_name || 'Emlak Ofisi';
      toast('Ayarlar kaydedildi');
    } catch (err) { toast(err.message, 'err'); }
  });
}

async function uploadLogo(input) {
  if (!input.files[0]) return;
  const formData = new FormData();
  formData.append('logo', input.files[0]);
  try {
    const res  = await fetch('/api/settings/logo', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const t = '?t=' + Date.now();
    // Settings preview
    const prev = document.getElementById('logo-preview');
    prev.src = data.path + t;
    prev.classList.remove('hidden');
    document.getElementById('logo-placeholder').classList.add('hidden');
    // Sidebar
    const sidebarImg = document.getElementById('sidebar-logo');
    sidebarImg.src = data.path + t;
    sidebarImg.classList.remove('hidden');
    document.getElementById('sidebar-logo-placeholder').classList.add('hidden');
    toast('Logo yüklendi');
  } catch (err) { toast(err.message, 'err'); }
}
