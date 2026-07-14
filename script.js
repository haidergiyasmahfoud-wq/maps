// ========== المتغيرات ==========
let map, userMarker, userCircle, currentMarker, routeLine;
let userLat, userLng, userSpeed;
let navigationMode = 'driving';
let routeStart, routeEnd;
let isPickingOnMap = false;
let favorites = JSON.parse(localStorage.getItem('mapFavs') || '[]');

const cities = {
    'دمشق': [33.5138, 36.2765],
    'حلب': [36.2021, 37.1343],
    'حمص': [34.7324, 36.7137],
    'اللاذقية': [35.5214, 35.7924],
    'حماة': [35.1318, 36.7578],
    'دير الزور': [35.3333, 40.1500],
    'الرقة': [35.9500, 39.0167],
    'طرطوس': [34.8833, 35.8833]
};

// ========== تهيئة الخريطة ==========
function initMap() {
    map = L.map('map', {
        center: [34.8021, 38.9968],
        zoom: 7,
        zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

    map.on('click', function(e) {
        if (isPickingOnMap) {
            const { lat, lng } = e.latlng;
            document.getElementById('endInput').value = lat.toFixed(5) + ', ' + lng.toFixed(5);
            routeEnd = { lat, lng };
            isPickingOnMap = false;
            document.getElementById('pickOnMap').style.color = '#4facfe';
            calculateRoute();
        } else {
            addMarker(e.latlng.lat, e.latlng.lng);
        }
    });
}

// ========== إضافة علامة ==========
function addMarker(lat, lng) {
    if (currentMarker) map.removeLayer(currentMarker);
    
    const icon = L.divIcon({
        className: '',
        html: '<div style="width:25px;height:25px;background:#4facfe;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [25, 35],
        iconAnchor: [12, 35]
    });
    
    currentMarker = L.marker([lat, lng], { icon }).addTo(map);
    map.flyTo([lat, lng], 15);
    getAddress(lat, lng).then(name => {
        currentMarker.bindPopup('<b>' + name + '</b>').openPopup();
    });
}

// ========== الحصول على العنوان ==========
async function getAddress(lat, lng) {
    try {
        const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&accept-language=ar');
        const data = await res.json();
        return data.display_name || 'موقع غير معروف';
    } catch(e) {
        return 'موقع غير معروف';
    }
}

// ========== تحديد الموقع ==========
function locateUser() {
    if (!navigator.geolocation) {
        showToast('متصفحك لا يدعم تحديد الموقع');
        return;
    }
    
    showToast('جاري تحديد موقعك...');
    
    navigator.geolocation.getCurrentPosition(function(pos) {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        userSpeed = pos.coords.speed;
        
        updateUserMarker();
        map.setView([userLat, userLng], 16);
        showToast('تم تحديد موقعك ✓');
        
        // متابعة الموقع
        navigator.geolocation.watchPosition(function(p) {
            userLat = p.coords.latitude;
            userLng = p.coords.longitude;
            userSpeed = p.coords.speed;
            updateUserMarker();
        }, null, { enableHighAccuracy: true });
        
    }, function(err) {
        showToast('تعذر تحديد الموقع: ' + err.message);
    }, { enableHighAccuracy: true, timeout: 10000 });
}

function updateUserMarker() {
    if (!userLat || !userLng) return;
    
    if (userMarker) map.removeLayer(userMarker);
    if (userCircle) map.removeLayer(userCircle);
    
    const icon = L.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;background:#f44336;border-radius:50%;border:3px solid white;box-shadow:0 0 15px rgba(244,67,54,0.6);"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });
    
    userMarker = L.marker([userLat, userLng], { icon }).addTo(map);
    userCircle = L.circle([userLat, userLng], {
        radius: 50,
        color: '#f44336',
        fillColor: '#f44336',
        fillOpacity: 0.1,
        weight: 1
    }).addTo(map);
}

// ========== حساب المسار ==========
function calculateRoute() {
    if (!routeStart || !routeEnd) return;
    
    const speeds = { driving: 60, walking: 5, bicycling: 15 };
    const speed = speeds[navigationMode];
    
    const R = 6371;
    const dLat = (routeEnd.lat - routeStart.lat) * Math.PI / 180;
    const dLng = (routeEnd.lng - routeStart.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(routeStart.lat * Math.PI / 180) * Math.cos(routeEnd.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    const timeMinutes = Math.round((distance / speed) * 60);
    
    document.getElementById('routeDist').textContent = distance.toFixed(1) + ' كم';
    document.getElementById('routeTime').textContent = timeMinutes < 60 ? timeMinutes + ' دقيقة' : Math.floor(timeMinutes/60) + ' ساعة و ' + (timeMinutes%60) + ' دقيقة';
    document.getElementById('routeInfo').style.display = 'block';
    
    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline([[routeStart.lat, routeStart.lng], [routeEnd.lat, routeEnd.lng]], {
        color: '#4facfe',
        weight: 4,
        dashArray: '10, 10'
    }).addTo(map);
    
    const bounds = L.latLngBounds([[routeStart.lat, routeStart.lng], [routeEnd.lat, routeEnd.lng]]);
    map.fitBounds(bounds, { padding: [50, 50] });
}

// ========== الملاحة ==========
function startNavigation() {
    if (!routeStart || !routeEnd) {
        showToast('الرجاء تحديد نقطة الانطلاق والوجهة');
        return;
    }
    
    if (!userLat || !userLng) {
        showToast('الرجاء تحديد موقعك أولاً');
        return;
    }
    
    map.setView([userLat, userLng], 17);
    showToast('تم بدء الملاحة 🚗');
    
    // إضافة للسجل
    let history = JSON.parse(localStorage.getItem('mapHistory') || '[]');
    history.unshift({
        date: new Date().toLocaleString('ar'),
        from: routeStart.name || 'نقطة الانطلاق',
        to: routeEnd.name || 'الوجهة'
    });
    localStorage.setItem('mapHistory', JSON.stringify(history));
}

// ========== البحث عن مدينة ==========
function searchCity(name) {
    const coords = cities[name];
    if (coords) {
        addMarker(coords[0], coords[1]);
        showToast('تم الانتقال إلى ' + name);
    }
}

// ========== أماكن قريبة ==========
async function searchNearby(category) {
    if (!userLat || !userLng) {
        showToast('الرجاء تحديد موقعك أولاً');
        return;
    }
    
    const categories = {
        hospital: 'مستشفى',
        pharmacy: 'صيدلية',
        restaurant: 'مطعم',
        fuel: 'محطة وقود',
        mosque: 'مسجد',
        cafe: 'مقهى'
    };
    
    try {
        const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + categories[category] + '&limit=10&lat=' + userLat + '&lon=' + userLng + '&accept-language=ar');
        const data = await res.json();
        
        map.eachLayer(function(layer) {
            if (layer._nearby) map.removeLayer(layer);
        });
        
        data.forEach(function(place) {
            const icon = L.divIcon({
                className: '',
                html: '<div style="width:20px;height:20px;background:#4caf50;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            const marker = L.marker([place.lat, place.lon], { icon }).addTo(map);
            marker._nearby = true;
            marker.bindPopup('<b>' + place.display_name + '</b>');
        });
        
        showToast('تم العثور على ' + data.length + ' ' + categories[category]);
    } catch(e) {
        showToast('تعذر البحث');
    }
}

// ========== المفضلة ==========
function addToFavorites(name, lat, lng) {
    if (favorites.find(f => f.lat === lat && f.lng === lng)) {
        showToast('الموقع موجود مسبقاً');
        return;
    }
    favorites.unshift({ name, lat, lng });
    localStorage.setItem('mapFavs', JSON.stringify(favorites));
    renderFavorites();
    showToast('تمت الإضافة للمفضلة ❤️');
}

function renderFavorites() {
    const container = document.getElementById('favList');
    if (favorites.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center;">لا توجد أماكن مفضلة</p>';
        return;
    }
    container.innerHTML = favorites.map(function(f, i) {
        return '<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #eee;cursor:pointer;" onclick="addMarker(' + f.lat + ',' + f.lng + ')">' +
               '<span>' + f.name + '</span>' +
               '<button onclick="event.stopPropagation();removeFav(' + i + ')" style="background:none;border:none;color:red;cursor:pointer;">🗑️</button>' +
               '</div>';
    }).join('');
}

function removeFav(index) {
    favorites.splice(index, 1);
    localStorage.setItem('mapFavs', JSON.stringify(favorites));
    renderFavorites();
}

// ========== مشاركة ==========
function shareLocation() {
    if (!userLat || !userLng) {
        showToast('الرجاء تحديد موقعك أولاً');
        return;
    }
    const text = '📍 موقعي الحالي\n🗺️ ' + userLat.toFixed(5) + ', ' + userLng.toFixed(5) + '\n🔗 https://www.google.com/maps?q=' + userLat + ',' + userLng;
    const url = 'https://wa.me/?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
}

// ========== توست ==========
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(function() {
        toast.style.display = 'none';
    }, 2500);
}

// ========== تهيئة الأحداث ==========
function initEvents() {
    // زر القائمة
    document.getElementById('menuBtn').addEventListener('click', function() {
        const panel = document.getElementById('menuPanel');
        panel.classList.toggle('show');
        document.getElementById('routePanel').classList.remove('show');
        document.getElementById('favPanel').classList.remove('show');
    });
    
    // زر تحديد الموقع
    document.getElementById('locateBtn').addEventListener('click', locateUser);
    
    // البحث
    document.getElementById('searchInput').addEventListener('input', function() {
        const query = this.value.trim();
        for (const [name, coords] of Object.entries(cities)) {
            if (name.includes(query) && query.length > 1) {
                searchCity(name);
                break;
            }
        }
    });
    
    // الشريط السفلي
    document.querySelectorAll('.nav-item[data-panel]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const panel = this.dataset.panel;
            document.getElementById('menuPanel').classList.remove('show');
            document.getElementById('routePanel').classList.remove('show');
            document.getElementById('favPanel').classList.remove('show');
            
            if (panel === 'route') document.getElementById('routePanel').classList.add('show');
            if (panel === 'fav') document.getElementById('favPanel').classList.add('show');
        });
    });
    
    // مشاركة
    document.getElementById('shareNav').addEventListener('click', shareLocation);
    
    // وسيلة النقل
    document.querySelectorAll('.t-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.t-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            navigationMode = this.dataset.mode;
            if (routeStart && routeEnd) calculateRoute();
        });
    });
    
    // اختيار من الخريطة
    document.getElementById('pickOnMap').addEventListener('click', function() {
        isPickingOnMap = true;
        this.style.color = '#f44336';
        showToast('اضغط على الخريطة لتحديد الوجهة');
    });
    
    // بدء الملاحة
    document.getElementById('startNavBtn').addEventListener('click', function() {
        if (!routeStart && userLat) {
            routeStart = { lat: userLat, lng: userLng, name: 'موقعي الحالي' };
        }
        startNavigation();
    });
    
    // نقطة الانطلاق - استخدام الموقع الحالي
    document.getElementById('startInput').addEventListener('focus', function() {
        if (userLat && userLng) {
            routeStart = { lat: userLat, lng: userLng, name: 'موقعي الحالي' };
            this.value = 'موقعي الحالي';
            if (routeEnd) calculateRoute();
        }
    });
}

// ========== إنشاء قائمة المدن ==========
function buildCityList() {
    const container = document.getElementById('cityList');
    for (const name of Object.keys(cities)) {
        const btn = document.createElement('button');
        btn.className = 'city-btn';
        btn.textContent = name;
        btn.addEventListener('click', function() { searchCity(name); });
        container.appendChild(btn);
    }
}

// ========== إنشاء قائمة الأماكن القريبة ==========
function buildNearbyList() {
    const categories = [
        { id: 'hospital', name: '🏥 مستشفيات' },
        { id: 'pharmacy', name: '💊 صيدليات' },
        { id: 'restaurant', name: '🍽️ مطاعم' },
        { id: 'fuel', name: '⛽ محطات وقود' },
        { id: 'mosque', name: '🕌 مساجد' },
        { id: 'cafe', name: '☕ مقاهي' }
    ];
    
    const container = document.getElementById('nearbyList');
    categories.forEach(function(cat) {
        const btn = document.createElement('button');
        btn.className = 'city-btn';
        btn.textContent = cat.name;
        btn.addEventListener('click', function() { searchNearby(cat.id); });
        container.appendChild(btn);
    });
}

// ========== بدء التطبيق ==========
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    initEvents();
    buildCityList();
    buildNearbyList();
    renderFavorites();
    
    // محاولة تحديد الموقع تلقائياً
    setTimeout(locateUser, 1000);
});
