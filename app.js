// 初始化 GUN（增加更多備用伺服器）
const gun = Gun(['https://gun-manhattan.herokuapp.com/gun', 'https://gun-us.herokuapp.com/gun']);

// 遊戲狀態
const gameState = {
    currentDrawer: null,
    currentWord: '',
    isDrawing: false,
    players: new Map(),
    userId: Math.random().toString(36).substring(2),
    username: '玩家' + Math.floor(Math.random() * 1000)
};

// 確保遊戲狀態初始化
gun.get('gameState').on(function(data) {
    if (!data) {
        gun.get('gameState').put({
            currentDrawer: gameState.userId,
            currentWord: words[Math.floor(Math.random() * words.length)]
        });
    } else {
        gameState.currentDrawer = data.currentDrawer;
        gameState.currentWord = data.currentWord;
        updateGameInfo();
    }
});

// DOM 元素
const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const clearBtn = document.getElementById('clearBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const playerList = document.getElementById('playerList');
const gameInfo = document.getElementById('gameInfo');

// 初始化畫布
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// 畫布設定
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// 初始化畫布大小
function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    canvas.style.width = '100%';
    canvas.style.height = '400px';
    canvas.width = rect.width;
    canvas.height = 400;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

// 確保畫布大小正確
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// 更新遊戲資訊和畫布狀態
function updateGameInfo() {
    if (gameState.currentDrawer === gameState.userId) {
        gameInfo.textContent = `輪到你畫畫了！題目是：${gameState.currentWord}`;
        enableDrawing();
    } else {
        gameInfo.textContent = `輪到 ${gameState.players.get(gameState.currentDrawer)?.username || '其他玩家'} 畫畫了！`;
        disableDrawing();
    }
}

// 啟用繪圖功能
function enableDrawing() {
    canvas.style.cursor = 'crosshair';
    canvas.style.pointerEvents = 'auto';
}

// 停用繪圖功能
function disableDrawing() {
    canvas.style.cursor = 'not-allowed';
    canvas.style.pointerEvents = 'none';
}

// 計算正確的繪圖座標
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: ((e.clientX || (e.touches && e.touches[0].clientX)) - rect.left) * scaleX,
        y: ((e.clientY || (e.touches && e.touches[0].clientY)) - rect.top) * scaleY
    };
}

// 畫布事件處理
function startDrawing(e) {
    e.preventDefault();
    if (gameState.currentDrawer !== gameState.userId) return;
    
    isDrawing = true;
    const pos = getMousePos(e);
    lastX = pos.x;
    lastY = pos.y;
}

function draw(e) {
    e.preventDefault();
    if (!isDrawing || gameState.currentDrawer !== gameState.userId) return;
    
    const pos = getMousePos(e);
    const drawData = {
        x0: lastX,
        y0: lastY,
        x1: pos.x,
        y1: pos.y,
        color: colorPicker.value,
        size: brushSize.value
    };

    drawLine(drawData);
    gun.get('draw').put(drawData);
    
    lastX = pos.x;
    lastY = pos.y;
}

function stopDrawing(e) {
    if (e) e.preventDefault();
    isDrawing = false;
}

// 重新綁定事件監聽器
canvas.addEventListener('mousedown', startDrawing, false);
canvas.addEventListener('mousemove', draw, false);
canvas.addEventListener('mouseup', stopDrawing, false);
canvas.addEventListener('mouseout', stopDrawing, false);

// 觸控事件
canvas.addEventListener('touchstart', startDrawing, false);
canvas.addEventListener('touchmove', draw, false);
canvas.addEventListener('touchend', stopDrawing, false);
canvas.addEventListener('touchcancel', stopDrawing, false);

// 清除畫布
clearBtn.addEventListener('click', () => {
    if (gameState.currentDrawer !== gameState.userId) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    gun.get('draw').put({clear: true});
});

// 聊天功能
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    gun.get('chat').set({
        userId: gameState.userId,
        username: gameState.username,
        message,
        timestamp: Date.now()
    });

    messageInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// 監聽繪圖更新
gun.get('draw').on(data => {
    if (!data) return;
    if (data.clear) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
        drawLine(data);
    }
});

// 監聽聊天訊息
gun.get('chat').map().once(data => {
    if (!data || !data.message) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'p-2 rounded ' + 
        (data.userId === gameState.userId ? 'bg-blue-100' : 'bg-gray-100');
    messageDiv.innerHTML = `
        <span class="font-bold">${data.username}:</span>
        <span>${data.message}</span>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 檢查是否猜中答案
    if (data.userId !== gameState.currentDrawer && 
        data.message.toLowerCase() === gameState.currentWord.toLowerCase()) {
        alert(`${data.username} 猜對了！答案是 ${gameState.currentWord}`);
        startNewRound();
    }
});

// 玩家管理
gun.get('players').set({
    userId: gameState.userId,
    username: gameState.username,
    timestamp: Date.now()
});

gun.get('players').map().on(data => {
    if (!data) return;
    gameState.players.set(data.userId, data);
    updatePlayerList();
});

function updatePlayerList() {
    playerList.innerHTML = '';
    gameState.players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'p-2 rounded ' + 
            (player.userId === gameState.currentDrawer ? 'bg-yellow-200' : 'bg-gray-100');
        playerDiv.textContent = player.username;
        playerList.appendChild(playerDiv);
    });
}

// 遊戲邏輯
const words = ['貓', '狗', '房子', '太陽', '月亮', '樹', '花', '魚', '鳥', '汽車', 
               '飛機', '書', '電腦', '手機', '眼鏡', '鉛筆', '雨傘', '時鐘', '椅子', '桌子'];

function startNewRound() {
    const players = Array.from(gameState.players.keys());
    const nextDrawerIndex = players.indexOf(gameState.currentDrawer) + 1;
    gameState.currentDrawer = players[nextDrawerIndex] || players[0];
    gameState.currentWord = words[Math.floor(Math.random() * words.length)];
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    gun.get('draw').put({clear: true});
    
    if (gameState.currentDrawer === gameState.userId) {
        gameInfo.textContent = `輪到你畫畫了！題目是：${gameState.currentWord}`;
    } else {
        gameInfo.textContent = `輪到 ${gameState.players.get(gameState.currentDrawer).username} 畫畫了！`;
    }
    
    updatePlayerList();
}

// 當玩家加入時，如果是第一個玩家，就開始新的回合
if (gameState.players.size === 0) {
    setTimeout(() => {
        if (gameState.players.size > 0 && !gameState.currentDrawer) {
            startNewRound();
        }
    }, 1000);
}

// 在畫布初始化時設定游標
resizeCanvas();
updateGameInfo();