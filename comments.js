class CommentSystem {
    constructor() {
        this.comments = this.loadAllComments();
        this.currentUser = null;
        this.maxComments = 10000;
        this.refreshInterval = 3000;
        this.lastUpdateTime = Date.now();
        this.userLikes = this.loadUserLikes();
        
        // Primero cargar la sesión antes que nada
        this.loadSession();
        
        // Luego inicializar el resto
        this.loadFromLocalStorage();
        this.renderComments();
        this.setupEventListeners();
        this.setupBackup();
        this.setupRealtimeSync();
    }

    loadSession() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = savedUser;
            this.updateUI(true);
        }
    }

    handleLogin() {
        const loginInput = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!loginInput || !password) {
            this.showError('Por favor completa todos los campos');
            return;
        }

        // Guardar sesión permanentemente
        this.currentUser = loginInput;
        localStorage.setItem('currentUser', loginInput);
        localStorage.setItem('sessionActive', 'true');
        
        this.updateUI(true);
        this.hideError();
        
        // Limpiar campos del formulario
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    handleLogout() {
        // Solo cerrar sesión si el usuario confirma explícitamente
        if (confirm('¿Seguro que deseas cerrar sesión?')) {
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            localStorage.removeItem('sessionActive');
            this.updateUI(false);
        }
    }

    // Eliminar métodos de verificación de tiempo
    checkSession() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = savedUser;
            this.updateUI(true);
            return true;
        }
        return false;
    }

    setupAutoRefresh() {
        // Solo actualizar cuando hay nuevos comentarios
        window.addEventListener('storage', (event) => {
            if (event.key === 'comments') {
                this.handleExternalChange(event.newValue);
            }
        });
    }

    setupRealtimeSync() {
        // Verificar nuevos comentarios cada 3 segundos
        this.syncInterval = setInterval(() => {
            this.checkForNewComments();
        }, 3000);

        // Sincronizar al volver online
        window.addEventListener('online', () => {
            this.loadFromLocalStorage();
            this.renderComments();
        });

        // Escuchar cambios de otros dispositivos
        window.addEventListener('storage', (event) => {
            if (event.key === 'comments' || event.key === 'comments_backup') {
                this.handleExternalChange(event.newValue);
            }
        });
    }

    handleExternalChange(newValue) {
        try {
            if (newValue) {
                const externalComments = JSON.parse(newValue);
                // Verificar si hay comentarios nuevos o diferentes
                if (this.hasNewOrUpdatedComments(externalComments)) {
                    this.mergeComments(externalComments);
                    this.renderComments();
                    this.notifyNewComments();
                }
            }
        } catch (error) {
            console.error('Error al procesar cambios externos:', error);
        }
    }

    hasNewOrUpdatedComments(externalComments) {
        if (!Array.isArray(externalComments)) return false;
        
        const currentIds = new Set(this.comments.map(c => c.id));
        const externalIds = new Set(externalComments.map(c => c.id));

        // Verificar si hay nuevos IDs o diferentes cantidades
        if (currentIds.size !== externalIds.size) return true;

        // Verificar si hay comentarios actualizados
        return externalComments.some(extComment => {
            const localComment = this.comments.find(c => c.id === extComment.id);
            return !localComment || 
                   localComment.likes !== extComment.likes ||
                   localComment.text !== extComment.text;
        });
    }

    mergeComments(externalComments) {
        // Combinar comentarios manteniendo los más recientes
        const mergedComments = [...this.comments];
        const existingIds = new Set(mergedComments.map(c => c.id));

        externalComments.forEach(extComment => {
            if (!existingIds.has(extComment.id)) {
                // Nuevo comentario
                mergedComments.push(extComment);
            } else {
                // Actualizar comentario existente si es más reciente
                const index = mergedComments.findIndex(c => c.id === extComment.id);
                if (new Date(extComment.date) > new Date(mergedComments[index].date)) {
                    mergedComments[index] = extComment;
                }
            }
        });

        // Ordenar por fecha y actualizar
        this.comments = mergedComments.sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        // Guardar cambios
        this.saveToLocalStorage();
    }

    checkForNewComments() {
        const savedComments = localStorage.getItem('comments');
        if (savedComments) {
            this.handleExternalChange(savedComments);
        }
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Comment form
        document.getElementById('commentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addComment();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });
    }

    isValidUsername(username) {
        // Permitir letras (incluyendo ñ y acentos), números y guiones
        const usernameRegex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ0-9-]{3,20}$/;
        return usernameRegex.test(username);
    }

    isValidEmail(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    isAllowedDomain(email) {
        return this.validDomains.some(domain => email.endsWith(domain));
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    hideError() {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    addComment() {
        if (!this.currentUser) return;

        const commentText = document.getElementById('commentText').value;
        if (!commentText) return;

        const newComment = {
            id: Date.now(),
            user: this.currentUser,
            text: commentText,
            date: new Date().toISOString(),
            likes: 0
        };

        this.comments.unshift(newComment);
        if (this.comments.length > this.maxComments) {
            this.comments.pop();
        }

        this.saveToLocalStorage();
        this.renderComments();
        document.getElementById('commentText').value = '';
    }

    renderComments() {
        const commentsContainer = document.getElementById('commentsList');
        if (!commentsContainer) return;

        // Mostrar los comentarios aunque no haya sesión iniciada
        commentsContainer.style.display = 'block';

        if (this.comments.length === 0) {
            commentsContainer.innerHTML = '<p class="no-comments">No hay comentarios aún.</p>';
            return;
        }

        commentsContainer.innerHTML = '';
        
        // Ordenar comentarios por fecha, más recientes primero
        const sortedComments = [...this.comments].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        sortedComments.forEach(comment => {
            const likeKey = this.currentUser ? `${this.currentUser}-${comment.id}` : null;
            const hasLiked = this.userLikes[likeKey];
            
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `
                <div class="comment-header">
                    <strong>${comment.user}</strong>
                    <span>${new Date(comment.date).toLocaleDateString()}</span>
                </div>
                <div class="comment-body">${comment.text}</div>
                <div class="comment-footer">
                    <button class="like-btn ${hasLiked ? 'liked' : ''}" 
                            onclick="${this.currentUser ? `commentSystem.likeComment(${comment.id})` : "alert('Inicia sesión para dar like')"}"
                            ${hasLiked ? 'disabled' : ''}>
                        ${hasLiked ? '❤️' : '👍'} ${comment.likes}
                    </button>
                    ${this.currentUser && comment.user === this.currentUser ? 
                        `<button class="delete-btn" onclick="commentSystem.deleteComment(${comment.id})">
                            🗑️ Borrar
                        </button>` : 
                        ''}
                </div>
            `;
            commentsContainer.appendChild(commentElement);
        });
    }

    likeComment(id) {
        if (!this.currentUser) return; // Usuario debe estar logueado

        // Crear key única para el par usuario-comentario
        const likeKey = `${this.currentUser}-${id}`;

        // Verificar si el usuario ya dio like
        if (this.userLikes[likeKey]) {
            return; // Ya dio like, no hacer nada
        }

        const comment = this.comments.find(c => c.id === id);
        if (comment) {
            comment.likes++;
            this.userLikes[likeKey] = true; // Registrar el like
            this.saveToLocalStorage();
            this.saveUserLikes();
            this.renderComments();
        }
    }

    deleteComment(id) {
        // Verificar que el usuario esté logueado y sea el autor del comentario
        if (!this.currentUser) return;

        const comment = this.comments.find(c => c.id === id);
        if (comment && comment.user === this.currentUser) {
            // Filtrar el comentario a eliminar
            this.comments = this.comments.filter(c => c.id !== id);
            
            // Eliminar los likes asociados a este comentario
            Object.keys(this.userLikes).forEach(key => {
                if (key.includes(`-${id}`)) {
                    delete this.userLikes[key];
                }
            });

            // Guardar cambios y actualizar UI
            this.saveToLocalStorage();
            this.saveUserLikes();
            this.renderComments();
        }
    }

    loadAllComments() {
        try {
            // Cargar comentarios del almacenamiento local
            const savedComments = localStorage.getItem('comments');
            return savedComments ? JSON.parse(savedComments) : [];
        } catch (error) {
            console.error('Error al cargar comentarios:', error);
            return [];
        }
    }

    loadFromLocalStorage() {
        try {
            const savedComments = localStorage.getItem('comments');
            if (savedComments) {
                const newComments = JSON.parse(savedComments);
                
                // Verificar si hay cambios antes de actualizar
                if (JSON.stringify(this.comments) !== JSON.stringify(newComments)) {
                    this.comments = newComments;
                    return true; // Hubo cambios
                }
            }
            return false; // No hubo cambios
        } catch (error) {
            console.error('Error al cargar comentarios:', error);
            return false;
        }
    }

    saveToLocalStorage() {
        try {
            const timestamp = Date.now();
            const data = {
                comments: this.comments,
                timestamp: timestamp,
                deviceId: this.getDeviceId()
            };

            localStorage.setItem('comments', JSON.stringify(data));
            localStorage.setItem('lastSync', timestamp.toString());

            // Notificar a otros dispositivos
            this.broadcastUpdate(data);
        } catch (error) {
            console.error('Error al guardar comentarios:', error);
        }
    }

    getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    broadcastUpdate(data) {
        // Crear evento personalizado para otros dispositivos
        const event = new CustomEvent('commentsUpdated', { detail: data });
        window.dispatchEvent(event);
    }

    handleStorageError() {
        // Intentar recuperar de backups
        try {
            const backup = localStorage.getItem('comments_backup');
            const tempBackup = sessionStorage.getItem('comments_temp');
            
            if (backup) {
                this.comments = JSON.parse(backup);
            } else if (tempBackup) {
                this.comments = JSON.parse(tempBackup);
            } else {
                this.cleanOldComments();
            }
            
            this.renderComments();
        } catch (error) {
            console.error('Error en recuperación:', error);
        }
    }

    setupBackup() {
        // Hacer backup cada 5 minutos
        setInterval(() => {
            try {
                const timestamp = new Date().toISOString();
                localStorage.setItem(`comments_backup_${timestamp}`, 
                    JSON.stringify(this.comments));
                
                // Mantener solo los últimos 5 backups
                this.cleanOldBackups();
            } catch (error) {
                console.error('Error en backup:', error);
            }
        }, 5 * 60 * 1000);
    }

    cleanOldBackups() {
        const backupKeys = Object.keys(localStorage)
            .filter(key => key.startsWith('comments_backup_'))
            .sort()
            .reverse();

        // Mantener solo los últimos 5 backups
        while (backupKeys.length > 5) {
            localStorage.removeItem(backupKeys.pop());
        }
    }

    notifyOtherTabs() {
        const event = new StorageEvent('storage', {
            key: 'comments',
            newValue: JSON.stringify(this.comments),
            url: window.location.href
        });
        window.dispatchEvent(event);
    }

    paginateComments() {
        const commentsPerPage = 100;
        const pages = Math.ceil(this.comments.length / commentsPerPage);
        
        for (let i = 0; i < pages; i++) {
            const pageComments = this.comments.slice(
                i * commentsPerPage, 
                (i + 1) * commentsPerPage
            );
            localStorage.setItem(
                `comments_page_${i}`, 
                JSON.stringify(pageComments)
            );
        }
    }

    cleanOldComments() {
        // Mantener solo los comentarios más recientes si se excede el almacenamiento
        this.comments = this.comments.slice(0, this.maxComments);
        this.saveToLocalStorage();
    }

    loadUserLikes() {
        const savedLikes = localStorage.getItem('userLikes');
        return savedLikes ? JSON.parse(savedLikes) : {};
    }

    saveUserLikes() {
        localStorage.setItem('userLikes', JSON.stringify(this.userLikes));
    }

    updateUI(isLoggedIn) {
        // Sección de login
        document.getElementById('loginSection').style.display = isLoggedIn ? 'none' : 'block';
        
        // Sección de comentarios (formulario)
        document.getElementById('commentSection').style.display = isLoggedIn ? 'block' : 'none';
        
        // Actualizar nombre de usuario si está logueado
        if (isLoggedIn) {
            document.getElementById('userDisplay').textContent = `Usuario: ${this.currentUser}`;
        }

        // Asegurar que la lista de comentarios siempre esté visible
        const commentsList = document.getElementById('commentsList');
        if (commentsList) {
            commentsList.style.display = 'block';
            commentsList.style.marginTop = '20px';
        }
    }
}

// Inicializar el sistema de comentarios
const commentSystem = new CommentSystem();

// Escuchar cambios en localStorage de otras pestañas
window.addEventListener('storage', (event) => {
    if (event.key === 'comments') {
        commentSystem.loadFromLocalStorage();
        commentSystem.renderComments();
    }
});