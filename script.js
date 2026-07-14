// ==================== المتغيرات ====================
let map, stdLayer, satLayer, terLayer, curLayer = 'standard';
let curMarker = null, userMarker = null, userCircle = null;
let uLat = null, uLng = null, uSpeed = null, watchId = null;
let favs = JSON.parse(localStorage.getItem('sf') || '[]');
let hist = JSON.parse(localStorage.getItem('sh') || '[]');
let navOn = false, navMode = 'driving';
let navLine = null, navMks = [], navInt = null;
let rStart = null, rEnd = null;
let shLat = null, shLng = null, shName = '';
let voiceOn = false;

const cities = {
    'دمشق':[33.5138,36.2765], 'حلب':[36.2021,37.1343], 'حمص':[34.7324,36.7137],
    'اللاذقية':[35.5214,35.7924], 'حماة':[35.1318,36.7578], 'دير الزور':[35.3333,40.1500],
    'الرقة':[35.9500,39.0167], 'طرطوس':[34.8833,35.8833]
};

// ==================== تهيئة ====================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMap();
    initEvents();
    startGPS();
    renderFavs();
    setTimeout(() => document.getElementById('loading').classList.add('hide'), 2000);
});

function initTheme() {
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('themeBtn').innerHTML = '<i class="fas fa-sun"></i>';
        document.getElementById('darkSwitch').checked = true;
        document.getElementById('darkSwitch2').checked = true;
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    const icon = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    document.getElementById('themeBtn').innerHTML = icon;
    document.getElementById('darkSwitch').checked = !isDark;
    document.getElementById('darkSwitch2').checked = !isDark;
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// ==================== الخريطة ====================
function initMap() {
    map = L.map('map', { center: [34.8021, 38.9968], zoom: 7, zoomControl: false, attributionControl: false });
    stdLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    terLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 });
    map.on('click', onMapClick);
}

function onMapClick(e) {
    const { lat, lng } = e.latlng;
    if (document.getElementById('pickMapBtn').dataset.on === '1') {
        document.getElementById('endInp').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        rEnd = { lat, lng, name: 'الوجهة' };
        document.getElementById('pickMapBtn').dataset.on = '0';
        document.getElementById('pickMapBtn').style.background = '';
        map.getContainer().style.cursor = '';
        calcRoute();
        return;
    }
    addMarker(lat, lng);
    getPlace(lat, lng).then(n => {
        if (curMarker) curMarker.bindPopup(popupHTML(n, lat, lng)).openPopup();
    });
}

function addMarker(lat, lng) {
    if (curMarker) map.removeLayer(curMarker);
    const icon = L.divIcon({ className: 'custom-marker', html: '<div class="marker-pin"></div>', iconSize: [26, 38], iconAnchor: [13, 38] });
    curMarker = L.marker([lat, lng], { icon }).addTo(map);
    map.flyTo([lat, lng], 15, { duration: 1 });
}

function popupHTML(name, lat, lng) {
    return `<div style="text-align:right;padding:5px;">
        <b>${name||'موقع'}</b><br><small style="color:#8fa3b8;">${lat.toFixed(5)}, ${lng.toFixed(5)}</small>
        <div style="margin-top:7px;display:flex;gap:5px;">
            <button onclick="goTo(${lat},${lng})" style="padding:5px 9px;background:#4facfe;border:none;border-radius:5px;color:#fff;cursor:pointer;font-size:11px;">🚗 انطلق</button>
            <button onclick="shareLoc(${lat},${lng},'${name}')" style="padding:5px 9px;background:#8b5cf6;border:none;border-radius:5px;color:#fff;cursor:pointer;font-size:11px;">📤</button>
            <button onclick="addFav('${name}',${lat},${lng})" style="padding:5px 9px;background:#06d6a0;border:none;border-radius:5px;color:#fff;cursor:pointer;font-size:11px;">❤️</button>
        </div></div>`;
}

async function getPlace(lat, lng) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`);
        return (await r.json()).display_name || 'موقع';
    } catch { return 'موقع'; }
}

// ==================== GPS ====================
function startGPS() {
    if (!navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(pos => {
        uLat = pos.coords.latitude; uLng = pos.coords.longitude; uSpeed = pos.coords.speed;
        updateUser();
        if (navOn) checkNav();
    }, null, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
}

function updateUser() {
    if (!uLat) return;
    if (userMarker) map.removeLayer(userMarker);
    if (userCircle) map.removeLayer(userCircle);
    const icon = L.divIcon({ className: 'custom-marker', html: '<div class="marker-pin user"></div>', iconSize: [26, 38], iconAnchor: [13, 38] });
    userMarker = L.marker([uLat, uLng], { icon }).addTo(map);
    userCircle = L.circle([uLat, uLng], { radius: 30, color: '#ff6b6b', fillOpacity: 0.1, weight: 1 }).addTo(map);
}

// ==================== مسار ====================
function calcRoute() {
    if (!rStart || !rEnd) return;
    const speeds = { driving: 60, walking: 5, bicycling: 15 };
    const s = L.latLng(rStart.lat, rStart.lng), e = L.latLng(rEnd.lat, rEnd.lng);
    const dist = s.distanceTo(e), km = (dist / 1000).toFixed(1);
    const min = Math.round(dist / 1000 / speeds[navMode] * 60);
    document.getElementById('rDist').textContent = km + ' كم';
    document.getElementById('rTime').textContent = min < 60 ? min + ' د' : Math.floor(min/60) + ' س ' + (min%60) + ' د';
    document.getElementById('routeRes').style.display = 'block';
    if (navLine) map.removeLayer(navLine);
    navLine = L.polyline([s, e], { color: '#4facfe', weight: 4, dashArray: '10,10' }).addTo(map);
    map.fitBounds(L.latLngBounds([s, e]), { padding: [60, 60] });
}

function startNav() {
    if (!rStart || !rEnd) { toast('حدد نقطة الانطلاق والوجهة'); return; }
    navOn = true;
    document.getElementById('navBar').style.display = 'block';
    document.getElementById('routeRes').style.display = 'none';
    const icon = L.divIcon({ className: 'custom-marker', html: '<div class="marker-pin nav"></div>', iconSize: [26, 38], iconAnchor: [13, 38] });
    const m = L.marker([rEnd.lat, rEnd.lng], { icon }).addTo(map);
    navMks.push(m);
    if (uLat) map.setView([uLat, uLng], 16);
    addHist();
    checkNav();
    toast('تم بدء الملاحة 🚗');
}

function checkNav() {
    if (!navOn || !uLat || !rEnd) return;
    const u = L.latLng(uLat, uLng), e = L.latLng(rEnd.lat, rEnd.lng);
    const rem = u.distanceTo(e), km = (rem / 1000).toFixed(1);
    const b = calcBear(uLat, uLng, rEnd.lat, rEnd.lng);
    const dirs = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
    const dir = 'اتجه ' + dirs[Math.round(b / 45) % 8];
    const spd = uSpeed ? (uSpeed * 3.6).toFixed(0) : '0';
    const tLeft = spd > 0 ? Math.round(rem / (spd / 3.6) / 60) : '--';
    document.getElementById('navDir').textContent = dir;
    document.getElementById('navDist').textContent = km + ' كم';
    document.getElementById('navTime').textContent = tLeft + ' د';
    document.getElementById('navSpeed').textContent = spd + ' كم/س';
    document.getElementById('navArrow').style.transform = `rotate(${b}deg)`;
    if (voiceOn) speak(dir + '، ' + km + ' كيلومتر');
    if (rem < 30) { stopNav(); toast('🎉 وصلت!'); }
}

function stopNav() {
    navOn = false;
    document.getElementById('navBar').style.display = 'none';
    navMks.forEach(m => map.removeLayer(m)); navMks = [];
    if (navLine) { map.removeLayer(navLine); navLine = null; }
}

function calcBear(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function goTo(lat, lng) {
    if (!uLat) { toast('انتظر تحديد موقعك'); return; }
    rStart = { lat: uLat, lng: uLng, name: 'موقعي' }; rEnd = { lat, lng, name: 'الوجهة' };
    document.getElementById('startInp').value = 'موقعي الحالي';
    document.getElementById('endInp').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    showRoute(); calcRoute();
}

// ==================== مشاركة ====================
function shareLoc(lat, lng, name) {
    shLat = lat; shLng = lng; shName = name || 'موقع';
    document.getElementById('shTitle').textContent = shName;
    document.getElementById('shCoords').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    document.getElementById('shareModal').classList.add('show');
}

function doShare(platform) {
    if (!shLat) return;
    const app = `${location.origin}${location.pathname}?lat=${shLat}&lng=${shLng}&name=${encodeURIComponent(shName)}`;
    const gm = `https://www.google.com/maps?q=${shLat},${shLng}`;
    const txt = `📍 ${shName}\n🗺️ ${shLat.toFixed(5)}, ${shLng.toFixed(5)}\n🔗 التطبيق: ${app}\n🗺️ Google: ${gm}`;
    const enc = encodeURIComponent(txt);
    const urls = { whatsapp: `https://wa.me/?text=${enc}`, facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(app)}`, telegram: `https://t.me/share/url?url=${encodeURIComponent(app)}&text=${enc}`, messenger: `fb-messenger://share/?link=${encodeURIComponent(app)}`, sms: `sms:?body=${enc}`, copy: null };
    if (platform === 'copy') { navigator.clipboard.writeText(txt).then(() => toast('تم النسخ')); }
    else if (urls[platform]) window.open(urls[platform], '_blank');
    closeModal('shareModal');
}

// ==================== مفضلة ====================
function addFav(name, lat, lng) {
    if (favs.find(f => f.lat === lat && f.lng === lng)) { toast('موجود مسبقاً'); return; }
    favs.unshift({ id: Date.now(), name: name || 'موقع', lat, lng, date: new Date().toLocaleDateString('ar') });
    localStorage.setItem('sf', JSON.stringify(favs));
    renderFavs(); toast('❤️ تم الحفظ');
}

function renderFavs() {
    const html = favs.length ? favs.map(f => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg3);border-radius:10px;margin-bottom:5px;" onclick="goFav(${f.lat},${f.lng})"><div style="display:flex;align-items:center;gap:8px;"><i class="fas fa-heart" style="color:#ff6b6b;"></i><div><b>${f.name}</b><br><small style="color:var(--tx3);">${f.date}</small></div></div><button onclick="event.stopPropagation();delFav(${f.id})" style="background:none;border:none;color:#ff6b6b;cursor:pointer;">🗑️</button></div>`).join('') : '<p style="color:var(--tx3);text-align:center;">لا توجد مفضلة</p>';
    document.getElementById('favList').innerHTML = html;
    document.getElementById('favSheetList').innerHTML = html;
}

function goFav(lat, lng) { addMarker(lat, lng); closeSidebar(); }
function delFav(id) { favs = favs.filter(f => f.id !== id); localStorage.setItem('sf', JSON.stringify(favs)); renderFavs(); toast('تم الحذف'); }

// ==================== سجل ====================
function addHist() {
    hist.unshift({ id: Date.now(), from: rStart.name, to: rEnd.name, date: new Date().toLocaleString('ar'), mode: navMode });
    if (hist.length > 30) hist = hist.slice(0, 30);
    localStorage.setItem('sh', JSON.stringify(hist));
}

// ==================== أماكن قريبة ====================
async function nearBy(cat) {
    if (!uLat) { toast('حدد موقعك أولاً'); return; }
    const cats = { hospital: 'مستشفى', pharmacy: 'صيدلية', restaurant: 'مطعم', fuel: 'محطة وقود', mosque: 'مسجد', cafe: 'مقهى' };
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${cats[cat]}&limit=10&lat=${uLat}&lon=${uLng}&accept-language=ar`);
        const d = await r.json();
        map.eachLayer(l => { if (l._nb) map.removeLayer(l); });
        d.forEach(p => {
            const icon = L.divIcon({ className: 'custom-marker', html: '<div class="marker-pin" style="background:#51cf66;"></div>', iconSize: [22, 32], iconAnchor: [11, 32] });
            const m = L.marker([p.lat, p.lon], { icon }).addTo(map); m._nb = true;
            m.bindPopup(`<b>${p.display_name}</b>`);
        });
        toast(`تم العثور على ${d.length} ${cats[cat]}`);
    } catch { toast('تعذر البحث'); }
}

// ==================== صوت ====================
function startVoice() {
    if (!('webkitSpeechRecognition' in window)) { toast('غير مدعوم'); return; }
    const rec = new webkitSpeechRecognition(); rec.lang = 'ar-SY';
    document.getElementById('voicePopup').style.display = 'flex';
    rec.start();
    rec.onresult = e => { document.getElementById('searchInput').value = e.results[0][0].transcript; document.getElementById('voicePopup').style.display = 'none'; searchCity(e.results[0][0].transcript); };
    rec.onerror = () => { document.getElementById('voicePopup').style.display = 'none'; };
}

function speak(t) { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(t); u.lang = 'ar-SY'; u.rate = 1.1; speechSynthesis.speak(u); } }

// ==================== مساعدات ====================
function searchCity(n) { const c = cities[n]; if (c) { addMarker(c[0], c[1]); closeSidebar(); } }
function showRoute() { document.getElementById('routeSheet').classList.remove('hide'); }
function hideRoute() { document.getElementById('routeSheet').classList.add('hide'); }
function openSidebar() { document.getElementById('sidebar').classList.add('show'); document.getElementById('overlay').classList.add('show'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('show'); document.getElementById('overlay').classList.remove('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function toast(m) { const t = document.getElementById('toast'); document.getElementById('toastMsg').textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }

// ==================== الأحداث ====================
function initEvents() {
    document.getElementById('menuBtn').addEventListener('click', openSidebar);
    document.getElementById('sideClose').addEventListener('click', closeSidebar);
    document.getElementById('overlay').addEventListener('click', closeSidebar);
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);

    document.getElementById('searchInput').addEventListener('input', function() {
        const q = this.value.trim();
        for (const [n, c] of Object.entries(cities)) { if (n.includes(q)) { searchCity(n); break; } }
    });

    document.querySelectorAll('.chip[data-city]').forEach(b => b.addEventListener('click', () => searchCity(b.dataset.city)));
    document.querySelectorAll('.chip[data-nearby]').forEach(b => b.addEventListener('click', () => nearBy(b.dataset.nearby)));

    document.getElementById('zoomIn').addEventListener('click', () => map.zoomIn());
    document.getElementById('zoomOut').addEventListener('click', () => map.zoomOut());
    document.getElementById('locateBtn').addEventListener('click', () => { if (uLat) map.setView([uLat, uLng], 16); });
    document.getElementById('layerBtn').addEventListener('click', () => {
        const m = document.getElementById('layerMenu');
        m.style.display = m.style.display === 'none' ? 'flex' : 'none';
    });
    document.querySelectorAll('.lm-opt').forEach(b => b.addEventListener('click', function() {
        document.querySelectorAll('.lm-opt').forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        map.removeLayer(stdLayer); map.removeLayer(satLayer); map.removeLayer(terLayer);
        const l = this.dataset.layer;
        if (l === 'standard') stdLayer.addTo(map); else if (l === 'satellite') satLayer.addTo(map); else terLayer.addTo(map);
        curLayer = l; document.getElementById('layerMenu').style.display = 'none';
    }));

    document.querySelectorAll('.tmode').forEach(b => b.addEventListener('click', function() {
        document.querySelectorAll('.tmode').forEach(x => x.classList.remove('active'));
        this.classList.add('active'); navMode = this.dataset.mode;
        if (rStart && rEnd) calcRoute();
    }));

    document.getElementById('useCurBtn').addEventListener('click', () => {
        if (uLat) { rStart = { lat: uLat, lng: uLng, name: 'موقعي' }; document.getElementById('startInp').value = 'موقعي الحالي'; if (rEnd) calcRoute(); }
    });
    document.getElementById('pickMapBtn').addEventListener('click', function() {
        this.dataset.on = '1'; this.style.background = 'var(--pr)'; map.getContainer().style.cursor = 'crosshair';
        toast('اضغط على الخريطة لتحديد الوجهة');
    });
    document.getElementById('swapBtn').addEventListener('click', () => {
        [rStart, rEnd] = [rEnd, rStart];
        document.getElementById('startInp').value = rStart ? rStart.name : '';
        document.getElementById('endInp').value = rEnd ? rEnd.name : '';
        if (rStart && rEnd) calcRoute();
    });
    document.getElementById('startNavBtn').addEventListener('click', startNav);
    document.getElementById('navStop').addEventListener('click', stopNav);
    document.getElementById('shareRouteBtn').addEventListener('click', () => { if (rEnd) shareLoc(rEnd.lat, rEnd.lng, rEnd.name); });

    document.querySelectorAll('.bn-item').forEach(item => {
        item.addEventListener('click', function() {
            const tab = this.dataset.tab;
            document.querySelectorAll('.bn-item').forEach(x => x.classList.remove('active'));
            this.classList.add('active');
            hideRoute();
            document.getElementById('favSheet').classList.remove('show');
            document.getElementById('setSheet').classList.remove('show');
            if (tab === 'route') showRoute();
        });
    });
    document.getElementById('bnFav').addEventListener('click', () => {
        hideRoute();
        document.getElementById('favSheet').classList.toggle('show');
        document.getElementById('setSheet').classList.remove('show');
    });
    document.getElementById('bnSettings').addEventListener('click', () => {
        hideRoute();
        document.getElementById('setSheet').classList.toggle('show');
        document.getElementById('favSheet').classList.remove('show');
    });
    document.getElementById('bnShare').addEventListener('click', () => {
        if (uLat) shareLoc(uLat, uLng, 'موقعي الحالي'); else toast('انتظر تحديد موقعك');
    });

    document.querySelectorAll('.sh-btn').forEach(b => b.addEventListener('click', () => doShare(b.dataset.platform)));
    document.getElementById('shCancel').addEventListener('click', () => closeModal('shareModal'));
    document.getElementById('emCancel').addEventListener('click', () => closeModal('emModal'));

    document.getElementById('headerEmergencyBtn')?.addEventListener('click', () => document.getElementById('emModal').classList.add('show'));
    
    const emHandler = (type) => {
        if (!uLat) { toast('حدد موقعك أولاً'); return; }
        const nums = { police: '112', ambulance: '110', fire: '113' };
        const txt = `🚨 طوارئ - ${type}\n📍 ${uLat.toFixed(5)},${uLng.toFixed(5)}\n🔗 ${location.origin}${location.pathname}?lat=${uLat}&lng=${uLng}`;
        window.open(`tel:${nums[type]}`);
        setTimeout(() => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`), 500);
        closeModal('emModal');
    };
    document.getElementById('emPolice')?.addEventListener('click', () => emHandler('police'));
    document.getElementById('emAmbulance')?.addEventListener('click', () => emHandler('ambulance'));
    document.getElementById('emFire')?.addEventListener('click', () => emHandler('fire'));

    document.getElementById('darkSwitch').addEventListener('change', toggleTheme);
    document.getElementById('darkSwitch2').addEventListener('change', toggleTheme);
    document.getElementById('voiceSwitch').addEventListener('change', function() { voiceOn = this.checked; });
    document.getElementById('voiceSwitch2').addEventListener('change', function() { voiceOn = this.checked; });
    document.getElementById('clearFavs').addEventListener('click', () => { favs = []; localStorage.setItem('sf', '[]'); renderFavs(); toast('تم مسح المفضلة'); });
    document.getElementById('clearHist').addEventListener('click', () => { hist = []; localStorage.setItem('sh', '[]'); toast('تم مسح السجل'); });
    document.getElementById('voiceBtn').addEventListener('click', startVoice);

    document.querySelectorAll('.modal-bg').forEach(bg => bg.addEventListener('click', function() { this.parentElement.classList.remove('show'); }));

    // رابط المشاركة
    const p = new URLSearchParams(location.search);
    const pl = parseFloat(p.get('lat')), pn = parseFloat(p.get('lng')), pm = p.get('name');
    if (pl && pn) setTimeout(() => { addMarker(pl, pn); toast(`📍 ${pm || 'موقع مشترك'}`); if (uLat && confirm('الانطلاق إلى هذا الموقع؟')) goTo(pl, pn); }, 2500);
}
