// ==================== المتغيرات العامة ====================
let map;
let standardLayer, satelliteLayer, terrainLayer;
let currentLayer = 'standard';
let currentMarker = null;
let userMarker = null;
let userCircle = null;
let userLat = null;
let userLng = null;
let userHeading = null;
let userSpeed = null;
let watchId = null;

// المفضلة والسجل
let favorites = JSON.parse(localStorage.getItem('syriaFavorites') || '[]');
let history = JSON.parse(localStorage.getItem('syriaHistory') || '[]');
let savedRoutes = JSON.parse(localStorage.getItem('syriaRoutes') || '[]');

// الملاحة
let navigationActive = false;
let navigationMode = 'driving'; // driving, walking, bicycling
let navigationRoute = null;
let navigationMarkers = [];
let navigationInterval = null;
let routeStartPoint = null;
let routeEndPoint = null;
let routeWaypoints = [];

// القياس
let isMeasuring = false;
let measurePoints = [];
let measureLines = [];
let measureMarkers = [];

// مشاركة
let shareLat = null;
let shareLng = null;
let shareName = '';

// ==================== إحداثيات المدن السورية ====================
const syrianCities = {
    'دمشق': { lat: 33.5138, lng: 36.2765, zoom: 14 },
    'حلب': { lat: 36.2021, lng: 37.1343, zoom: 14 },
    'حمص': { lat: 34.7324, lng: 36.7137, zoom: 14 },
    'اللاذقية': { lat: 35.5214, lng: 35.7924, zoom: 14 },
    'حماة': { lat: 35.1318, lng: 36.7578, zoom: 14 },
    'دير الزور': { lat: 35.3333, lng: 40.1500, zoom: 14 },
    'الرقة': { lat: 35.9500, lng: 39.0167, zoom: 14 },
    'طرطوس': { lat: 34.8833, lng: 35.8833, zoom: 14 },
    'إدلب': { lat: 35.9297, lng: 36.6317, zoom: 14 },
    'درعا': { lat: 32.6167, lng: 36.1000, zoom: 14 },
    'السويداء': { lat: 32.7000, lng: 36.5667, zoom: 14 },
    'القنيطرة': { lat: 33.1167, lng: 35.8167, zoom: 14 },
    'الحسكة': { lat: 36.4833, lng: 40.7500, zoom: 14 }
};

// ==================== تهيئة التطبيق ====================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMap();
    initEvents();
    startWatchingPosition();
    
    // إخفاء شاشة التحميل
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
    }, 2000);
});

// ==================== الوضع الليلي ====================
function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeToggle').innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// ==================== تهيئة الخريطة ====================
function initMap() {
    map = L.map('map', {
        center: [34.8021, 38.9968],
        zoom: 7,
        zoomControl: false,
        attributionControl: true
    });

    standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap | خريطة سوريا'
    }).addTo(map);

    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    });

    terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17
    });

    map.on('click', onMapClick);
    map.on('move', () => {
        const c = map.getCenter();
        updateCoordDisplay(c.lat, c.lng);
    });
}

// ==================== تتبع الموقع ====================
function startWatchingPosition() {
    if (!navigator.geolocation) return;

    const options = {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
    };

    watchId = navigator.geolocation.watchPosition(
        position => {
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;
            userSpeed = position.coords.speed;
            userHeading = position.coords.heading;

            updateUserLocation();
            updateLocationPanel(position);
        },
        error => {
            document.getElementById('locationStatus').textContent = 'تعذر تحديد الموقع';
        },
        options
    );
}

function updateUserLocation() {
    if (!userLat || !userLng) return;

    // إزالة العلامة القديمة
    if (userMarker) map.removeLayer(userMarker);
    if (userCircle) map.removeLayer(userCircle);

    // أيقونة المستخدم
    const icon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin user"></div>',
        iconSize: [28, 40],
        iconAnchor: [14, 40]
    });

    userMarker = L.marker([userLat, userLng], { icon }).addTo(map);
    userCircle = L.circle([userLat, userLng], {
        radius: 50,
        color: '#ff6b6b',
        fillColor: '#ff6b6b',
        fillOpacity: 0.1,
        weight: 1
    }).addTo(map);

    // إذا كانت الملاحة نشطة، تحقق من المسار
    if (navigationActive) {
        checkNavigationProgress();
    }
}

function updateLocationPanel(position) {
    document.getElementById('latitude').textContent = userLat.toFixed(6);
    document.getElementById('longitude').textContent = userLng.toFixed(6);
    document.getElementById('speed').textContent = userSpeed ? (userSpeed * 3.6).toFixed(1) + ' كم/س' : '--';
    document.getElementById('accuracy').textContent = Math.round(position.coords.accuracy) + ' م';
    document.getElementById('locationStatus').textContent = 'متصل ✅';
}

// ==================== النقر على الخريطة ====================
async function onMapClick(e) {
    const { lat, lng } = e.latlng;

    if (isMeasuring) {
        addMeasurePoint(lat, lng);
        return;
    }

    if (document.getElementById('chooseOnMapBtn').dataset.active === 'true') {
        document.getElementById('endPoint').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        routeEndPoint = { lat, lng };
        document.getElementById('chooseOnMapBtn').dataset.active = 'false';
        document.getElementById('chooseOnMapBtn').style.background = '';
        document.getElementById('map').style.cursor = '';
        calculateAndDisplayRoute();
        return;
    }

    updateCoordDisplay(lat, lng);
    addMarkerToMap(lat, lng);
    const name = await getLocationName(lat, lng);
    
    if (currentMarker) {
        currentMarker.bindPopup(createPopupContent(name, lat, lng)).openPopup();
    }

    document.getElementById('locationStatus').textContent = name || 'موقع محدد';
}

function createPopupContent(name, lat, lng) {
    return `
        <div style="text-align: right; font-family: 'Segoe UI', sans-serif; padding: 5px;">
            <strong style="font-size: 14px;">${name || 'موقع محدد'}</strong><br>
            <span style="font-size: 11px; color: #94a3b8;">${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
            <div style="margin-top: 8px; display: flex; gap: 5px;">
                <button onclick="navigateTo(${lat}, ${lng})" style="padding: 5px 10px; background: #4facfe; border: none; border-radius: 5px; color: white; cursor: pointer; font-size: 11px;">
                    🚗 انطلق
                </button>
                <button onclick="shareLocation(${lat}, ${lng}, '${name}')" style="padding: 5px 10px; background: #8b5cf6; border: none; border-radius: 5px; color: white; cursor: pointer; font-size: 11px;">
                    📤 مشاركة
                </button>
                <button onclick="addToFavorites('${name}', ${lat}, ${lng})" style="padding: 5px 10px; background: #06d6a0; border: none; border-radius: 5px; color: white; cursor: pointer; font-size: 11px;">
                    ❤️ حفظ
                </button>
            </div>
        </div>
    `;
}

// ==================== إضافة علامة ====================
function addMarkerToMap(lat, lng) {
    if (currentMarker) map.removeLayer(currentMarker);

    const icon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin"></div>',
        iconSize: [28, 40],
        iconAnchor: [14, 40]
    });

    currentMarker = L.marker([lat, lng], { icon }).addTo(map);
    map.flyTo([lat, lng], 15, { duration: 1.2 });
}

// ==================== الحصول على اسم المنطقة ====================
async function getLocationName(lat, lng) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`);
        const data = await res.json();
        return data.display_name || 'موقع غير معروف';
    } catch {
        return 'موقع غير معروف';
    }
}

// ==================== تحديث الإحداثيات ====================
function updateCoordDisplay(lat, lng) {
    if (!navigationActive) {
        document.getElementById('latitude').textContent = lat.toFixed(6);
        document.getElementById('longitude').textContent = lng.toFixed(6);
    }
}

// ==================== البحث عن مدينة ====================
function searchCity(cityName) {
    const city = syrianCities[cityName];
    if (city) {
        addMarkerToMap(city.lat, city.lng);
        updateCoordDisplay(city.lat, city.lng);
        document.getElementById('locationStatus').textContent = cityName;
    }
}

// ==================== نظام الملاحة ====================
function calculateAndDisplayRoute() {
    if (!routeStartPoint || !routeEndPoint) return;

    const mode = navigationMode;
    const speedMap = { driving: 60, walking: 5, bicycling: 15 };
    const avgSpeed = speedMap[mode];

    const start = L.latLng(routeStartPoint.lat, routeStartPoint.lng);
    const end = L.latLng(routeEndPoint.lat, routeEndPoint.lng);

    // حساب المسافة المباشرة
    const distance = start.distanceTo(end);
    const distanceKm = (distance / 1000).toFixed(2);
    const durationMin = Math.round((distance / 1000) / avgSpeed * 60);

    // عرض معلومات المسار
    document.getElementById('routeDistance').textContent = distanceKm + ' كم';
    document.getElementById('routeDuration').textContent = formatDuration(durationMin);
    document.getElementById('routeSpeed').textContent = avgSpeed + ' كم/س';
    document.getElementById('routeInfo').style.display = 'block';

    // رسم خط المسار
    if (navigationRoute) map.removeLayer(navigationRoute);
    navigationRoute = L.polyline([start, end], {
        color: '#4facfe',
        weight: 4,
        dashArray: '10, 10'
    }).addTo(map);

    // تكبير الخريطة
    const bounds = L.latLngBounds([start, end]);
    map.fitBounds(bounds, { padding: [50, 50] });

    // إضافة للمسار المحفوظ
    routeStartPoint.name = routeStartPoint.name || 'نقطة الانطلاق';
    routeEndPoint.name = routeEndPoint.name || 'الوجهة';
}

function formatDuration(minutes) {
    if (minutes < 60) return minutes + ' دقيقة';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h + ' ساعة' + (m > 0 ? ' و ' + m + ' دقيقة' : '');
}

function startNavigation() {
    if (!routeStartPoint || !routeEndPoint) {
        showToast('يرجى تحديد نقطة الانطلاق والوجهة');
        return;
    }

    navigationActive = true;
    document.getElementById('routeOverlay').style.display = 'flex';
    document.getElementById('activeNavigation').style.display = 'block';
    document.getElementById('routeInfo').style.display = 'none';

    // إضافة ماركر للوجهة
    const endIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin navigation"></div>',
        iconSize: [28, 40],
        iconAnchor: [14, 40]
    });
    
    const endMarker = L.marker([routeEndPoint.lat, routeEndPoint.lng], { icon: endIcon }).addTo(map);
    navigationMarkers.push(endMarker);

    // تحريك الخريطة لموقع المستخدم
    if (userLat && userLng) {
        map.setView([userLat, userLng], 16);
    }

    checkNavigationProgress();
    
    // إضافة للسجل
    addToHistory(routeStartPoint, routeEndPoint);

    showToast('تم بدء الملاحة 🚗');
}

function checkNavigationProgress() {
    if (!navigationActive || !userLat || !routeEndPoint) return;

    const userPos = L.latLng(userLat, userLng);
    const endPos = L.latLng(routeEndPoint.lat, routeEndPoint.lng);
    const remaining = userPos.distanceTo(endPos);
    const remainingKm = (remaining / 1000).toFixed(2);

    // حساب الاتجاه
    const bearing = calculateBearing(userLat, userLng, routeEndPoint.lat, routeEndPoint.lng);
    const direction = getDirectionText(bearing);

    document.getElementById('overlayInstruction').textContent = direction;
    document.getElementById('overlayDistance').textContent = remainingKm + ' كم';
    
    const speed = userSpeed ? (userSpeed * 3.6) : 0;
    const timeRemaining = speed > 0 ? Math.round(remaining / (speed / 3.6) / 60) : '--';
    document.getElementById('overlayTime').textContent = timeRemaining + ' دقيقة';
    
    document.getElementById('navRemaining').textContent = remainingKm + ' كم';
    document.getElementById('navSpeed').textContent = speed.toFixed(0) + ' كم/س';
    document.getElementById('navTimeRemaining').textContent = timeRemaining + ' دقيقة';
    document.getElementById('navInstruction').textContent = direction;
    document.getElementById('navArrow').style.transform = `rotate(${bearing}deg)`;

    // التحقق من الوصول
    if (remaining < 50) {
        stopNavigation();
        showToast('🎉 لقد وصلت إلى وجهتك!');
    }
}

function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

function getDirectionText(bearing) {
    const directions = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
    const index = Math.round(bearing / 45) % 8;
    return 'اتجه ' + directions[index];
}

function stopNavigation() {
    navigationActive = false;
    document.getElementById('routeOverlay').style.display = 'none';
    document.getElementById('activeNavigation').style.display = 'none';
    document.getElementById('routeInfo').style.display = 'block';
    
    navigationMarkers.forEach(m => map.removeLayer(m));
    navigationMarkers = [];
    
    if (navigationRoute) {
        map.removeLayer(navigationRoute);
        navigationRoute = null;
    }
}

// ==================== المشاركة ====================
function shareLocation(lat, lng, name) {
    shareLat = lat;
    shareLng = lng;
    shareName = name || 'موقع محدد';
    
    document.getElementById('shareTitle').textContent = shareName;
    document.getElementById('shareCoords').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    // رابط مخصص للتطبيق مع إمكانية الفتح المباشر
    const appLink = `${window.location.origin}${window.location.pathname}?lat=${lat}&lng=${lng}&name=${encodeURIComponent(shareName)}`;
    const googleMapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
    
    document.getElementById('shareLink').value = appLink;
    document.getElementById('shareModal').classList.add('active');
    
    // تجهيز أزرار المشاركة
    document.querySelectorAll('.share-platform-btn').forEach(btn => {
        btn.onclick = () => shareToPlatform(btn.dataset.platform, lat, lng, name, appLink, googleMapsLink);
    });
}

function shareToPlatform(platform, lat, lng, name, appLink, googleMapsLink) {
    const text = `📍 ${name}\n🗺️ الإحداثيات: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n🔗 فتح في التطبيق: ${appLink}\n🗺️ فتح في خرائط Google: ${googleMapsLink}`;
    const encoded = encodeURIComponent(text);
    
    let url;
    switch(platform) {
        case 'whatsapp':
            url = `https://wa.me/?text=${encoded}`;
            break;
        case 'facebook':
            url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(appLink)}&quote=${encoded}`;
            break;
        case 'telegram':
            url = `https://t.me/share/url?url=${encodeURIComponent(appLink)}&text=${encoded}`;
            break;
        case 'messenger':
            url = `fb-messenger://share/?link=${encodeURIComponent(appLink)}`;
            break;
        case 'sms':
            url = `sms:?body=${encoded}`;
            break;
        case 'copy':
            navigator.clipboard.writeText(text).then(() => showToast('تم نسخ معلومات الموقع كاملة'));
            closeModal('shareModal');
            return;
    }
    
    if (url) window.open(url, '_blank');
    closeModal('shareModal');
}

function shareMyLocation() {
    if (!userLat || !userLng) {
        showToast('يرجى انتظار تحديد موقعك');
        return;
    }
    shareLocation(userLat, userLng, 'موقعي الحالي');
}

// ==================== المفضلة ====================
function addToFavorites(name, lat, lng) {
    const exists = favorites.find(f => f.lat === lat && f.lng === lng);
    if (exists) {
        showToast('الموقع موجود مسبقاً في المفضلة');
        return;
    }

    favorites.unshift({
        id: Date.now(),
        name: name || 'موقع محفوظ',
        lat, lng,
        date: new Date().toLocaleDateString('ar-SY')
    });
    
    saveFavorites();
    renderFavorites();
    showToast('❤️ تمت الإضافة للمفضلة');
}

function saveFavorites() {
    localStorage.setItem('syriaFavorites', JSON.stringify(favorites));
}

function renderFavorites() {
    const container = document.getElementById('favoritesList');
    if (favorites.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-heart-broken"></i><p>لا توجد أماكن مفضلة</p><span>اضغط على أي مكان في الخريطة لإضافته</span></div>`;
        return;
    }

    container.innerHTML = favorites.map(f => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-card); border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid var(--border); cursor: pointer;" onclick="goToFavorite(${f.lat}, ${f.lng})">
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-heart" style="color: var(--danger);"></i>
                <div>
                    <div style="font-size: 14px;">${f.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${f.date}</div>
                </div>
            </div>
            <button onclick="event.stopPropagation(); removeFavorite(${f.id})" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 14px;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function goToFavorite(lat, lng) {
    addMarkerToMap(lat, lng);
}

function removeFavorite(id) {
    favorites = favorites.filter(f => f.id !== id);
    saveFavorites();
    renderFavorites();
    showToast('تم الحذف من المفضلة');
}

// ==================== السجل ====================
function addToHistory(start, end) {
    history.unshift({
        id: Date.now(),
        from: start.name || 'نقطة الانطلاق',
        to: end.name || 'الوجهة',
        fromLat: start.lat,
        fromLng: start.lng,
        toLat: end.lat,
        toLng: end.lng,
        date: new Date().toLocaleString('ar-SY'),
        mode: navigationMode
    });

    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem('syriaHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('historyList');
    if (history.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-history"></i><p>لا توجد رحلات سابقة</p></div>`;
        return;
    }

    container.innerHTML = history.map(h => `
        <div style="padding: 10px; background: var(--bg-card); border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid var(--border); cursor: pointer;" onclick="replayRoute(${h.fromLat}, ${h.fromLng}, ${h.toLat}, ${h.toLng})">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                <i class="fas fa-${h.mode === 'driving' ? 'car' : h.mode === 'walking' ? 'walking' : 'bicycle'}"></i>
                <span>${h.from} → ${h.to}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${h.date}</div>
        </div>
    `).join('');
}

function replayRoute(fromLat, fromLng, toLat, toLng) {
    routeStartPoint = { lat: fromLat, lng: fromLng, name: 'نقطة الانطلاق' };
    routeEndPoint = { lat: toLat, lng: toLng, name: 'الوجهة' };
    document.getElementById('startPoint').value = `${fromLat.toFixed(6)}, ${fromLng.toFixed(6)}`;
    document.getElementById('endPoint').value = `${toLat.toFixed(6)}, ${toLng.toFixed(6)}`;
    calculateAndDisplayRoute();
    
    // التبديل لتبويب الملاحة
    switchTab('navigation');
}

// ==================== الملاحة إلى نقطة ====================
function navigateTo(lat, lng) {
    if (!userLat || !userLng) {
        showToast('يرجى تحديد موقعك أولاً');
        return;
    }
    
    routeStartPoint = { lat: userLat, lng: userLng, name: 'موقعي الحالي' };
    routeEndPoint = { lat, lng, name: 'الوجهة المحددة' };
    
    document.getElementById('startPoint').value = 'موقعي الحالي';
    document.getElementById('endPoint').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    calculateAndDisplayRoute();
    switchTab('navigation');
}

// ==================== التبويبات ====================
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    const panel = document.getElementById(`tab-${tabName}`);
    
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
}

// ==================== المودالات ====================
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ==================== التنبيهات ====================
function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== تهيئة الأحداث ====================
function initEvents() {
    // تحديد الموقع
    document.getElementById('locateMeBtn').addEventListener('click', () => {
        if (userLat && userLng) {
            map.setView([userLat, userLng], 16);
            showToast('تم تحديد موقعك');
        } else {
            showToast('جاري تحديد الموقع...');
        }
    });

    // أزرار التكبير
    document.getElementById('zoomIn').addEventListener('click', () => map.zoomIn());
    document.getElementById('zoomOut').addEventListener('click', () => map.zoomOut());
    document.getElementById('compassBtn').addEventListener('click', () => map.setView([34.8021, 38.9968], 7));

    // تبديل الوضع الليلي
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // ملء الشاشة
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    });

    // تصغير القائمة
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        const icon = this.querySelector('i');
        icon.classList.toggle('fa-chevron-right');
        icon.classList.toggle('fa-chevron-left');
        setTimeout(() => map.invalidateSize(), 300);
    });

    // التبويبات
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // المدن
    document.querySelectorAll('.city-card').forEach(card => {
        card.addEventListener('click', () => searchCity(card.dataset.city));
    });

    // الأماكن القريبة
    document.querySelectorAll('.nearby-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!userLat || !userLng) {
                showToast('يرجى تحديد موقعك أولاً');
                return;
            }
            const category = btn.dataset.category;
            const categoryMap = {
                hospital: 'مستشفى', pharmacy: 'صيدلية', restaurant: 'مطعم',
                cafe: 'مقهى', mosque: 'مسجد', fuel: 'محطة وقود',
                bank: 'بنك', school: 'مدرسة', park: 'حديقة'
            };
            await searchNearbyPlaces(categoryMap[category]);
        });
    });

    // وسائل النقل
    document.querySelectorAll('.transport-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.transport-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            navigationMode = this.dataset.mode;
            if (routeStartPoint && routeEndPoint) calculateAndDisplayRoute();
        });
    });

    // حساب المسار
    document.getElementById('useCurrentStart').addEventListener('click', () => {
        if (userLat && userLng) {
            routeStartPoint = { lat: userLat, lng: userLng, name: 'موقعي الحالي' };
            document.getElementById('startPoint').value = 'موقعي الحالي';
            if (routeEndPoint) calculateAndDisplayRoute();
        }
    });

    document.getElementById('chooseOnMapBtn').addEventListener('click', function() {
        this.dataset.active = 'true';
        this.style.background = 'var(--primary)';
        document.getElementById('map').style.cursor = 'crosshair';
        showToast('انقر على الخريطة لتحديد الوجهة');
    });

    document.getElementById('swapPoints').addEventListener('click', () => {
        [routeStartPoint, routeEndPoint] = [routeEndPoint, routeStartPoint];
        const startVal = document.getElementById('startPoint').value;
        const endVal = document.getElementById('endPoint').value;
        document.getElementById('startPoint').value = endVal;
        document.getElementById('endPoint').value = startVal;
        if (routeStartPoint && routeEndPoint) calculateAndDisplayRoute();
    });

    // بدء وإنهاء الملاحة
    document.getElementById('startNavigation').addEventListener('click', startNavigation);
    document.getElementById('stopNavigation').addEventListener('click', stopNavigation);
    document.getElementById('closeRouteOverlay').addEventListener('click', stopNavigation);

    // المشاركة
    document.getElementById('shareMyLocationBtn').addEventListener('click', shareMyLocation);
    document.getElementById('shareLocationBtn')?.addEventListener('click', shareMyLocation);
    document.getElementById('shareRouteBtn').addEventListener('click', () => {
        if (routeEndPoint) shareLocation(routeEndPoint.lat, routeEndPoint.lng, routeEndPoint.name);
    });

    // نسخ الإحداثيات
    document.getElementById('copyCoordsBtn').addEventListener('click', () => {
        const lat = document.getElementById('latitude').textContent;
        const lng = document.getElementById('longitude').textContent;
        navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => showToast('تم نسخ الإحداثيات'));
    });

    document.getElementById('copyShareLink').addEventListener('click', () => {
        const link = document.getElementById('shareLink');
        link.select();
        navigator.clipboard.writeText(link.value).then(() => showToast('تم نسخ الرابط'));
    });

    // حفظ المسار
    document.getElementById('saveRouteBtn').addEventListener('click', () => {
        if (!routeStartPoint || !routeEndPoint) {
            showToast('يرجى تحديد المسار أولاً');
            return;
        }
        document.getElementById('saveRouteFrom').textContent = routeStartPoint.name || 'نقطة الانطلاق';
        document.getElementById('saveRouteTo').textContent = routeEndPoint.name || 'الوجهة';
        document.getElementById('saveRouteDistance').textContent = document.getElementById('routeDistance').textContent;
        document.getElementById('saveRouteModal').classList.add('active');
    });

    document.getElementById('confirmSaveRoute').addEventListener('click', () => {
        const name = document.getElementById('routeName').value || 'مسار محفوظ';
        savedRoutes.push({
            id: Date.now(),
            name,
            start: routeStartPoint,
            end: routeEndPoint,
            mode: navigationMode
        });
        localStorage.setItem('syriaRoutes', JSON.stringify(savedRoutes));
        closeModal('saveRouteModal');
        showToast('تم حفظ المسار ✅');
    });

    // المفضلة
    document.getElementById('clearAllFavorites').addEventListener('click', () => {
        if (confirm('مسح كل المفضلة؟')) {
            favorites = [];
            saveFavorites();
            renderFavorites();
            showToast('تم مسح المفضلة');
        }
    });

    // السجل
    document.getElementById('clearHistory').addEventListener('click', () => {
        if (confirm('مسح سجل الرحلات؟')) {
            history = [];
            localStorage.setItem('syriaHistory', JSON.stringify(history));
            renderHistory();
            showToast('تم مسح السجل');
        }
    });

    // طبقات الخريطة
    document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const layer = this.dataset.layer;
            map.removeLayer(standardLayer);
            map.removeLayer(satelliteLayer);
            map.removeLayer(terrainLayer);
            if (layer === 'standard') standardLayer.addTo(map);
            else if (layer === 'satellite') satelliteLayer.addTo(map);
            else terrainLayer.addTo(map);
            currentLayer = layer;
        });
    });

    // الطوارئ
    document.getElementById('emergencyBtn').addEventListener('click', () => {
        document.getElementById('emergencyModal').classList.add('active');
    });

    ['emergencyPolice', 'emergencyAmbulance', 'emergencyFire'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', function() {
            if (!userLat || !userLng) {
                showToast('يرجى تحديد موقعك أولاً');
                return;
            }
            const type = this.id.replace('emergency', '').toLowerCase();
            const numbers = { police: '112', ambulance: '110', fire: '113' };
            const text = `🚨 حالة طوارئ - ${type === 'police' ? 'شرطة' : type === 'ambulance' ? 'إسعاف' : 'إطفاء'}\n📍 موقعي: ${userLat.toFixed(6)}, ${userLng.toFixed(6)}\n🔗 ${window.location.origin}${window.location.pathname}?lat=${userLat}&lng=${userLng}`;
            
            // محاولة فتح تطبيق الاتصال
            window.open(`tel:${numbers[type]}`);
            
            // مشاركة الموقع عبر واتساب
            const waLink = `https://wa.me/?text=${encodeURIComponent(text)}`;
            setTimeout(() => window.open(waLink, '_blank'), 500);
            
            closeModal('emergencyModal');
            showToast('تم إرسال موقعك للطوارئ 🆘');
        });
    });

    // إغلاق المودالات
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function() {
            this.parentElement.classList.remove('active');
        });
    });

    // البحث الصوتي
    document.getElementById('voiceSearchBtn').addEventListener('click', startVoiceSearch);
    
    // التوجيه الصوتي
    document.getElementById('voiceGuideBtn').addEventListener('click', toggleVoiceGuide);

    // قراءة معلمات URL للمشاركة
    readUrlParams();
}

// ==================== البحث عن أماكن قريبة ====================
async function searchNearbyPlaces(category) {
    document.getElementById('mapSpinner').style.display = 'block';
    
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${category}&limit=15&lat=${userLat}&lon=${userLng}&accept-language=ar`);
        const data = await res.json();
        
        map.eachLayer(layer => { if (layer._nearby) map.removeLayer(layer); });
        
        data.forEach(place => {
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div class="marker-pin" style="background: var(--success);"></div>`,
                iconSize: [22, 32],
                iconAnchor: [11, 32]
            });
            const marker = L.marker([place.lat, place.lon], { icon }).addTo(map);
            marker._nearby = true;
            marker.bindPopup(`<strong>${place.display_name}</strong>`);
        });
        
        showToast(`تم العثور على ${data.length} ${category}`);
    } catch {
        showToast('تعذر البحث عن الأماكن القريبة');
    }
    
    document.getElementById('mapSpinner').style.display = 'none';
}

// ==================== البحث الصوتي ====================
function startVoiceSearch() {
    if (!('webkitSpeechRecognition' in window)) {
        showToast('البحث الصوتي غير مدعوم في متصفحك');
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'ar-SY';
    recognition.interimResults = false;
    
    document.getElementById('voiceOverlay').style.display = 'flex';
    recognition.start();

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        document.getElementById('searchInput').value = text;
        document.getElementById('voiceOverlay').style.display = 'none';
        searchCity(text);
    };

    recognition.onerror = () => {
        document.getElementById('voiceOverlay').style.display = 'none';
        showToast('تعذر التعرف على الصوت');
    };
}

// ==================== التوجيه الصوتي ====================
let voiceGuideEnabled = false;
function toggleVoiceGuide() {
    voiceGuideEnabled = !voiceGuideEnabled;
    const btn = document.getElementById('voiceGuideBtn');
    btn.style.background = voiceGuideEnabled ? 'var(--primary)' : '';
    showToast(voiceGuideEnabled ? 'تم تفعيل التوجيه الصوتي 🔊' : 'تم إيقاف التوجيه الصوتي 🔇');
}

function speakInstruction(text) {
    if (!voiceGuideEnabled || !navigationActive) return;
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SY';
        utterance.rate = 1;
        speechSynthesis.speak(utterance);
    }
}

// ==================== قراءة معلمات URL ====================
function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    const name = params.get('name');

    if (lat && lng) {
        setTimeout(() => {
            addMarkerToMap(lat, lng);
            document.getElementById('locationStatus').textContent = name || 'موقع مشترك';
            showToast(`📍 ${name || 'موقع مشترك'} - تم فتحه من الرابط`);
            
            // عرض خيار التنقل
            if (userLat && userLng) {
                setTimeout(() => {
                    if (confirm('هل تريد الانطلاق إلى هذا الموقع؟')) {
                        navigateTo(lat, lng);
                    }
                }, 1000);
            }
        }, 2500);
    }
}

// ==================== تهيئة العرض ====================
setTimeout(() => {
    renderFavorites();
    renderHistory();
}, 100);