=// ========== المتغيرات ==========
let map, std, sat, ter, curL = 'standard', curM = null, uM = null, uC = null;
let uLat = null, uLng = null, uSpd = null, wId = null;
let favs = JSON.parse(localStorage.getItem('fvs') || '[]');
let hist = JSON.parse(localStorage.getItem('hst') || '[]');
let nav = false, navM = 'driving', navL = null, navKs = [];
let rS = null, rE = null, sLat = null, sLng = null, sNam = '', vOn = false;

const cts = {
    'دمشق':[33.5138,36.2765], 'حلب':[36.2021,37.1343], 'حمص':[34.7324,36.7137],
    'اللاذقية':[35.5214,35.7924], 'حماة':[35.1318,36.7578], 'دير الزور':[35.3333,40.1500]
};

// ========== تهيئة ==========
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('themeBtn').innerHTML = '<i class="fas fa-sun"></i>';
        document.getElementById('dark1').checked = true;
        document.getElementById('dark2').checked = true;
    }
    initMap();
    initEvents();
    startGPS();
    renderFavs();
    setTimeout(() => document.getElementById('loadingScreen').classList.add('hide'), 1500);
});

// ========== خريطة ==========
function initMap() {
    map = L.map('map', { center:[34.8021,38.9968], zoom:7, zoomControl:false, attributionControl:false });
    std = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);
    sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19 });
    ter = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom:17 });
    map.on('click', onMap);
}

function onMap(e) {
    const { lat, lng } = e.latlng;
    if (document.getElementById('pickMap').dataset.on === '1') {
        document.getElementById('endInp').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        rE = { lat, lng, name:'الوجهة' };
        document.getElementById('pickMap').dataset.on = '0';
        document.getElementById('pickMap').style.background = '';
        map.getContainer().style.cursor = '';
        calcRt(); return;
    }
    addMrk(lat, lng);
    getNm(lat, lng).then(n => {
        if (curM) curM.bindPopup(popup(n, lat, lng)).openPopup();
    });
}

function addMrk(lat, lng) {
    if (curM) map.removeLayer(curM);
    const ic = L.divIcon({ className:'custom-marker', html:'<div class="marker-pin"></div>', iconSize:[24,36], iconAnchor:[12,36] });
    curM = L.marker([lat, lng], { icon:ic }).addTo(map);
    map.flyTo([lat, lng], 15, { duration:1 });
}

function popup(n, lat, lng) {
    return `<div style="text-align:right;padding:4px;"><b>${n||'موقع'}</b><br><small style="color:#8fa3b8;">${lat.toFixed(5)}, ${lng.toFixed(5)}</small>
    <div style="margin-top:6px;display:flex;gap:4px;">
    <button onclick="goTo(${lat},${lng})" style="padding:4px 8px;background:#4facfe;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px;">🚗</button>
    <button onclick="share(${lat},${lng},'${n}')" style="padding:4px 8px;background:#8b5cf6;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px;">📤</button>
    <button onclick="addFv('${n}',${lat},${lng})" style="padding:4px 8px;background:#06d6a0;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px;">❤️</button>
    </div></div>`;
}

async function getNm(lat, lng) {
    try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`); return (await r.json()).display_name || 'موقع'; }
    catch { return 'موقع'; }
}

// ========== GPS ==========
function startGPS() {
    if (!navigator.geolocation) return;
    wId = navigator.geolocation.watchPosition(p => {
        uLat = p.coords.latitude; uLng = p.coords.longitude; uSpd = p.coords.speed;
        updUsr(); if (nav) chkNav();
    }, null, { enableHighAccuracy:true, timeout:30000, maximumAge:0 });
}

function updUsr() {
    if (!uLat) return;
    if (uM) map.removeLayer(uM);
    if (uC) map.removeLayer(uC);
    const ic = L.divIcon({ className:'custom-marker', html:'<div class="marker-pin u"></div>', iconSize:[24,36], iconAnchor:[12,36] });
    uM = L.marker([uLat, uLng], { icon:ic }).addTo(map);
    uC = L.circle([uLat, uLng], { radius:30, color:'#ff6b6b', fillOpacity:.1, weight:1 }).addTo(map);
}

// ========== مسار ==========
function calcRt() {
    if (!rS || !rE) return;
    const sp = { driving:60, walking:5, bicycling:15 };
    const a = L.latLng(rS.lat, rS.lng), b = L.latLng(rE.lat, rE.lng);
    const d = a.distanceTo(b), km = (d/1000).toFixed(1);
    const mn = Math.round(d/1000/sp[navM]*60);
    document.getElementById('rDist').textContent = km+' كم';
    document.getElementById('rTime').textContent = mn<60 ? mn+' د' : Math.floor(mn/60)+' س '+(mn%60)+' د';
    document.getElementById('rpResult').style.display = 'flex';
    if (navL) map.removeLayer(navL);
    navL = L.polyline([a,b], { color:'#4facfe', weight:3, dashArray:'8,8' }).addTo(map);
    map.fitBounds(L.latLngBounds([a,b]), { padding:[60,60] });
}

function startNav() {
    if (!rS || !rE) { tst('حدد نقطة الانطلاق والوجهة'); return; }
    nav = true;
    document.getElementById('navTop').style.display = 'flex';
    document.getElementById('rpResult').style.display = 'none';
    const ic = L.divIcon({ className:'custom-marker', html:'<div class="marker-pin n"></div>', iconSize:[24,36], iconAnchor:[12,36] });
    navKs.push(L.marker([rE.lat, rE.lng], { icon:ic }).addTo(map));
    if (uLat) map.setView([uLat, uLng], 16);
    hist.unshift({ id:Date.now(), from:rS.name, to:rE.name, date:new Date().toLocaleString('ar'), mode:navM });
    if (hist.length>30) hist=hist.slice(0,30);
    localStorage.setItem('hst', JSON.stringify(hist));
    chkNav(); tst('🚗 تم بدء الملاحة');
}

function chkNav() {
    if (!nav || !uLat || !rE) return;
    const u = L.latLng(uLat, uLng), e = L.latLng(rE.lat, rE.lng);
    const rem = u.distanceTo(e), km = (rem/1000).toFixed(1);
    const b = brng(uLat, uLng, rE.lat, rE.lng);
    const dirs = ['شمال','شمال شرق','شرق','جنوب شرق','جنوب','جنوب غرب','غرب','شمال غرب'];
    const dir = 'اتجه '+dirs[Math.round(b/45)%8];
    const spd = uSpd ? (uSpd*3.6).toFixed(0) : '0';
    const tL = spd>0 ? Math.round(rem/(spd/3.6)/60) : '--';
    document.getElementById('navDir').textContent = dir;
    document.getElementById('navDist').textContent = km+' كم';
    document.getElementById('navArr').style.transform = `rotate(${b}deg)`;
    if (vOn) spk(dir+'، '+km+' كيلومتر');
    if (rem<30) { stopNav(); tst('🎉 وصلت!'); }
}

function stopNav() {
    nav = false;
    document.getElementById('navTop').style.display = 'none';
    navKs.forEach(m => map.removeLayer(m)); navKs = [];
    if (navL) { map.removeLayer(navL); navL = null; }
}

function brng(lat1, lng1, lat2, lng2) {
    const d = (lng2-lng1)*Math.PI/180;
    const y = Math.sin(d)*Math.cos(lat2*Math.PI/180);
    const x = Math.cos(lat1*Math.PI/180)*Math.sin(lat2*Math.PI/180)-Math.sin(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.cos(d);
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
}

function goTo(lat, lng) {
    if (!uLat) { tst('انتظر تحديد موقعك'); return; }
    rS = { lat:uLat, lng:uLng, name:'موقعي' };
    rE = { lat, lng, name:'الوجهة' };
    document.getElementById('startInp').value = 'موقعي الحالي';
    document.getElementById('endInp').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    document.getElementById('routePanel').style.display = 'block';
    calcRt();
}

// ========== مشاركة ==========
function share(lat, lng, name) {
    sLat = lat; sLng = lng; sNam = name || 'موقع';
    document.getElementById('shTitle').textContent = sNam;
    document.getElementById('shCoords').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    document.getElementById('shareModal').classList.add('show');
}

function doShare(p) {
    if (!sLat) return;
    const app = `${location.origin}${location.pathname}?lat=${sLat}&lng=${sLng}&name=${encodeURIComponent(sNam)}`;
    const gm = `https://www.google.com/maps?q=${sLat},${sLng}`;
    const txt = `📍 ${sNam}\n🗺️ ${sLat.toFixed(5)}, ${sLng.toFixed(5)}\n🔗 ${app}\n🗺️ ${gm}`;
    const enc = encodeURIComponent(txt);
    const urls = {
        whatsapp:`https://wa.me/?text=${enc}`, facebook:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(app)}`,
        telegram:`https://t.me/share/url?url=${encodeURIComponent(app)}&text=${enc}`, messenger:`fb-messenger://share/?link=${encodeURIComponent(app)}`,
        sms:`sms:?body=${enc}`, copy:null
    };
    if (p==='copy') navigator.clipboard.writeText(txt).then(() => tst('تم النسخ'));
    else if (urls[p]) window.open(urls[p], '_blank');
    document.getElementById('shareModal').classList.remove('show');
}

// ========== مفضلة ==========
function addFv(name, lat, lng) {
    if (favs.find(f => f.lat===lat && f.lng===lng)) { tst('موجود مسبقاً'); return; }
    favs.unshift({ id:Date.now(), name:name||'موقع', lat, lng, date:new Date().toLocaleDateString('ar') });
    localStorage.setItem('fvs', JSON.stringify(favs));
    renderFavs(); tst('❤️ تم الحفظ');
}

function renderFavs() {
    const h = favs.length ? favs.map(f =>
        `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg3);border-radius:8px;margin-bottom:4px;" onclick="goFv(${f.lat},${f.lng})">
            <div style="display:flex;align-items:center;gap:6px;"><i class="fas fa-heart" style="color:#ff6b6b;"></i><span style="font-size:13px;">${f.name}</span></div>
            <button onclick="event.stopPropagation();delFv(${f.id})" style="background:none;border:none;color:#ff6b6b;cursor:pointer;">🗑️</button>
        </div>`
    ).join('') : '<p style="color:var(--tx3);text-align:center;">لا توجد مفضلة</p>';
    document.getElementById('favSide').innerHTML = h;
    document.getElementById('favList').innerHTML = h;
}

function goFv(lat, lng) { addMrk(lat, lng); document.getElementById('sidebar').classList.remove('show'); document.getElementById('overlay').classList.remove('show'); }
function delFv(id) { favs = favs.filter(f => f.id!==id); localStorage.setItem('fvs', JSON.stringify(favs)); renderFavs(); tst('تم الحذف'); }

// ========== أماكن قريبة ==========
async function nearBy(cat) {
    if (!uLat) { tst('حدد موقعك أولاً'); return; }
    const cats = { hospital:'مستشفى', pharmacy:'صيدلية', restaurant:'مطعم', fuel:'محطة وقود' };
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${cats[cat]}&limit=8&lat=${uLat}&lon=${uLng}&accept-language=ar`);
        const d = await r.json();
        map.eachLayer(l => { if (l._nb) map.removeLayer(l); });
        d.forEach(p => {
            const ic = L.divIcon({ className:'custom-marker', html:'<div class="marker-pin" style="background:#51cf66;"></div>', iconSize:[20,30], iconAnchor:[10,30] });
            const m = L.marker([p.lat, p.lon], { icon:ic }).addTo(map); m._nb = true;
            m.bindPopup(`<b>${p.display_name}</b>`);
        });
        tst(`تم العثور على ${d.length} ${cats[cat]}`);
    } catch { tst('تعذر البحث'); }
}

// ========== صوت ==========
function startVoice() {
    if (!('webkitSpeechRecognition' in window)) { tst('غير مدعوم'); return; }
    const rec = new webkitSpeechRecognition(); rec.lang = 'ar-SY';
    document.getElementById('voicePopup').style.display = 'flex';
    rec.start();
    rec.onresult = e => {
        document.getElementById('searchInput').value = e.results[0][0].transcript;
        document.getElementById('voicePopup').style.display = 'none';
        schCity(e.results[0][0].transcript);
    };
    rec.onerror = () => { document.getElementById('voicePopup').style.display = 'none'; };
}

function spk(t) {
    if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(t); u.lang = 'ar-SY'; u.rate = 1.1;
        speechSynthesis.speak(u);
    }
}

// ========== مساعدات ==========
function schCity(n) { const c = cts[n]; if (c) { addMrk(c[0], c[1]); document.getElementById('sidebar').classList.remove('show'); document.getElementById('overlay').classList.remove('show'); } }
function tst(m) { const t = document.getElementById('toast'); document.getElementById('toastMsg').textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }

// ========== أحداث ==========
function initEvents() {
    document.getElementById('menuBtn').onclick = () => { document.getElementById('sidebar').classList.add('show'); document.getElementById('overlay').classList.add('show'); };
    document.getElementById('sideClose').onclick = () => { document.getElementById('sidebar').classList.remove('show'); document.getElementById('overlay').classList.remove('show'); };
    document.getElementById('overlay').onclick = () => { document.getElementById('sidebar').classList.remove('show'); document.getElementById('overlay').classList.remove('show'); };

    document.getElementById('themeBtn').onclick = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark?'light':'dark');
        document.getElementById('themeBtn').innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
        document.getElementById('dark1').checked = !isDark;
        document.getElementById('dark2').checked = !isDark;
        localStorage.setItem('theme', isDark?'light':'dark');
    };

    document.getElementById('searchInput').oninput = function() {
        const q = this.value.trim();
        for (const [n, c] of Object.entries(cts)) { if (n.includes(q)) { schCity(n); break; } }
    };

    document.querySelectorAll('.ch[data-city]').forEach(b => b.onclick = () => schCity(b.dataset.city));
    document.querySelectorAll('.ch[data-nearby]').forEach(b => b.onclick = () => nearBy(b.dataset.nearby));

    document.getElementById('zoomIn').onclick = () => map.zoomIn();
    document.getElementById('zoomOut').onclick = () => map.zoomOut();
    document.getElementById('locateBtn').onclick = () => { if (uLat) map.setView([uLat, uLng], 16); };
    document.getElementById('layerBtn').onclick = () => {
        const p = document.getElementById('layerPopup');
        p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
    };
    document.querySelectorAll('.lp').forEach(b => b.onclick = function() {
        document.querySelectorAll('.lp').forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        map.removeLayer(std); map.removeLayer(sat); map.removeLayer(ter);
        const l = this.dataset.layer;
        if (l==='standard') std.addTo(map); else if (l==='satellite') sat.addTo(map); else ter.addTo(map);
        curL = l; document.getElementById('layerPopup').style.display = 'none';
    });

    document.querySelectorAll('.rpt').forEach(b => b.onclick = function() {
        document.querySelectorAll('.rpt').forEach(x => x.classList.remove('active'));
        this.classList.add('active'); navM = this.dataset.mode;
        if (rS && rE) calcRt();
    });

    document.getElementById('useCur').onclick = () => {
        if (uLat) { rS = { lat:uLat, lng:uLng, name:'موقعي' }; document.getElementById('startInp').value = 'موقعي الحالي'; if (rE) calcRt(); }
    };
    document.getElementById('pickMap').onclick = function() {
        this.dataset.on = '1'; this.style.background = 'var(--pr)'; map.getContainer().style.cursor = 'crosshair';
        tst('اضغط على الخريطة لتحديد الوجهة');
    };
    document.getElementById('startNavBtn').onclick = startNav;
    document.getElementById('navStop').onclick = stopNav;

    document.querySelectorAll('.bn').forEach(b => b.onclick = function() {
        document.querySelectorAll('.bn').forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        const p = this.dataset.panel;
        document.getElementById('routePanel').style.display = 'none';
        document.getElementById('favSheet').classList.remove('show');
        document.getElementById('setSheet').classList.remove('show');
        if (p === 'route') document.getElementById('routePanel').style.display = 'block';
    });
    document.getElementById('bnShare').onclick = () => {
        if (uLat) share(uLat, uLng, 'موقعي الحالي'); else tst('انتظر تحديد موقعك');
    };
    document.getElementById('bnFav').onclick = () => {
        document.getElementById('routePanel').style.display = 'none';
        document.getElementById('favSheet').classList.toggle('show');
        document.getElementById('setSheet').classList.remove('show');
    };
    document.getElementById('bnSet').onclick = () => {
        document.getElementById('routePanel').style.display = 'none';
        document.getElementById('setSheet').classList.toggle('show');
        document.getElementById('favSheet').classList.remove('show');
    };

    document.querySelectorAll('.shb').forEach(b => b.onclick = () => doShare(b.dataset.platform));
    document.getElementById('shCancel').onclick = () => document.getElementById('shareModal').classList.remove('show');
    document.getElementById('emCancel').onclick = () => document.getElementById('emModal').classList.remove('show');
    document.querySelectorAll('.modal-bg').forEach(bg => bg.onclick = function() { this.parentElement.classList.remove('show'); });

    const emH = (type) => {
        if (!uLat) { tst('حدد موقعك أولاً'); return; }
        const nums = { police:'112', ambulance:'110', fire:'113' };
        const txt = `🚨 طوارئ\n📍 ${uLat.toFixed(5)},${uLng.toFixed(5)}\n🔗 ${location.origin}${location.pathname}?lat=${uLat}&lng=${uLng}`;
        window.open(`tel:${nums[type]}`);
        setTimeout(() => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`), 500);
        document.getElementById('emModal').classList.remove('show');
    };
    document.getElementById('emPolice').onclick = () => emH('police');
    document.getElementById('emAmbulance').onclick = () => emH('ambulance');
    document.getElementById('emFire').onclick = () => emH('fire');

    document.getElementById('dark1').onchange = function() { document.getElementById('dark2').checked = this.checked; document.getElementById('themeBtn').click(); };
    document.getElementById('dark2').onchange = function() { document.getElementById('dark1').checked = this.checked; document.getElementById('themeBtn').click(); };
    document.getElementById('voice1').onchange = function() { vOn = this.checked; document.getElementById('voice2').checked = this.checked; };
    document.getElementById('voice2').onchange = function() { vOn = this.checked; document.getElementById('voice1').checked = this.checked; };
    document.getElementById('acc1').onchange = function() { document.getElementById('acc2').checked = this.checked; };
    document.getElementById('acc2').onchange = function() { document.getElementById('acc1').checked = this.checked; };

    document.getElementById('clearFavs').onclick = () => { favs = []; localStorage.setItem('fvs', '[]'); renderFavs(); tst('تم مسح المفضلة'); };
    document.getElementById('clearHist').onclick = () => { hist = []; localStorage.setItem('hst', '[]'); tst('تم مسح السجل'); };
    document.getElementById('voiceBtn').onclick = startVoice;

    // رابط
    const pr = new URLSearchParams(location.search);
    const pl = parseFloat(pr.get('lat')), pn = parseFloat(pr.get('lng')), pm = pr.get('name');
    if (pl && pn) setTimeout(() => {
        addMrk(pl, pn);
        tst(`📍 ${pm || 'موقع مشترك'}`);
        if (uLat && confirm('الانطلاق إلى هذا الموقع؟')) goTo(pl, pn);
    }, 2000);

    renderFavs();
}
