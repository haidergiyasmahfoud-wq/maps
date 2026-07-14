// ==================== المتغيرات ====================
let map, standardLayer, satelliteLayer, terrainLayer, currentLayer = 'standard';
let currentMarker = null, userMarker = null, userCircle = null;
let userLat = null, userLng = null, userSpeed = null, watchId = null;
let favorites = JSON.parse(localStorage.getItem('syFavs') || '[]');
let history = JSON.parse(localStorage.getItem('syHist') || '[]');
let navigationActive = false, navigationMode = 'driving';
let navRoute = null, navMarkers = [], navInterval = null;
let routeStart = null, routeEnd = null;
let shareLat = null, shareLng = null, shareName = '';
let voiceGuideOn = false;

const cities = {
    'دمشق': { lat: 33.5138, lng: 36.2765 },
    'حلب': { lat: 36.2021, lng: 37.1343 },
    'حمص': { lat: 34.7324, lng: 36.7137 },
    'اللاذقية': { lat: 35.5214, lng: 35.7924 },
    'حماة': { lat: 35.1318, lng: 36.7578 },
    'دير الزور': { lat: 35.3333, lng: 40.1500 },
    'الرقة': { lat: 35.9500, lng: 39.0167 },
    'طرطوس': { lat: 34.8833, lng: 35.8833 }
};

// ==================== التهيئة ====================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMap();
    initEvents();
    startTracking();
    setTimeout(() => document.getElementById('loadingScreen').classList.add('hidden'), 2000);
});

function initTheme() {
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('headerThemeBtn').innerHTML = '<i class="fas fa-sun"></i>';
        document.getElementById('themeToggleMobile').checked = true;
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    const icon = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    document.getElementById('headerThemeBtn').innerHTML = icon;
    document.getElementById('themeToggleMobile').checked = !isDark;
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// ==================== الخريطة ====================
function initMap() {
    map = L.map('map', {
        center: [34.8021, 38.9968],
        zoom: 7,
        zoomControl: false,
        attributionControl: false
    });

    standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 });

    map.on('click', onMapClick);
}

async function onMapClick(e) {
    const { lat, lng } = e.latlng;
    
    if (document.getElementById('chooseOnMapMobile').dataset.active === 'true') {
        document.getElementById('endPointMobile').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        routeEnd = { lat, lng, name: 'الوجهة' };
        document.getElementById('chooseOnMapMobile').dataset.active = 'false';
        document.getElementById('chooseOnMapMobile').style.background = '';
        map.getContainer().style.cursor = '';
        calcRoute();
        return;
    }

    addMarker(lat, lng);
    const name = await getPlaceName(lat, lng);
    if (currentMarker) currentMarker.bindPopup(makePopup(name, lat, lng)).openPopup();
}

function addMarker(lat, lng) {
    if (currentMarker) map.removeLayer(currentMarker);
    const icon = L.divIcon({ className: 'custom-marker', html: '<div class="marker-pin"></div>', iconSize: [26, 38], iconAnchor: [13, 38] });
    currentMarker = L.marker([lat, lng], { icon }).addTo(map);
    map.flyTo([lat, lng], 15, { duration: 1 });
}

function makePopup(name, lat, lng) {
    return `<div style="text-align:right;padding:5px;font-family:sans-serif;">
        <strong>${name||'موقع'}</strong><br>
        <small style="color:#8fa3b8;">${lat.toFixed(5)}, ${lng.toFixed(5)}</small>
        <div style="margin-top:8px;display:flex;gap:5px;">
            <button onclick="navigateTo(${lat},${lng})" style="padding:6px 10px;background:#4facfe;border:none;border-radius:6px;color:white;cursor:pointer;font-size:12px;">🚗 انطلق</button>
            <button onclick="openShare(${lat},${lng},'${name}')" style="padding:6px 10px;background:#8b5cf6;border:none;border-radius:6px;color:white;cursor:pointer;font-size:12px;">📤 مشاركة</button>
            <button onclick="addFav('${name}',${lat},${lng})" style="padding:6px 10px;background:#06d6a0;border:none;border-radius:6px;color:white;cursor:pointer;font-size:12px;">❤️ حفظ</button>
        </div>
    </div>`;
}

async function getPlaceName(lat, lng) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`);
        const d = await r.json();
        return d.display_name || 'موقع غير معروف';
    } catch { return 'موقع غير معروف'; }
}

// ==================== تتبع الموقع ====================
function startTracking() {
    if (!navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(pos => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        userSpeed = pos.coords.speed;
        updateUserOnMap();
        if (navigationActive) checkNav();
    }, null, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
}

function updateUserOnMap() {
    if (!userLat) return;
    if (userMarker) map.removeLayer(userMarker);
    if (userCircle) map.removeLayer(userCircle);
    const icon = L.divIcon({ className: 'custom-marker', html: '<div class="marker-pin user"></div>', iconSize: [26, 38], iconAnchor: [13, 38] });
    userMarker = L.marker([userLat, userLng], { icon }).addTo(map);
    userCircle = L.circle([userLat, userLng], { radius: 30, color: '#ff6b6b', fillOpacity: 0.1, weight: 1 }).addTo(map);
}

// ==================== الملاحة والمسار ====================
function calcRoute() {
    if (!routeStart || !routeEnd) return;
    const speeds = { driving: 60, walking: 5, bicycling: 15 };
    const s = L.latLng(routeStart.lat, routeStart.lng);
    const e = L.latLng(routeEnd.lat, routeEnd.lng);
    const dist = s.distanceTo(e);
    const km = (dist / 1000).toFixed(1);
    const min = Math.round(dist / 1000 / speeds[navigationMode] * 60);

    document.getElementById('routeDistMobile').textContent = km + ' كم';
    document.getElementById('routeTimeMobile').textContent = min < 60 ? min + ' د' : Math.floor(min/60) + ' س ' + (min%60) + ' د';
    document.getElementById('routeResultMobile').style.display = 'block';

    if (navRoute) map.removeLayer(navRoute);
    navRoute = L.polyline([s, e], { color: '#4facfe', weight: 4, dashArray: '10,10' }).addTo(map);
    map.fitBounds(L.latLngBounds([s, e]), { padding: [60, 60] });
}

function startNav() {
    if (!routeStart || !routeEnd) { toast('حدد نقطة الانطلاق والوجهة'); return; }
    navigationActive = true;
    document.getElementById('navPanel').style.display = 'block';
    document.getElementById('routeResultMobile').style.display = 'none';
    
    const icon = L.divIcon({ className: 'custom-marker', html: '<div class="marker-pin nav"></div>', iconSize: [26, 38], iconAnchor: [13, 38] });
    const m = L.marker([routeEnd.lat, routeEnd.lng], { icon }).addTo(map);
    navMarkers.push(m);
    
    if (userLat) map.setView([userLat, userLng], 16);
    addHistory();
    checkNav();
    toast('تم بدء الملاحة 🚗');
}

function checkNav() {
    if (!navigationActive || !userLat || !routeEnd) return;
    const u = L.latLng(userLat, userLng);
    const e = L.latLng(routeEnd.lat, routeEnd.lng);
    const rem = u.distanceTo(e);
    const km = (rem / 1000).toFixed(1);
    const bearing = calcBearing(userLat, userLng, routeEnd.lat, routeEnd.lng);
    const dirs = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
    const dir = 'اتجه ' + dirs[Math.round(bearing / 45) % 8];
    const spd = userSpeed ? (userSpeed * 3.6).toFixed(0) : '0';
    const timeLeft = spd > 0 ? Math.round(rem / (spd / 3.6) / 60) : '--';

    document.getElementById('navPanelInstruction').textContent = dir;
    document.getElementById('navPanelDistance').textContent = km + ' كم';
    document.getElementById('navPanelTime').textContent = timeLeft + ' دقيقة';
    document.getElementById('navPanelSpeed').textContent = spd + ' كم/س';
    document.getElementById('navPanelArrow').style.transform = `rotate(${bearing}deg)`;
    
    if (voiceGuideOn) speak(dir + '، ' + km + ' كيلومتر متبقي');

    if (rem < 30) {
        stopNav();
        document.getElementById('arrivalAlert').style.display = 'flex';
        setTimeout(() => document.getElementById('arrivalAlert').style.display = 'none', 4000);
        toast('🎉 وصلت إلى وجهتك!');
    }
}

function stopNav() {
    navigationActive = false;
    document.getElementById('navPanel').style.display = 'none';
    navMarkers.forEach(m => map.removeLayer(m));
    navMarkers = [];
    if (navRoute) { map.removeLayer(navRoute); navRoute = null; }
}

function calcBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function navigateTo(lat, lng) {
    if (!userLat) { toast('انتظر تحديد موقعك'); return; }
    routeStart = { lat: userLat, lng: userLng, name: 'موقعي' };
    routeEnd = { lat, lng, name: 'الوجهة' };
    document.getElementById('startPointMobile').value = 'موقعي الحالي';
    document.getElementById('endPointMobile').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    showRoutePanel();
    calcRoute();
}

// ==================== المشاركة ====================
function openShare(lat, lng, name) {
    shareLat = lat; shareLng = lng; shareName = name || 'موقع';
    document.getElementById('shareModalTitle').textContent = shareName;
    document.getElementById('shareModalCoords').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    document.getElementById('shareModal').classList.add('active');
}

function shareTo(platform) {
    if (!shareLat) return;
    const appLink = `${location.origin}${location.pathname}?lat=${shareLat}&lng=${shareLng}&name=${encodeURIComponent(shareName)}`;
    const gmaps = `https://www.google.com/maps?q=${shareLat},${shareLng}`;
    const text = `📍 ${shareName}\n🗺️ ${shareLat.toFixed(5)}, ${shareLng.toFixed(5)}\n🔗 التطبيق: ${appLink}\n🗺️ Google: ${gmaps}`;
    const enc = encodeURIComponent(text);
    
    const urls = {
        whatsapp: `https://wa.me/?text=${enc}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(appLink)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(appLink)}&text=${enc}`,
        messenger: `fb-messenger://share/?link=${encodeURIComponent(appLink)}`,
        sms: `sms:?body=${enc}`,
        copy: null
    };
    
    if (platform === 'copy') {
        navigator.clipboard.writeText(text).then(() => toast('تم نسخ الموقع'));
    } else if (urls[platform]) {
        window.open(urls[platform], '_blank');
    }
    closeModal('shareModal');
}

// ==================== المفضلة ====================
function addFav(name, lat, lng) {
    if (favorites.find(f => f.lat === lat && f.lng === lng)) { toast('موجود مسبقاً'); return; }
    favorites.unshift({ id: Date.now(), name: name || 'موقع', lat, lng, date: new Date().toLocaleDateString('ar') });
    localStorage.setItem('syFavs', JSON.stringify(favorites));
    renderFavs();
    toast('❤️ تم الحفظ');
}

function renderFavs() {
    const c = document.getElementById('favoritesMini');
    const p = document.getElementById('favoritesPanelList');
    if (!favorites.length) {
        const html = '<p class="empty-text">لا توجد أماكن مفضلة</p>';
        if (c) c.innerHTML = html;
        if (p) p.innerHTML = html;
        return;
    }
    const html = favorites.map(f => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg-elevated);border-radius:10px;margin-bottom:6px;" onclick="goFav(${f.lat},${f.lng})">
            <div style="display:flex;align-items:center;gap:8px;">
                <i class="fas fa-heart" style="color:#ff6b6b;"></i>
                <div><div style="font-size:14px;">${f.name}</div><div style="font-size:11px;color:var(--text-muted);">${f.date}</div></div>
            </div>
            <button onclick="event.stopPropagation();remFav(${f.id})" style="background:none;border:none;color:#ff6b6b;font-size:16px;cursor:pointer;">🗑️</button>
        </div>
    `).join('');
    if (c) c.innerHTML = html;
    if (p) p.innerHTML = html;
}

function goFav(lat, lng) { addMarker(lat, lng); closeSidebar(); }
function remFav(id) { favorites = favorites.filter(f => f.id !== id); localStorage.setItem('syFavs', JSON.stringify(favorites)); renderFavs(); toast('تم الحذف'); }

// ==================== السجل ====================
function addHistory() {
    history.unshift({ id: Date.now(), from: routeStart.name, to: routeEnd.name, date: new Date().toLocaleString('ar'), mode: navigationMode });
    if (history.length > 30) history = history.slice(0, 30);
    localStorage.setItem('syHist', JSON.stringify(history));
}

// ==================== الأماكن القريبة ====================
async function searchNearby(cat) {
    if (!userLat) { toast('حدد موقعك أولاً'); return; }
    const cats = { hospital: 'مستشفى', pharmacy: 'صيدلية', restaurant: 'مطعم', fuel: 'محطة وقود', mosque: 'مسجد', cafe: 'مقهى' };
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${cats[cat]}&limit=10&lat=${userLat}&lon=${userLng}&accept-language=ar`);
        const d = await r.json();
        map.eachLayer(l => { if (l._nb) map.removeLayer(l); });
        d.forEach(p => {
            const icon = L.divIcon({ className: 'custom-marker', html: '<div class="marker-pin" style="background:#51cf66;"></div>', iconSize: [22, 32], iconAnchor: [11, 32] });
            const m = L.marker([p.lat, p.lon], { icon }).addTo(map);
            m._nb = true;
            m.bindPopup(`<strong>${p.display_name}</strong>`);
        });
        toast(`تم العثور على ${d.length} ${cats[cat]}`);
    } catch { toast('تعذر البحث'); }
}

// ==================== الصوت ====================
function startVoice() {
    if (!('webkitSpeechRecognition' in window)) { toast('غير مدعوم'); return; }
    const rec = new webkitSpeechRecognition();
    rec.lang = 'ar-SY';
    document.getElementById('voiceOverlay').style.display = 'flex';
    rec.start();
    rec.onresult = e => {
        document.getElementById('searchInput').value = e.results[0][0].transcript;
        document.getElementById('voiceOverlay').style.display = 'none';
        searchCity(e.results[0][0].transcript);
    };
    rec.onerror = () => { document.getElementById('voiceOverlay').style.display = 'none'; };
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ar-SY'; u.rate = 1.1;
        speechSynthesis.speak(u);
    }
}

// ==================== وظائف مساعدة ====================
function searchCity(name) {
    const c = cities[name];
    if (c) { addMarker(c.lat, c.lng); closeSidebar(); }
}

function showRoutePanel() { document.getElementById('routePanel').style.display = 'block'; }
function hideRoutePanel() { document.getElementById('routePanel').style.display = 'none'; }

function openSidebar() {
    document.getElementById('mobileSidebar').classList.add('active');
    document.getElementById('sidebarOverlay').classList.add('active');
}
function closeSidebar() {
    document.getElementById('mobileSidebar').classList.remove('active');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function toast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// ==================== الأحداث ====================
function initEvents() {
    // القائمة الجانبية
    document.getElementById('menuBtn').addEventListener('click', openSidebar);
    document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

    // البحث
    document.getElementById('searchInput').addEventListener('input', function() {
        const q = this.value.trim();
        document.getElementById('searchResults').classList.toggle('active', q.length > 1);
        if (q.length > 1) {
            for (const [name, coords] of Object.entries(cities)) {
                if (name.includes(q)) { searchCity(name); break; }
            }
        }
    });

    // المدن
    document.querySelectorAll('.city-chip').forEach(b => b.addEventListener('click', () => searchCity(b.dataset.city)));
    
    // أماكن قريبة
    document.querySelectorAll('.nearby-chip').forEach(b => b.addEventListener('click', () => searchNearby(b.dataset.category)));

    // الخريطة
    document.getElementById('zoomInFAB').addEventListener('click', () => map.zoomIn());
    document.getElementById('zoomOutFAB').addEventListener('click', () => map.zoomOut());
    document.getElementById('locateFAB').addEventListener('click', () => { if (userLat) map.setView([userLat, userLng], 16); });
    document.getElementById('layersFAB').addEventListener('click', () => {
        document.getElementById('layersPopup').style.display = 
            document.getElementById('layersPopup').style.display === 'none' ? 'flex' : 'none';
    });
    
    document.querySelectorAll('.layer-option').forEach(b => b.addEventListener('click', function() {
        document.querySelectorAll('.layer-option').forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        map.removeLayer(standardLayer); map.removeLayer(satelliteLayer); map.removeLayer(terrainLayer);
        const l = this.dataset.layer;
        if (l === 'standard') standardLayer.addTo(map);
        else if (l === 'satellite') satelliteLayer.addTo(map);
        else terrainLayer.addTo(map);
        currentLayer = l;
        document.getElementById('layersPopup').style.display = 'none';
    }));

    // وسائل النقل
    document.querySelectorAll('.transport-option').forEach(b => b.addEventListener('click', function() {
        document.querySelectorAll('.transport-option').forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        navigationMode = this.dataset.mode;
        if (routeStart && routeEnd) calcRoute();
    }));

    // المسار
    document.getElementById('useCurrentStartMobile').addEventListener('click', () => {
        if (userLat) {
            routeStart = { lat: userLat, lng: userLng, name: 'موقعي' };
            document.getElementById('startPointMobile').value = 'موقعي الحالي';
            if (routeEnd) calcRoute();
        }
    });
    document.getElementById('chooseOnMapMobile').addEventListener('click', function() {
        this.dataset.active = 'true';
        this.style.background = 'var(--primary)';
        map.getContainer().style.cursor = 'crosshair';
        toast('اضغط على الخريطة لتحديد الوجهة');
    });
    document.getElementById('swapPointsMobile').addEventListener('click', () => {
        [routeStart, routeEnd] = [routeEnd, routeStart];
        const sv = document.getElementById('startPointMobile').value;
        const ev = document.getElementById('endPointMobile').value;
        document.getElementById('startPointMobile').value = ev;
        document.getElementById('endPointMobile').value = sv;
        if (routeStart && routeEnd) calcRoute();
    });
    document.getElementById('startNavMobile').addEventListener('click', startNav);
    document.getElementById('navPanelClose').addEventListener('click', stopNav);
    document.getElementById('shareRouteMobile').addEventListener('click', () => {
        if (routeEnd) openShare(routeEnd.lat, routeEnd.lng, routeEnd.name);
    });

    // الشريط السفلي
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const panel = this.dataset.panel;
            document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
            
            if (panel === 'map') {
                this.classList.add('active');
                hideRoutePanel();
                document.querySelectorAll('.bottom-panel').forEach(p => p.classList.remove('active'));
            } else if (panel === 'route') {
                this.classList.add('active');
                showRoutePanel();
                document.querySelectorAll('.bottom-panel').forEach(p => p.classList.remove('active'));
            } else if (panel === 'favorites') {
                this.classList.add('active');
                hideRoutePanel();
                document.getElementById('favoritesPanel').classList.toggle('active');
                document.getElementById('settingsPanel').classList.remove('active');
            } else if (panel === 'settings') {
                this.classList.add('active');
                hideRoutePanel();
                document.getElementById('settingsPanel').classList.toggle('active');
                document.getElementById('favoritesPanel').classList.remove('active');
            }
        });
    });

    // مشاركة
    document.getElementById('bottomNavShare').addEventListener('click', () => {
        if (userLat) openShare(userLat, userLng, 'موقعي الحالي');
        else toast('انتظر تحديد موقعك');
    });

    // مودال المشاركة
    document.querySelectorAll('.share-option').forEach(b => b.addEventListener('click', () => shareTo(b.dataset.platform)));
    document.getElementById('shareModalCancel').addEventListener('click', () => closeModal('shareModal'));

    // مودال الطوارئ
    document.getElementById('headerEmergencyBtn').addEventListener('click', () => document.getElementById('emergencyModal').classList.add('active'));
    document.getElementById('emergencyModalCancel').addEventListener('click', () => closeModal('emergencyModal'));
    
    const emergencyHandler = (type) => {
        if (!userLat) { toast('حدد موقعك أولاً'); return; }
        const nums = { police: '112', ambulance: '110', fire: '113' };
        const text = `🚨 طوارئ - ${type}\n📍 ${userLat.toFixed(5)},${userLng.toFixed(5)}\n🔗 ${location.origin}${location.pathname}?lat=${userLat}&lng=${userLng}`;
        window.open(`tel:${nums[type]}`);
        setTimeout(() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`), 500);
        closeModal('emergencyModal');
    };
    document.getElementById('emergencyPoliceMobile').addEventListener('click', () => emergencyHandler('police'));
    document.getElementById('emergencyAmbulanceMobile').addEventListener('click', () => emergencyHandler('ambulance'));
    document.getElementById('emergencyFireMobile').addEventListener('click', () => emergencyHandler('fire'));

    // الإعدادات
    document.getElementById('themeToggleMobile').addEventListener('change', toggleTheme);
    document.getElementById('headerThemeBtn').addEventListener('click', toggleTheme);
    document.getElementById('voiceGuideToggle').addEventListener('change', function() { voiceGuideOn = this.checked; });
    document.getElementById('clearFavoritesMobile').addEventListener('click', () => {
        favorites = []; localStorage.setItem('syFavs', '[]'); renderFavs(); toast('تم مسح المفضلة');
    });
    document.getElementById('clearHistoryMobile').addEventListener('click', () => {
        history = []; localStorage.setItem('syHist', '[]'); toast('تم مسح السجل');
    });

    // الصوت
    document.getElementById('voiceSearchBtn').addEventListener('click', startVoice);

    // إغلاق المودالات عند النقر على الخلفية
    document.querySelectorAll('.modal-backdrop').forEach(bg => bg.addEventListener('click', function() {
        this.parentElement.classList.remove('active');
    }));

    // قراءة رابط المشاركة
    const params = new URLSearchParams(location.search);
    const pLat = parseFloat(params.get('lat')), pLng = parseFloat(params.get('lng')), pName = params.get('name');
    if (pLat && pLng) {
        setTimeout(() => {
            addMarker(pLat, pLng);
            toast(`📍 ${pName || 'موقع مشترك'}`);
            if (userLat && confirm('الانطلاق إلى هذا الموقع؟')) navigateTo(pLat, pLng);
        }, 2500);
    }

    renderFavs();
}
