/**
 * Smart Traffic Light Monitoring — Dashboard Client
 *
 * Sections:
 *   1. Firebase (init, push, test)
 *   2. Clock
 *   3. Traffic Light UI Helpers
 *   4. Dashboard State & Rendering
 *   5. Local Countdown Ticker
 *   6. API Sync
 *   7. Image Upload
 *   8. Seed Dummy Data
 *   9. Theme Toggle
 */

/* ============================================================
   1. FIREBASE
============================================================ */
let db = null;
let fbReady = false;
const fbStatusEl = document.getElementById('fb-status');

function setFbStatus(ok, msg) {
  if (!fbStatusEl) return;
  fbStatusEl.textContent = 'Firebase: ' + msg;
  fbStatusEl.style.color = ok ? 'var(--green)' : 'var(--red)';
}

async function initFirebase() {
  try {
    const res = await fetch('/api/firebase-config');
    const cfg = await res.json();

    if (!cfg.apiKey) {
      setFbStatus(false, 'Config .env belum diatur');
      return;
    }

    firebase.initializeApp(cfg);
    db = firebase.database();

    db.ref('.info/connected').on('value', snap => {
      fbReady = snap.val() === true;
      setFbStatus(fbReady, fbReady ? 'Terhubung' : 'Menghubungkan…');
    });

    setTimeout(() => {
      db.ref('_ping').set({ ts: Date.now(), from: 'dashboard' })
        .catch(err => setFbStatus(false, 'Write gagal: ' + err.code));
    }, 2000);
  } catch (e) {
    setFbStatus(false, 'Gagal init');
  }
}

function pushToFirebase(data) {
  if (!db) return;
  const updates = {};
  data.forEach(d => {
    updates[`traffic_lights/lane_${d.lane}`] = {
      light_status:   (d.light_status || 'RED').toUpperCase(),
      countdown:      d.countdown      || 0,
      total_vehicle:  d.total_vehicle  || 0,
      density:        d.density        || 'SEPI',
      green_duration: d.green_duration || 10,
      car:            d.car            || 0,
      motorcycle:     d.motorcycle     || 0,
      bus:            d.bus            || 0,
      truck:          d.truck          || 0,
      updated_at:     d.updated_at     || ''
    };
  });
  updates['last_sync'] = Date.now();
  db.ref().update(updates).catch(err => setFbStatus(false, err.code));
}

function testFirebase() {
  if (!db) {
    alert('Firebase tidak terinisialisasi. Cek konfigurasi .env atau console (F12).');
    return;
  }

  const btn = document.getElementById('btn-fb-test');
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Testing…';
  btn.disabled = true;

  db.ref('_ping').set({ ts: Date.now(), manual: true })
    .then(() => {
      btn.innerHTML = '<i class="bi bi-check-circle"></i> Berhasil!';
      btn.style.borderColor = 'var(--green)';
      btn.style.color = 'var(--green)';
      setFbStatus(true, 'Write OK');
    })
    .catch(err => {
      btn.innerHTML = '<i class="bi bi-x-circle"></i> ' + err.code;
      btn.style.borderColor = 'var(--red)';
      btn.style.color = 'var(--red)';
      setFbStatus(false, err.code);
      if (err.code === 'PERMISSION_DENIED') {
        alert('PERMISSION_DENIED\n\nSolusi:\n1. Buka Firebase Console\n2. Realtime Database → Rules\n3. Ubah rules menjadi:\n{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}');
      } else {
        alert('Error: ' + err.code + '\n' + err.message);
      }
    })
    .finally(() => {
      setTimeout(() => {
        btn.innerHTML = '<i class="bi bi-wifi"></i> Test Firebase';
        btn.disabled = false;
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 3000);
    });
}

initFirebase();

/* ============================================================
   2. CLOCK
============================================================ */
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('id-ID', { hour12: false });
}
updateClock();
setInterval(updateClock, 1000);

/* ============================================================
   3. TRAFFIC LIGHT UI HELPERS
============================================================ */
const LANES = ['a', 'b', 'c'];

function setTrafficLight(lane, status) {
  ['red', 'yellow', 'green'].forEach(color => {
    const el = document.getElementById(`tl-${color}-${lane}`);
    el.className = `tl-bulb ${color}-bulb`;
  });
  const activeMap = { GREEN: 'green-on', YELLOW: 'yellow-on', RED: 'red-on' };
  const activeClass = activeMap[status];
  if (activeClass) {
    const color = status.toLowerCase();
    document.getElementById(`tl-${color}-${lane}`).classList.add(activeClass);
  }
}

function setCardGlow(lane, status) {
  const card = document.getElementById(`card-${lane}`);
  card.classList.remove('active-green', 'active-yellow', 'active-red');
  const glowMap = { GREEN: 'active-green', YELLOW: 'active-yellow', RED: 'active-red' };
  if (glowMap[status]) card.classList.add(glowMap[status]);
}

function setDensityBadge(lane, density) {
  const el = document.getElementById(`density-${lane}`);
  el.textContent = density || '—';
  el.className = `density-badge ${density || ''}`;
}

const STATUS_LABEL = { GREEN: 'HIJAU', YELLOW: 'KUNING', RED: 'MERAH' };

/* ============================================================
   4. DASHBOARD STATE & RENDERING
============================================================ */
const laneState = {};

function updateDashboard(data) {
  let totalAll = 0;

  data.forEach(d => {
    const lane = d.lane;
    const status = (d.light_status || 'RED').toUpperCase();

    laneState[lane] = {
      status,
      countdown:     d.countdown || 0,
      laneName:      d.lane_name || `Jalur ${lane.toUpperCase()}`,
    };

    document.getElementById(`car-${lane}`).textContent   = d.car || 0;
    document.getElementById(`moto-${lane}`).textContent  = d.motorcycle || 0;
    document.getElementById(`bus-${lane}`).textContent   = d.bus || 0;
    document.getElementById(`truck-${lane}`).textContent = d.truck || 0;
    document.getElementById(`total-${lane}`).textContent = d.total_vehicle || 0;
    document.getElementById(`gdur-${lane}`).textContent  = d.green_duration || '—';

    setDensityBadge(lane, d.density);
    updateYoloImage(lane, d.yolo_image);

    totalAll += (d.total_vehicle || 0);
  });

  document.getElementById('sum-total').textContent = totalAll;
  renderLiveState();
}

function updateYoloImage(lane, imageUrl) {
  if (!imageUrl) return;
  const wrap = document.getElementById(`yolo-wrap-${lane}`);
  const existing = wrap.querySelector('img');
  const basePath = imageUrl.split('?')[0];
  if (existing && existing.src.includes(basePath)) return;

  wrap.innerHTML = `<img src="${imageUrl}" class="img-box"
    alt="YOLO ${lane.toUpperCase()}"
    onerror="this.parentElement.innerHTML='<div class=\\'img-placeholder\\'><i class=\\'bi bi-image-alt\\'></i><span>Gambar belum tersedia</span></div>'" />`;
}

function renderLiveState() {
  let activeLane = '—';
  let activeCountdown = '--';

  LANES.forEach(lane => {
    const s = laneState[lane];
    if (!s) return;

    const statusEl = document.getElementById(`status-${lane}`);
    statusEl.textContent = STATUS_LABEL[s.status] || 'MERAH';
    statusEl.className = `tl-status-text ${s.status}`;

    const cdEl = document.getElementById(`cd-${lane}`);
    cdEl.textContent = s.status !== 'RED' ? s.countdown : '--';
    cdEl.className = `countdown-val ${s.status}`;

    setTrafficLight(lane, s.status);
    setCardGlow(lane, s.status);

    if (s.status === 'GREEN' || s.status === 'YELLOW') {
      activeLane = s.laneName;
      activeCountdown = s.countdown + ' dtk';
    }
  });

  document.getElementById('sum-active-lane').textContent = activeLane;
  document.getElementById('sum-countdown').textContent = activeCountdown;
}

/* ============================================================
   5. LOCAL COUNTDOWN TICKER
============================================================ */
setInterval(() => {
  let changed = false;
  LANES.forEach(lane => {
    const s = laneState[lane];
    if (!s) return;
    if ((s.status === 'GREEN' || s.status === 'YELLOW') && s.countdown > 0) {
      s.countdown--;
      changed = true;
    }
  });
  if (changed) renderLiveState();
}, 1000);

/* ============================================================
   6. API SYNC
============================================================ */
async function fetchData() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    if (Array.isArray(data)) {
      updateDashboard(data);
      pushToFirebase(data);
    }
  } catch (e) {
    console.warn('[SYNC] Gagal fetch /api/data:', e);
  }
}

fetchData();
setInterval(fetchData, 5000);

/* ============================================================
   7. IMAGE UPLOAD
============================================================ */
async function uploadImage(event, lane) {
  event.preventDefault();

  const fileInput = document.getElementById(`file-${lane}`);
  const btn       = document.getElementById(`btn-${lane}`);
  const msg       = document.getElementById(`msg-${lane}`);
  const prog      = document.getElementById(`prog-${lane}`);
  const progBar   = prog.querySelector('.upload-progress-bar');

  if (!fileInput.files.length) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Proses…';
  msg.className = 'upload-msg';
  msg.textContent = '';
  prog.style.display = 'block';
  progBar.style.width = '30%';

  const formData = new FormData();
  formData.append('image', fileInput.files[0]);

  try {
    progBar.style.width = '70%';
    const res = await fetch(`/upload/${lane}`, { method: 'POST', body: formData });
    const data = await res.json();
    progBar.style.width = '100%';

    if (data.success) {
      msg.className = 'upload-msg success';
      msg.textContent = `✓ Jalur ${lane.toUpperCase()}: ${data.total_vehicle} kendaraan terdeteksi (${data.density})`;
      fileInput.value = '';
      setTimeout(fetchData, 300);
    } else {
      msg.className = 'upload-msg error';
      msg.textContent = '✗ Error: ' + (data.error || 'Upload gagal');
    }
  } catch (e) {
    msg.className = 'upload-msg error';
    msg.textContent = '✗ Koneksi error. Pastikan server berjalan.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-cloud-upload"></i> Upload';
    setTimeout(() => { prog.style.display = 'none'; progBar.style.width = '0%'; }, 800);
  }
}

/* ============================================================
   8. SEED DUMMY DATA
============================================================ */
async function seedDummy() {
  const btn = document.getElementById('btn-seed');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Mengisi…';

  try {
    const res = await fetch('/api/seed', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      btn.innerHTML = '<i class="bi bi-check-circle"></i> Berhasil!';
      setTimeout(fetchData, 300);
    }
  } catch (e) {
    console.warn(e);
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-database-fill-gear"></i> Isi Data Dummy';
  }, 2500);
}

/* ============================================================
   9. THEME TOGGLE
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  const icon = btn.querySelector('i');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  icon.className = currentTheme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    icon.className = next === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });
});
