// تهيئة الخريطة الأساسية
const map = L.map('map', {
    center: [34.8021, 38.9968],
    zoom: 7,
    zoomControl: false,
    attributionControl: true
});

// طبقة الخريطة العادية
const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap | خريطة سوريا التفاعلية',
    maxZoom: 19
}).addTo(map);

// طبقة القمر الصناعي
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri | خريطة سوريا التفاعلية',
    maxZoom: 19
});

// المتغيرات العامة
let currentMarker = null;
let userLocationMarker = null;
let startMarker = null;
let endMarker = null;
let currentRoute = null;
let startPoint = null;
let endPoint = null;
let currentMode = 'car';
let currentView = '3d';
let currentRotation = 0;
let currentTilt = 45;
let is3DMode = true;

// إحداثيات المدن السورية
const syrianCities = {
    'دمشق': { lat: 33.5138, lng: 36.2765, zoom: 14 },
    'حلب': { lat: 36.2021, lng: 37.1343, zoom: 14 },
    'حمص': { lat: 34.7324, lng: 36.7137, zoom: 14 },
    'اللاذقية': { lat: 35.5214, lng: 35.7924, zoom: 14 },
    'حماة': { lat: 35.1318, lng: 36.7578, zoom: 14 },
    'دير الزور': { lat: 35.3333, lng: 40.1500, zoom: 14 },
    'الرقة': { lat: 35.9500, lng: 39.0167, zoom: 13 },
    'الحسكة': { lat: 36.4833, lng: 40.7500, zoom: 13 },
    'طرطوس': { lat: 34.8833, lng: 35.8833, zoom: 13 },
    'إدلب': { lat: 35.9297, lng: 36.6317, zoom: 13 },
    'درعا': { lat: 32.6167, lng: 36.1000, zoom: 13 },
    'السويداء': { lat: 32.7000, lng: 36.5667, zoom: 13 },
    'القنيطرة': { lat: 33.1167, lng: 35.8167, zoom: 13 }
};

// تطبيق التأثير ثلاثي الأبعاد
function apply3DEffect() {
    const mapContainer = document.getElementById('map');
    
    if (is3DMode) {
        mapContainer.style.transform = `perspective(1500px) rotateX(${currentTilt}deg) rotateZ(${currentRotation}deg)`;
        mapContainer.style.transition = 'transform 0.5s ease';
    } else {
        mapContainer.style.transform = 'perspective(1500px) rotateX(0deg) rotateZ(0deg)';
        mapContainer.style.transition = 'transform 0.5s ease';
    }
}

// تحديث عرض الإحداثيات
function updateCoordinatesDisplay(lat, lng) {
    document.getElementById('latitude').textContent = lat.toFixed(6);
    document.getElementById('longitude').textContent = lng.toFixed(6);
    
    const shareLink = `https://www.google.com/maps?q=${lat},${lng}`;
    document.getElementById('shareLink').value = shareLink;
    
    document.getElementById('latitude').classList.add('updated');
    document.getElementById('longitude').classList.add('updated');
    
    setTimeout(() => {
        document.getElementById('latitude').classList.remove('updated');
        document.getElementById('longitude').classList.remove('updated');
    }, 500);
}

// الحصول على اسم المنطقة
async function getLocationName(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`);
        const data = await response.json();
        return data.display_name || 'موقع غير معروف';
    } catch (error) {
        return 'تعذر تحديد اسم المنطقة';
    }
}

// إنشاء أيقونة مخصصة
function createCustomIcon(color) {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-pin" style="background: ${color}; box-shadow: 0 0 20px ${color}99;"></div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -42]
    });
}

// إضافة علامة على الخريطة
function addMarkerToMap(lat, lng, popupText = '') {
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    const customIcon = createCustomIcon('#4facfe');
    currentMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    
    if (popupText) {
        currentMarker.bindPopup(popupText).openPopup();
    }

    map.flyTo([lat, lng], 15, {
        duration: 1.5
    });
}

// تحديد موقع المستخدم
async function locateUser() {
    const locationInfo = document.getElementById('currentLocation');
    locationInfo.innerHTML = '<p class="waiting-text">جاري تحديد موقعك...</p>';
    
    if (!navigator.geolocation) {
        locationInfo.innerHTML = '<p style="color: #ff6b6b;">المتصفح لا يدعم تحديد الموقع الجغرافي</p>';
        return;
    }

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        updateCoordinatesDisplay(lat, lng);

        if (userLocationMarker) {
            map.removeLayer(userLocationMarker);
        }

        const userIcon = createCustomIcon('#ff6b6b');
        userLocationMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
        
        const locationName = await getLocationName(lat, lng);
        
        locationInfo.innerHTML = `
            <p style="color: #c8d2f0; margin-bottom: 5px;">
                <i class="fas fa-map-pin" style="color: #ff6b6b;"></i>
                <strong>أنت هنا:</strong>
            </p>
            <p style="color: #a0b0d0; font-size: 13px;">${locationName}</p>
        `;

        L.circle([lat, lng], {
            radius: 100,
            color: '#ff6b6b',
            fillColor: '#ff6b6b',
            fillOpacity: 0.1,
            weight: 1
        }).addTo(map);

        map.flyTo([lat, lng], 16, {
            duration: 2
        });

        startPoint = { lat, lng };
        updateStartMarker();

    } catch (error) {
        locationInfo.innerHTML = `
            <p style="color: #ff6b6b;">
                <i class="fas fa-exclamation-triangle"></i>
                ${error.message === 'User denied Geolocation' 
                    ? 'تم رفض إذن تحديد الموقع' 
                    : 'تعذر تحديد موقعك. حاول مرة أخرى'}
            </p>
        `;
    }
}

// تحديث علامة نقطة الانطلاق
function updateStartMarker() {
    if (startMarker) {
        map.removeLayer(startMarker);
    }
    if (startPoint) {
        const startIcon = createCustomIcon('#4caf50');
        startMarker = L.marker([startPoint.lat, startPoint.lng], { icon: startIcon })
            .bindPopup('📍 نقطة الانطلاق')
            .addTo(map);
    }
}

// تحديث علامة نقطة الوصول
function updateEndMarker() {
    if (endMarker) {
        map.removeLayer(endMarker);
    }
    if (endPoint) {
        const endIcon = createCustomIcon('#f44336');
        endMarker = L.marker([endPoint.lat, endPoint.lng], { icon: endIcon })
            .bindPopup('🏁 نقطة الوصول')
            .addTo(map);
    }
}

// حساب المسار بين نقطتين
async function calculateRouteBetweenPoints() {
    if (!startPoint || !endPoint) {
        showToast('يرجى تعيين نقطة الانطلاق ونقطة الوصول أولاً', 'warning');
        return;
    }

    if (currentRoute) {
        map.removeLayer(currentRoute);
    }

    const routeInfo = document.getElementById('routeInfo');
    routeInfo.style.display = 'flex';
    
    document.getElementById('routeDistance').textContent = 'جاري الحساب...';
    document.getElementById('routeTime').textContent = 'جاري الحساب...';

    try {
        const profile = currentMode === 'car' ? 'driving' : currentMode === 'walking' ? 'walking' : 'cycling';
        const url = `https://router.project-osrm.org/route/v1/${profile}/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?overview=full&geometries=geojson&steps=true`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distance = (route.distance / 1000).toFixed(2);
            const duration = Math.round(route.duration / 60);
            
            document.getElementById('routeDistance').textContent = `${distance} كم`;
            
            if (duration < 60) {
                document.getElementById('routeTime').textContent = `${duration} دقيقة`;
            } else {
                const hours = Math.floor(duration / 60);
                const minutes = duration % 60;
                document.getElementById('routeTime').textContent = `${hours} ساعة و ${minutes} دقيقة`;
            }
            
            const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            let routeColor;
            switch(currentMode) {
                case 'car': routeColor = '#4facfe'; break;
                case 'walking': routeColor = '#8b5cf6'; break;
                case 'bicycle': routeColor = '#00bcd4'; break;
                default: routeColor = '#4facfe';
            }
            
            currentRoute = L.polyline(coordinates, {
                color: routeColor,
                weight: 5,
                opacity: 0.8,
                dashArray: currentMode === 'walking' ? '10, 10' : null,
                lineJoin: 'round'
            }).addTo(map);
            
            map.fitBounds(currentRoute.getBounds(), {
                padding: [50, 50]
            });
            
            showToast('تم حساب المسار بنجاح! 🎉', 'success');
        } else {
            showToast('تعذر العثور على مسار بين النقطتين', 'error');
        }
    } catch (error) {
        console.error('خطأ في حساب المسار:', error);
        showToast('حدث خطأ في حساب المسار', 'error');
    }
}

// مسح المسار
function clearRoute() {
    if (currentRoute) {
        map.removeLayer(currentRoute);
        currentRoute = null;
    }
    
    document.getElementById('routeInfo').style.display = 'none';
    
    startPoint = null;
    endPoint = null;
    
    if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
    if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
    
    showToast('تم مسح المسار', 'info');
}

// مشاركة الموقع
function shareLocation(platform) {
    const lat = document.getElementById('latitude').textContent;
    const lng = document.getElementById('longitude').textContent;
    
    if (lat === '--' || lng === '--') {
        showToast('يرجى تحديد موقع أولاً', 'warning');
        return;
    }
    
    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
    const text = encodeURIComponent(`📍 موقعي الحالي:\n${mapsLink}`);
    
    let shareUrl;
    
    switch(platform) {
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${text}`;
            break;
        case 'telegram':
            shareUrl = `https://t.me/share/url?url=${encodeURIComponent(mapsLink)}&text=${text}`;
            break;
        case 'email':
            shareUrl = `mailto:?subject=${encodeURIComponent('مشاركة موقع')}&body=${text}`;
            break;
        case 'copy':
            navigator.clipboard.writeText(mapsLink).then(() => {
                showToast('تم نسخ الرابط بنجاح! 📋', 'success');
            });
            return;
    }
    
    if (shareUrl) {
        window.open(shareUrl, '_blank');
    }
}

// إظهار رسالة توست
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = toast.querySelector('i');
    const text = toast.querySelector('span');
    
    switch(type) {
        case 'success':
            icon.className = 'fas fa-check-circle';
            break;
        case 'warning':
            icon.className = 'fas fa-exclamation-triangle';
            break;
        case 'error':
            icon.className = 'fas fa-times-circle';
            break;
        case 'info':
            icon.className = 'fas fa-info-circle';
            break;
    }
    
    text.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// البحث عن مدينة
async function searchCity(cityName) {
    const city = syrianCities[cityName];
    if (city) {
        addMarkerToMap(city.lat, city.lng, `<strong>${cityName}</strong>`);
        updateCoordinatesDisplay(city.lat, city.lng);
        document.getElementById('currentLocation').innerHTML = `
            <p style="color: #c8d2f0;">
                <i class="fas fa-city" style="color: #4facfe;"></i>
                <strong>${cityName}</strong>
            </p>
        `;
    }
}

// أحداث النقر على الخريطة
map.on('click', async function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    updateCoordinatesDisplay(lat, lng);
    addMarkerToMap(lat, lng);
    
    const locationName = await getLocationName(lat, lng);
    document.getElementById('currentLocation').innerHTML = `
        <p style="color: #c8d2f0;">
            <i class="fas fa-map-pin" style="color: #4facfe;"></i>
            ${locationName}
        </p>
    `;
    
    currentMarker.bindPopup(locationName).openPopup();
});

// تحديث عرض الإحداثيات عند تحريك الخريطة
map.on('move', function() {
    const center = map.getCenter();
    updateCoordinatesDisplay(center.lat, center.lng);
});

// أحداث الأزرار
document.getElementById('locateMeBtn').addEventListener('click', locateUser);

document.getElementById('zoomIn').addEventListener('click', () => {
    map.zoomIn({ duration: 0.5 });
});

document.getElementById('zoomOut').addEventListener('click', () => {
    map.zoomOut({ duration: 0.5 });
});

// أزرار المدن
document.querySelectorAll('.city-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cityName = btn.dataset.city;
        searchCity(cityName);
    });
});

// أزرار نوع الخريطة
document.querySelectorAll('.map-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.map-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const type = btn.dataset.type;
        if (type === 'standard') {
            map.removeLayer(satelliteLayer);
            map.addLayer(standardLayer);
        } else if (type === 'satellite') {
            map.removeLayer(standardLayer);
            map.addLayer(satelliteLayer);
        }
    });
});

// أزرار وسيلة النقل
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
        
        if (startPoint && endPoint) {
            calculateRouteBetweenPoints();
        }
    });
});

// أزرار المسار
document.getElementById('setStartPoint').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('latitude').textContent);
    const lng = parseFloat(document.getElementById('longitude').textContent);
    
    if (!isNaN(lat) && !isNaN(lng)) {
        startPoint = { lat, lng };
        updateStartMarker();
        showToast('تم تعيين نقطة الانطلاق 🟢', 'success');
    }
});

document.getElementById('setEndPoint').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('latitude').textContent);
    const lng = parseFloat(document.getElementById('longitude').textContent);
    
    if (!isNaN(lat) && !isNaN(lng)) {
        endPoint = { lat, lng };
        updateEndMarker();
        showToast('تم تعيين نقطة الوصول 🔴', 'success');
    }
});

document.getElementById('calculateRoute').addEventListener('click', calculateRouteBetweenPoints);
document.getElementById('clearRoute').addEventListener('click', clearRoute);

// أزرار المشاركة
document.getElementById('shareWhatsApp').addEventListener('click', () => shareLocation('whatsapp'));
document.getElementById('shareTelegram').addEventListener('click', () => shareLocation('telegram'));
document.getElementById('shareEmail').addEventListener('click', () => shareLocation('email'));
document.getElementById('copyLocation').addEventListener('click', () => shareLocation('copy'));
document.getElementById('copyLinkBtn').addEventListener('click', () => shareLocation('copy'));

// أزرار التحكم ثلاثي الأبعاد
document.getElementById('rotateLeft').addEventListener('click', () => {
    if (is3DMode) {
        currentRotation -= 15;
        apply3DEffect();
    }
});

document.getElementById('rotateRight').addEventListener('click', () => {
    if (is3DMode) {
        currentRotation += 15;
        apply3DEffect();
    }
});

document.getElementById('rotateNorth').addEventListener('click', () => {
    if (is3DMode) {
        currentRotation = 0;
        currentTilt = 45;
        apply3DEffect();
    }
});

document.getElementById('tiltUp').addEventListener('click', () => {
    if (is3DMode) {
        currentTilt = currentTilt === 45 ? 60 : currentTilt === 60 ? 30 : 45;
        apply3DEffect();
    }
});

// أزرار عرض 2D/3D
document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const view = btn.dataset.view;
        if (view === '3d') {
            is3DMode = true;
            document.querySelectorAll('.rotate-btn').forEach(b => b.style.display = '');
        } else {
            is3DMode = false;
            document.querySelectorAll('.rotate-btn').forEach(b => b.style.display = 'none');
        }
        apply3DEffect();
    });
});

// دعم الإمالة بزر Ctrl + السحب
let isCtrlPressed = false;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Control') {
        isCtrlPressed = true;
        document.getElementById('map').style.cursor = 'move';
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Control') {
        isCtrlPressed = false;
        document.getElementById('map').style.cursor = '';
    }
});

// البحث المباشر
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length >= 2) {
        searchTimeout = setTimeout(() => {
            for (const [cityName] of Object.entries(syrianCities)) {
                if (cityName.includes(query)) {
                    searchCity(cityName);
                    break;
                }
            }
        }, 500);
    }
});

// تهيئة أولية
const initialCenter = map.getCenter();
updateCoordinatesDisplay(initialCenter.lat, initialCenter.lng);
document.getElementById('currentLocation').innerHTML = `
    <p style="color: #c8d2f0;">
        <i class="fas fa-globe" style="color: #4facfe;"></i>
        سوريا - عرض الخريطة
    </p>
`;

// تطبيق التأثير ثلاثي الأبعاد عند البداية
apply3DEffect();

console.log('خريطة سوريا ثلاثية الأبعاد جاهزة! 🌍✨');
console.log('استخدم Ctrl + سحب الماوس للإمالة');
