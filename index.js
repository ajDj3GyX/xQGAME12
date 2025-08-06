document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const ABLY_API_KEY = 'nc5NGw.wSmsXg:SMs5pD5aJ4hGMvNZnd7pJp2lYS2X1iCmWm_yeLx_pkk';
    const ABLY_CHANNEL_PREFIX = 'xiangqi';

    // DOM Elements
    const ui = {
        roomCodeInput: document.getElementById('room-code-input'),
        joinRoomBtn: document.getElementById('join-room-btn'),
        createRoomBtn: document.getElementById('create-room-btn'),
        notificationContainer: document.getElementById('notification-container')
    };

    let ably = null;

    // Initialize Ably connection
    const getAblyInstance = () => {
        return new Promise((resolve, reject) => {
            if (ably && ably.connection.state === 'connected') {
                return resolve(ably);
            }
            
            const clientId = 'user-' + Date.now() + Math.random().toString(36).substring(2);
            ably = new Ably.Realtime({ key: ABLY_API_KEY, clientId: clientId });

            ably.connection.once('connected', () => resolve(ably));
            ably.connection.once('failed', (error) => {
                console.error('Ably connection failed:', error);
                reject(new Error(`Ably连接失败: ${error.reason?.message || '未知错误'}`));
            });
        });
    };

    // Show notification
    const showNotification = (message, type = 'error', duration = 5000) => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i>
            <span>${message}</span>
        `;

        ui.notificationContainer.innerHTML = '';
        ui.notificationContainer.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    };

    // Set button loading state
    const setLoadingState = (button, isLoading, loadingText) => {
        button.disabled = isLoading;
        const originalText = button.dataset.originalText || button.innerHTML;
        
        if (!button.dataset.originalText) {
            button.dataset.originalText = originalText;
        }

        if (isLoading) {
            button.innerHTML = `<div class="spinner"></div> ${loadingText || ''}`;
        } else {
            button.innerHTML = button.dataset.originalText;
        }
    };

    // Create new room
    const createRoom = async () => {
        setLoadingState(ui.createRoomBtn, true, '创建中...');
        
        try {
            await getAblyInstance();
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const playerColor = Math.random() > 0.5 ? 'red' : 'black';
            
            // Store game data in localStorage
            localStorage.setItem('xiangqi_clientId', ably.auth.clientId);
            localStorage.setItem('xiangqi_color', playerColor);
            
            showNotification(`房间创建成功！房间号: <strong>${roomCode}</strong>`, 'success');
            
            // Redirect to game page
            setTimeout(() => {
                window.location.href = `game.html?room=${roomCode}`;
            }, 1500);
            
        } catch (error) {
            console.error('Failed to create room:', error);
            showNotification('创建房间失败: ' + error.message);
            setLoadingState(ui.createRoomBtn, false, '<i class="fa-solid fa-plus"></i> 创建新房间');
        }
    };

    // Join existing room
    const joinRoom = async () => {
        const roomCode = ui.roomCodeInput.value.trim().toUpperCase();
        
        if (!roomCode || roomCode.length !== 6) {
            showNotification('请输入有效的6位房间码');
            return;
        }
        
        setLoadingState(ui.joinRoomBtn, true, '加入中...');
        
        try {
            const rt = await getAblyInstance();
            const channel = rt.channels.get(`${ABLY_CHANNEL_PREFIX}:${roomCode}`);
            const presence = await channel.presence.get();
            
            // Check if room exists and has space
            if (!presence || !Array.isArray(presence)) {
                throw new Error('无法获取房间信息');
            }
            
            // Generate player color based on existing players
            let playerColor;
            if (presence.length === 0) {
                playerColor = 'red';
            } else if (presence.length === 1) {
                const existingPlayer = presence[0].data?.color || 'red';
                playerColor = existingPlayer === 'red' ? 'black' : 'red';
            } else {
                showNotification('房间已满，无法加入');
                setLoadingState(ui.joinRoomBtn, false, '<i class="fa-solid fa-right-to-bracket"></i> 加入房间');
                return;
            }
            
            // Store game data in localStorage
            localStorage.setItem('xiangqi_clientId', rt.auth.clientId);
            localStorage.setItem('xiangqi_color', playerColor);
            
            showNotification('加入成功，正在进入游戏...', 'success');
            
            // Redirect to game page
            setTimeout(() => {
                window.location.href = `game.html?room=${roomCode}`;
            }, 1000);
            
        } catch (error) {
            console.error('Failed to join room:', error);
            showNotification('加入房间失败: ' + (error.message || '请检查网络连接'));
            setLoadingState(ui.joinRoomBtn, false, '<i class="fa-solid fa-right-to-bracket"></i> 加入房间');
        }
    };

    // Event listeners
    ui.createRoomBtn.addEventListener('click', createRoom);
    ui.joinRoomBtn.addEventListener('click', joinRoom);
    
    ui.roomCodeInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            joinRoom();
        }
    });
    
    // Add particles effect
    const particlesContainer = document.querySelector('.particles-container');
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.animationDuration = `${Math.random() * 10 + 10}s`;
        particle.style.animationDelay = `${Math.random() * 5}s`;
        particle.style.opacity = Math.random() * 0.5 + 0.3;
        particlesContainer.appendChild(particle);
    }

    // Add input focus effects
    ui.roomCodeInput.addEventListener('focus', () => {
        ui.roomCodeInput.parentElement.style.transform = 'scale(1.02)';
    });
    
    ui.roomCodeInput.addEventListener('blur', () => {
        ui.roomCodeInput.parentElement.style.transform = 'scale(1)';
    });
});
