// Service Worker para PWA - Hidropónica
const CACHE_NAME = 'hidroponica-v1';
const RUNTIME_CACHE = 'hidroponica-runtime';

// Archivos que se cachean en la instalación
const STATIC_ASSETS = [
    '/',
    '/practica4.html',
    '/estilo.css',
    '/practica4.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ===== INSTALACIÓN DEL SERVICE WORKER =====
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando assets estáticos...');
                return cache.addAll(STATIC_ASSETS)
                    .catch((error) => {
                        console.warn('[Service Worker] Error al cachear algunos assets:', error);
                        // No fallar todo si algunos CDN no están disponibles
                        return Promise.resolve();
                    });
            })
            .then(() => {
                console.log('[Service Worker] Instalación completada');
                return self.skipWaiting();
            })
    );
});

// ===== ACTIVACIÓN DEL SERVICE WORKER =====
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activando...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        console.log('[Service Worker] Eliminando cache viejo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Activación completada');
            return self.clients.claim();
        })
    );
});

// ===== ESTRATEGIA DE FETCH =====
// Cache First para assets estáticos
// Network First para datos dinámicos
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // No cachear las solicitudes a Firebase o APIs externas (datos en vivo)
    if (url.origin !== self.location.origin && 
        url.hostname.includes('firebase') || 
        url.hostname.includes('googleapis')) {
        
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clonar la respuesta para poder usarla
                    const clonedResponse = response.clone();
                    
                    // Guardar en cache de runtime para disponibilidad offline
                    if (response && response.status === 200 && response.type !== 'error') {
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(request, clonedResponse);
                        });
                    }
                    
                    return response;
                })
                .catch(() => {
                    // Si falla, intentar obtener del cache
                    return caches.match(request)
                        .then((cached) => cached || createOfflineResponse());
                })
        );
    } 
    // Cache First para assets estáticos (HTML, CSS, JS, fonts)
    else if (isStaticAsset(url)) {
        event.respondWith(
            caches.match(request)
                .then((cached) => {
                    if (cached) {
                        return cached;
                    }
                    
                    return fetch(request)
                        .then((response) => {
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            
                            // Cachear la respuesta
                            const cloned = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, cloned);
                            });
                            
                            return response;
                        })
                        .catch(() => createOfflineResponse());
                })
        );
    }
    // Network First para el resto (dinámico)
    else {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (!response || response.status !== 200) {
                        return response;
                    }
                    
                    // Clonar para cachear
                    const cloned = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(request, cloned);
                    });
                    
                    return response;
                })
                .catch(() => {
                    // Intentar obtener del cache
                    return caches.match(request)
                        .then((cached) => cached || createOfflineResponse());
                })
        );
    }
});

// ===== FUNCIONES AUXILIARES =====
function isStaticAsset(url) {
    const staticExtensions = ['.html', '.css', '.js', '.woff', '.woff2', '.png', '.jpg', '.jpeg', '.svg', '.ico'];
    const path = url.pathname.toLowerCase();
    
    return staticExtensions.some(ext => path.endsWith(ext)) || 
           url.hostname.includes('cdn.jsdelivr.net') ||
           url.hostname.includes('cdnjs.cloudflare.com') ||
           url.hostname.includes('fonts.googleapis.com');
}

function createOfflineResponse() {
    return new Response(
        `<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sin Conexión</title>
            <style>
                body {
                    font-family: 'Inter', sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .offline-container {
                    text-align: center;
                    background: white;
                    padding: 2rem;
                    border-radius: 10px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    max-width: 500px;
                }
                .offline-icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }
                h1 {
                    color: #333;
                    margin: 1rem 0;
                }
                p {
                    color: #666;
                    line-height: 1.6;
                }
                .info {
                    background: #f0f9ff;
                    padding: 1rem;
                    border-radius: 8px;
                    margin-top: 1rem;
                    color: #0369a1;
                    font-size: 0.9rem;
                }
            </style>
        </head>
        <body>
            <div class="offline-container">
                <div class="offline-icon">📡</div>
                <h1>Sin Conexión a Internet</h1>
                <p>No hay conexión disponible. Algunos datos pueden estar en caché.</p>
                <div class="info">
                    <strong>Última sincronización:</strong> ${new Date().toLocaleString('es-ES')}
                </div>
            </div>
        </body>
        </html>`,
        {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/html; charset=utf-8'
            })
        }
    );
}

// ===== MENSAJE DE CONTROL =====
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLIENTS_CLAIM') {
        self.clients.claim();
    }
});

// ===== NOTIFICACIONES EN BACKGROUND =====
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body || 'Nuevo evento en el sistema de hidropónica',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23dc2626" width="192" height="192"/><text x="50%" y="50%" font-size="80" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">H</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><text x="48" y="48" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">🌱</text></svg>',
            tag: data.tag || 'hidroponica-notification',
            requireInteraction: data.requireInteraction || false,
            data: data.data || {}
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'Monitoreo Hidropónico', options)
        );
    }
});

// Permitir clic en notificaciones
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Buscar si ya hay una ventana abierta
            for (let i = 0; i < clientList.length; i++) {
                if (clientList[i].url.includes('practica4.html') && 'focus' in clientList[i]) {
                    return clientList[i].focus();
                }
            }
            // Si no hay, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow('/hidroponia3/nueva carpeta 2/2/practica4.html');
            }
        })
    );
});

console.log('[Service Worker] Cargado correctamente');
