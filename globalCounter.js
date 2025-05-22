class GlobalViewCounter {
    constructor() {
        this.storageKey = 'globalPageViews';
        this.sessionKey = 'sessionViewed';
        this.indexKey = 'indexViewed';
        this.deviceKey = 'deviceId';
        this.syncKey = 'lastSync';
        this.setupDevice();
        this.initializeCounter();
        this.setupSync();
    }

    setupDevice() {
        // Crear ID único para el dispositivo si no existe
        if (!localStorage.getItem(this.deviceKey)) {
            localStorage.setItem(this.deviceKey, 
                'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
            );
        }
    }

    setupSync() {
        // Sincronizar cada 30 segundos
        setInterval(() => this.syncViews(), 30000);

        // Sincronizar al volver online
        window.addEventListener('online', () => this.syncViews());

        // Escuchar cambios de otros dispositivos
        window.addEventListener('storage', (e) => {
            if (e.key === this.storageKey) {
                this.handleExternalUpdate(e.newValue);
            }
        });
    }

    handleExternalUpdate(newValue) {
        if (newValue) {
            const views = parseInt(newValue);
            if (!isNaN(views)) {
                this.updateDisplay(views);
            }
        }
    }

    syncViews() {
        try {
            const currentViews = localStorage.getItem(this.storageKey);
            const lastSync = localStorage.getItem(this.syncKey);
            const now = Date.now();

            // Sincronizar solo si han pasado más de 30 segundos
            if (!lastSync || (now - parseInt(lastSync)) > 30000) {
                localStorage.setItem(this.syncKey, now.toString());
                
                // Crear evento para otros dispositivos
                const event = new StorageEvent('storage', {
                    key: this.storageKey,
                    newValue: currentViews,
                    url: window.location.href
                });
                window.dispatchEvent(event);
            }
        } catch (error) {
            console.error('Error en sincronización:', error);
        }
    }

    initializeCounter() {
        const currentPath = window.location.pathname;
        const isIndex = currentPath.includes('index.html') || currentPath.endsWith('/');
        const deviceId = localStorage.getItem(this.deviceKey);
        const hasViewedIndex = sessionStorage.getItem(this.indexKey);
        const hasViewedOther = sessionStorage.getItem(this.sessionKey);

        let shouldCount = false;

        if (isIndex && !hasViewedIndex) {
            sessionStorage.setItem(this.indexKey, 'true');
            shouldCount = true;
        } else if (!isIndex && !hasViewedOther) {
            sessionStorage.setItem(this.sessionKey, 'true');
            shouldCount = true;
        }

        if (shouldCount) {
            let views = parseInt(localStorage.getItem(this.storageKey)) || 0;
            views++;
            localStorage.setItem(this.storageKey, views.toString());
            this.syncViews(); // Sincronizar al incrementar
            this.updateDisplay(views);
        } else {
            const currentViews = parseInt(localStorage.getItem(this.storageKey)) || 0;
            this.updateDisplay(currentViews);
        }
    }

    updateDisplay(count) {
        const viewCountElement = document.getElementById('viewCount');
        if (viewCountElement) {
            viewCountElement.textContent = new Intl.NumberFormat('es-MX').format(count);
        }
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Inicializar el contador
document.addEventListener('DOMContentLoaded', () => {
    const viewCounter = new GlobalViewCounter();
    
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    let isMenuVisible = true;

    document.addEventListener('click', (e) => {
        // Lista de selectores a ignorar
        const ignoreElements = [
            '.component-card',
            '.info-btn',
            '.modal-overlay',
            '.modal-content',
            '.comments-section',
            '.comment-form',
            'button',
            'input',
            'textarea'
        ];

        // Verificar si el clic fue en un elemento que debemos ignorar
        const shouldIgnore = ignoreElements.some(selector => 
            e.target.closest(selector) !== null
        );

        // Si no debemos ignorar el clic y no fue dentro del sidebar
        if (!shouldIgnore && !sidebar.contains(e.target)) {
            toggleMenu();
        }
    });

    // Evitar que los clics dentro del sidebar cierren el menú
    sidebar.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    function toggleMenu() {
        isMenuVisible = !isMenuVisible;
        sidebar.classList.toggle('hidden', !isMenuVisible);
        content.classList.toggle('expanded', !isMenuVisible);
    }
});