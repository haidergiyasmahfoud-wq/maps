// تهيئة الخريطة
const map = L.map('map').setView([34.8021, 38.9968], 7);

// إضافة طبقة الخريطة الأساسية
const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© خريطة سوريا التفاعلية',
    maxZoom: 19
}).addTo(map);

// طبقة القمر الصناعي
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri',
    maxZoom: 19
});

// المتغيرات العامة
let currentMarker = null;
let userLocationMarker = null;
let currentLayer = 'standard';

// إحداثيات المدن السورية
const syrianCities = {
    'دمشق': { lat: 33.5138, lng: 36.2765, zoom: 13 },
    'حلب': { lat: 36.2021, lng: 37.1343, zoom: 13 },
    'حمص': { lat: 34.7324, lng: 36.7137, zoom: 13 },
    'اللاذقية': { lat: 35.5214, lng: 35.7924, zoom: 13 },
    'حماة': { lat: 35.1318, lng: 36.7578, zoom: 13 },
    'دير الزور': { lat: 35.3333, lng: 40.1500, zoom: 13 },
    'الرقة': { lat: 35.9500, lng: 39.0167, zoom: 13 },
    'الحسكة': { lat: 36.4833, lng: 40.7500, zoom: 13 },
    'طرطوس': { lat: 34.8833, lng: 35.8833, zoom: 13 },
    'إدلب': { lat: 35.9297, lng: 36.6317, zoom: 13 },
    'درعا': { lat: 32.6167, lng: 36.1000, zoom: 13 },
    'السويداء': { lat: 32.7000, lng: 36.5667, zoom: 13 },
    'القنيطرة': { lat: 33.1167, lng: 35.8167, zoom: 13 }
};

// تحديث عرض الإحداثيات
function updateCoordinatesDisplay(lat, lng) {
    document.getElementById('latitude').textContent = lat.toFixed(6);
    document.getElementById('longitude').textContent = lng.toFixed(6);
    
    // إضافة تأثير حركي
    document.getElementById('latitude').classList.add('updated');
    document.getElementById('longitude').classList.add('updated');
    
    setTimeout(() => {
        document.getElementById('latitude').classList.remove('updated');
        document.getElementById('longitude').classList.remove('updated');
    }, 500);
}

// الحصول على اسم المنطقة من الإحداثيات
async function getLocationName(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`);
        const data = await response.json();
        return data.display_name || 'موقع غير معروف';
    } catch (error) {
        return 'تعذر تحديد اسم المنطقة';
    }
}

// إضافة علامة على الخريطة
function addMarkerToMap(lat, lng, popupText = '') {
    // إزالة العلامة السابقة
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    // إنشاء أيقونة مخصصة
    const customIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin"></div>',
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -42]
    });

    // إضافة العلامة الجديدة
    currentMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    
    if (popupText) {
        currentMarker.bindPopup(popupText).openPopup();
    }

    // تحريك الخريطة إلى الموقع
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

        // تحديث الإحداثيات
        updateCoordinatesDisplay(lat, lng);

        // إزالة علامة المستخدم السابقة
        if (userLocationMarker) {
            map.removeLayer(userLocationMarker);
        }

        // إنشاء أيقونة خاصة للمستخدم
        const userIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div class="marker-pin" style="background: #ff6b6b; box-shadow: 0 0 20px rgba(255, 107, 107, 0.6);"></div>',
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        });

        // إضافة علامة المستخدم
        userLocationMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
        
        // الحصول على اسم المنطقة
        const locationName = await getLocationName(lat, lng);
        
        // تحديث معلومات الموقع
        locationInfo.innerHTML = `
            <p style="color: #c8d2f0; margin-bottom: 5px;">
                <i class="fas fa-map-pin" style="color: #ff6b6b;"></i>
                <strong>أنت هنا:</strong>
            </p>
            <p style="color: #a0b0d0; font-size: 13px;">${locationName}</p>
        `;

        // إضافة دائرة نصف قطرها 100 متر
        L.circle([lat, lng], {
            radius: 100,
            color: '#ff6b6b',
            fillColor: '#ff6b6b',
            fillOpacity: 0.1,
            weight: 1
        }).addTo(map);

        // تحريك الخريطة إلى موقع المستخدم
        map.flyTo([lat, lng], 16, {
            duration: 2
        });

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

// البحث عن مدينة
function searchCity(cityName) {
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

// النقر على الخريطة
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
    map.zoomIn();
});

document.getElementById('zoomOut').addEventListener('click', () => {
    map.zoomOut();
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
        const type = btn.dataset.type;
        
        // إزالة الفئة النشطة من جميع الأزرار
        document.querySelectorAll('.map-type-btn').forEach(b => b.classList.remove('active'));
        // إضافة الفئة النشطة للزر المضغوط
        btn.classList.add('active');
        
        if (type === 'standard') {
            map.removeLayer(satelliteLayer);
            map.addLayer(standardLayer);
            currentLayer = 'standard';
        } else if (type === 'satellite') {
            map.removeLayer(standardLayer);
            map.addLayer(satelliteLayer);
            currentLayer = 'satellite';
        }
    });
});

// البحث المباشر
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length >= 2) {
        searchTimeout = setTimeout(() => {
            // البحث في المدن السورية
            for (const [cityName, coords] of Object.entries(syrianCities)) {
                if (cityName.includes(query)) {
                    searchCity(cityName);
                    break;
                }
            }
        }, 500);
    }
});

// تحديث الإحداثيات الأولية
const initialCenter = map.getCenter();
updateCoordinatesDisplay(initialCenter.lat, initialCenter.lng);
document.getElementById('currentLocation').innerHTML = `
    <p style="color: #c8d2f0;">
        <i class="fas fa-globe" style="color: #4facfe;"></i>
        سوريا - عرض الخريطة
    </p>
`;

// إضافة تأثيرات جمالية للخريطة
map.on('load', function() {
    console.log('خريطة سوريا جاهزة! 🗺️');
});
