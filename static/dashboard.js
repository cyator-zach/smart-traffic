let db = null;
let fbReady = false;
const fbStatusEl = document.getElementById('fb-status');

function setFbStatus(ok, msg) {
  if (fbStatusEl) {
    fbStatusEl.textContent = 'Firebase: ' + msg;
    fbStatusEl.style.color = ok ? 'var(--green)' : 'var(--red)';
  }
}

async function initFirebase() {
  try {
    const res = await fetch("/api/firebase-config");
    const firebaseConfig = await res.json();

    if (!firebaseConfig.apiKey) {
      console.warn('[Firebase] Konfigurasi kosong, pastikan .env terkonfigurasi.');
      setFbStatus(false, '⚠ Config .env belum diatur');
      return;
    }

    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    console.log('[Firebase] App initialized OK');

    // Monitor koneksi
    db.ref('.info/connected').on('value', snap => {
      fbReady = snap.val() === true;
      if (fbReady) {
        setFbStatus(true, '✓ Terhubung');
        console.log('[Firebase] Realtime DB: TERHUBUNG');
      } else {
        setFbStatus(false, '⚠ Menghubungkan…');
        console.warn('[Firebase] Realtime DB: belum terhubung / terputus');
      }
    });

    // Tulis test value saat load untuk verifikasi write permission
    setTimeout(() => {
      db.ref('_ping').set({ ts: Date.now(), from: 'dashboard' })
        .then(() => console.log('[Firebase] ✓ Test write berhasil → DB aktif & rules OK'))
        .catch(err => {
          console.error('[Firebase] ✗ Test write GAGAL:', err.code, err.message);
          setFbStatus(false, '✗ Write gagal: ' + err.code);
          if (err.code === 'PERMISSION_DENIED') {
            console.error('[Firebase] → Penyebab: Rules Firebase memblokir write.');
            console.error('[Firebase] → Solusi: Buka Firebase Console → Realtime Database → Rules → ubah ke:');
            console.error('[Firebase] →   { "rules": { ".read": true, ".write": true } }');
          } else if (err.code === 'NETWORK_ERROR' || err.message.includes('failed to fetch')) {
            console.error('[Firebase] → Penyebab: Database belum dibuat atau databaseURL salah.');
            console.error('[Firebase] → Solusi: Buka Firebase Console → Realtime Database → Create Database');
          }
        });
    }, 2000);
  } catch(e) {
    console.error('[Firebase] initializeApp GAGAL:', e.message);
    setFbStatus(false, '✗ Gagal init');
  }
}

initFirebase();

/**
 * Push status semua jalur ke Firebase Realtime Database.
 * Path: traffic_lights/lane_a | lane_b | lane_c
 */
function pushToFirebase(data) {
  if (!db) {
    console.warn('[Firebase] db null, skip push.');
    return;
  }
  const updates = {};
  data.forEach(d => {
    const key = `traffic_lights/lane_${d.lane}`;
    updates[key] = {
      light_status:   (d.light_status  || 'RED').toUpperCase(),
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

  db.ref().update(updates)
    .then(() => console.log('[Firebase] ✓ Data pushed:', Object.keys(updates)))
    .catch(err => {
      console.error('[Firebase] ✗ Push GAGAL:', err.code, '-', err.message);
      setFbStatus(false, '✗ ' + err.code);
    });
}

/** Tombol manual test Firebase write */
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
      setFbStatus(true, '✓ Write OK');
      console.log('[Firebase] Manual test write: BERHASIL ✓');
    })
    .catch(err => {
      btn.innerHTML = '<i class="bi bi-x-circle"></i> ' + err.code;
      btn.style.borderColor = 'var(--red)';
      btn.style.color = 'var(--red)';
      setFbStatus(false, '✗ ' + err.code);
      console.error('[Firebase] Manual test write GAGAL:', err.code, err.message);
      if (err.code === 'PERMISSION_DENIED') {
        alert('PERMISSION_DENIED\n\nSolusi:\n1. Buka Firebase Console\n2. Realtime Database → Rules\n3. Ubah rules menjadi:\n{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}');
      } else {
        alert('Error: ' + err.code + '\n' + err.message + '\n\nKemungkinan: Realtime Database belum dibuat di Firebase Console.');
      }
    })
    .finally(() => {
      setTimeout(() => {
        btn.innerHTML = '<i class="bi bi-wifi"></i> Test Firebase';
        btn.disabled = false;
        btn.style.borderColor = 'rgba(0,229,255,.3)';
        btn.style.color = 'var(--cyan)';
      }, 3000);
    });
}

/* ============================================================
   CLOCK
============================================================ */
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('id-ID', { hour12: false });
}
updateClock();
setInterval(updateClock, 1000);

/* ============================================================
   TRAFFIC LIGHT UI HELPERS
============================================================ */
function setTrafficLight(lane, status) {
  const red    = document.getElementById(`tl-red-${lane}`);
  const yellow = document.getElementById(`tl-yellow-${lane}`);
  const green  = document.getElementById(`tl-green-${lane}`);

  red.className    = 'tl-bulb red-bulb';
  yellow.className = 'tl-bulb yellow-bulb';
  green.className  = 'tl-bulb green-bulb';

  if (status === 'GREEN')  green.classList.add('green-on');
  if (status === 'YELLOW') yellow.classList.add('yellow-on');
  if (status === 'RED')    red.classList.add('red-on');
}

function setCardGlow(lane, status) {
  const card = document.getElementById(`card-${lane}`);
  card.classList.remove('active-green', 'active-yellow', 'active-red');
  if (status === 'GREEN')  card.classList.add('active-green');
  if (status === 'YELLOW') card.classList.add('active-yellow');
  if (status === 'RED')    card.classList.add('active-red');
}

function setDensityBadge(lane, density) {
  const el = document.getElementById(`density-${lane}`);
  el.textContent = density || '—';
  el.className = `density-badge ${density || ''}`;
}

/* ============================================================
   UPDATE DASHBOARD FROM API DATA
============================================================ */
function updateDashboard(data) {
  let totalAll = 0;
  let activeLane = '—';
  let activeCountdown = '--';

  data.forEach(d => {
    const lane = d.lane;

    document.getElementById(`car-${lane}`).textContent   = d.car   || 0;
    document.getElementById(`moto-${lane}`).textContent  = d.motorcycle || 0;
    document.getElementById(`bus-${lane}`).textContent   = d.bus   || 0;
    document.getElementById(`truck-${lane}`).textContent = d.truck || 0;
    document.getElementById(`total-${lane}`).textContent = d.total_vehicle || 0;

    setDensityBadge(lane, d.density);

    const status = (d.light_status || 'RED').toUpperCase();
    const statusEl = document.getElementById(`status-${lane}`);
    statusEl.textContent = status === 'GREEN' ? 'HIJAU' : status === 'YELLOW' ? 'KUNING' : 'MERAH';
    statusEl.className = `tl-status-text ${status}`;

    const cdEl = document.getElementById(`cd-${lane}`);
    cdEl.textContent = (status !== 'RED') ? (d.countdown || 0) : '--';
    cdEl.className = `countdown-val ${status}`;

    document.getElementById(`gdur-${lane}`).textContent = d.green_duration || '—';

    setTrafficLight(lane, status);
    setCardGlow(lane, status);

    const yoloWrap = document.getElementById(`yolo-wrap-${lane}`);
    if (d.yolo_image) {
      yoloWrap.innerHTML = `<img src="${d.yolo_image}" class="img-box"
        alt="YOLO ${lane.toUpperCase()}"
        onerror="this.parentElement.innerHTML='<div class=\\'img-placeholder\\'><i class=\\'bi bi-image-alt\\'></i><span>Gambar belum tersedia</span></div>'" />`;
    }

    totalAll += (d.total_vehicle || 0);
    if (status === 'GREEN' || status === 'YELLOW') {
      activeLane = d.lane_name || `Jalur ${lane.toUpperCase()}`;
      activeCountdown = (d.countdown || 0) + ' dtk';
    }
  });

  document.getElementById('sum-total').textContent    = totalAll;
  document.getElementById('sum-active-lane').textContent = activeLane;
  document.getElementById('sum-countdown').textContent   = activeCountdown;
}

/* ============================================================
   POLLING API /api/data SETIAP 3 DETIK + PUSH KE FIREBASE
============================================================ */
async function fetchData() {
  try {
    const res  = await fetch('/api/data');
    const data = await res.json();
    if (Array.isArray(data)) {
      updateDashboard(data);
      pushToFirebase(data);
    }
  } catch (e) {
    console.warn('[POLL] Gagal fetch /api/data:', e);
  }
}

fetchData();
setInterval(fetchData, 3000);

/* ============================================================
   UPLOAD IMAGE
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
    const res  = await fetch(`/upload/${lane}`, { method: 'POST', body: formData });
    const data = await res.json();
    progBar.style.width = '100%';

    if (data.success) {
      msg.className   = 'upload-msg success';
      msg.textContent = `✓ Jalur ${lane.toUpperCase()}: ${data.total_vehicle} kendaraan terdeteksi (${data.density})`;
      fileInput.value = '';
      setTimeout(fetchData, 300);
    } else {
      msg.className   = 'upload-msg error';
      msg.textContent = '✗ Error: ' + (data.error || 'Upload gagal');
    }
  } catch (e) {
    msg.className   = 'upload-msg error';
    msg.textContent = '✗ Koneksi error. Pastikan server berjalan.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-cloud-upload"></i> Upload';
    setTimeout(() => { prog.style.display = 'none'; progBar.style.width = '0%'; }, 800);
  }
}

/* ============================================================
   SEED DUMMY DATA
============================================================ */
async function seedDummy() {
  const btn = document.getElementById('btn-seed');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Mengisi…';
  try {
    const res  = await fetch('/api/seed', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      btn.innerHTML = '<i class="bi bi-check-circle"></i> Berhasil!';
      setTimeout(fetchData, 300);
    }
  } catch (e) { console.warn(e); }
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-database-fill-gear"></i> Isi Data Dummy';
  }, 2500);
}
