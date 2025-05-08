// 初始化 GUN
const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);

// 遊戲狀態
const gameState = {
    currentDrawer: null,
    currentWord: '',
    isDrawing: false,
    players: new Map(),
    userId: Math.random().toString(36).substring(2),
    username: '玩家' + Math.floor(Math.random() * 1000)
};

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

// 畫布設定
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// 初始化畫布大小
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = 400;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 畫布事件監聽
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

function startDrawing(e) {
    if (gameState.currentDrawer !== gameState.userId) return;
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

function draw(e) {
    if (!isDrawing || gameState.currentDrawer !== gameState.userId) return;
    
    const drawData = {
        x0: lastX,
        y0: lastY,
        x1: e.offsetX,
        y1: e.offsetY,
        color: colorPicker.value,
        size: brushSize.value
    };

    drawLine(drawData);
    gun.get('draw').put(drawData);
    
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

function drawLine(data) {
    ctx.beginPath();
    ctx.moveTo(data.x0, data.y0);
    ctx.lineTo(data.x1, data.y1);
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
}

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