document.addEventListener('DOMContentLoaded', () => {
    // Core Configuration & Constants
    const ABLY_API_KEY = 'nc5NGw.wSmsXg:SMs5pD5aJ4hGMvNZnd7pJp2lYS2X1iCmWm_yeLx_pkk';
    const BOARD_COLS = 9;
    const BOARD_ROWS = 10;
    
    // Piece definitions
    const PIECE_DATA = {
        r_g: { text: '帅', color: 'red', type: 'general'  }, r_a: { text: '仕', color: 'red', type: 'advisor'  },
        r_e: { text: '相', color: 'red', type: 'elephant' }, r_h: { text: '傌', color: 'red', type: 'horse'    },
        r_c: { text: '俥', color: 'red', type: 'chariot'  }, r_p: { text: '炮', color: 'red', type: 'cannon'   },
        r_s: { text: '兵', color: 'red', type: 'soldier'  },
        b_g: { text: '将', color: 'black', type: 'general'  }, b_a: { text: '士', color: 'black', type: 'advisor'  },
        b_e: { text: '象', color: 'black', type: 'elephant' }, b_h: { text: '馬', color: 'black', type: 'horse'    },
        b_c: { text: '車', color: 'black', type: 'chariot'  }, b_p: { text: '砲', color: 'black', type: 'cannon'   },
        b_s: { text: '卒', color: 'black', type: 'soldier'  },
    };

    // Initial board layout
    const INITIAL_LAYOUT = {
        0: { 0: 'r_c', 1: 'r_h', 2: 'r_e', 3: 'r_a', 4: 'r_g', 5: 'r_a', 6: 'r_e', 7: 'r_h', 8: 'r_c' },
        2: { 1: 'r_p', 7: 'r_p' },
        3: { 0: 'r_s', 2: 'r_s', 4: 'r_s', 6: 'r_s', 8: 'r_s' },
        6: { 0: 'b_s', 2: 'b_s', 4: 'b_s', 6: 'b_s', 8: 'b_s' },
        7: { 1: 'b_p', 7: 'b_p' },
        9: { 0: 'b_c', 1: 'b_h', 2: 'b_e', 3: 'b_a', 4: 'b_g', 5: 'b_a', 6: 'b_e', 7: 'b_h', 8: 'b_c' },
    };

    // GameState Class
    class GameState {
        constructor(playerColor) {
            this.playerColor = playerColor;
            this.board = this.createInitialBoard();
            this.currentTurn = 'red';
            this.gameActive = true;
            this.selectedPiece = null;
            this.moveHistory = [];
            this.opponentConnected = false;
        }

        createInitialBoard() {
            const board = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));
            for (const y in INITIAL_LAYOUT) {
                for (const x in INITIAL_LAYOUT[y]) {
                    board[y][x] = INITIAL_LAYOUT[y][x];
                }
            }
            return board;
        }

        getPiece(x, y) { return this.board[y]?.[x]; }
        isMyTurn() { return this.gameActive && this.currentTurn === this.playerColor && this.opponentConnected; }

        movePiece(from, to) {
            const movedPieceId = this.getPiece(from.x, from.y);
            const capturedPieceId = this.getPiece(to.x, to.y);
            
            this.moveHistory.push({ from, to, movedPieceId, capturedPieceId });
            
            this.board[to.y][to.x] = movedPieceId;
            this.board[from.y][from.x] = null;
            this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
            
            return { movedPieceId, capturedPieceId };
        }
        
        undoLastMove() {
            if (this.moveHistory.length === 0) return;
            const lastMove = this.moveHistory.pop();
            const { from, to, movedPieceId, capturedPieceId } = lastMove;
            
            this.board[from.y][from.x] = movedPieceId;
            this.board[to.y][to.x] = capturedPieceId;
            
            this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
        }
    }

    // GameLogic Class
    class GameLogic {
        static _isPseudoLegalMove(board, from, to) {
            const pieceId = board[from.y]?.[from.x];
            if (!pieceId) return false;
            const piece = PIECE_DATA[pieceId];
            const targetPieceId = board[to.y]?.[to.x];
            const targetPiece = targetPieceId ? PIECE_DATA[targetPieceId] : null;

            if (targetPiece && targetPiece.color === piece.color) return false;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            switch (piece.type) {
                case 'general':
                    if (to.x < 3 || to.x > 5 || (piece.color === 'red' ? (to.y < 7 || to.y > 9) : (to.y < 0 || to.y > 2))) return false;
                    if (targetPiece?.type === 'general') {
                        if (from.x !== to.x) return false;
                        return this.countPiecesOnPath(board, from, to) === 0;
                    }
                    return absDx + absDy === 1;
                case 'advisor':
                    if (to.x < 3 || to.x > 5 || (piece.color === 'red' ? (to.y < 7 || to.y > 9) : (to.y < 0 || to.y > 2))) return false;
                    return absDx === 1 && absDy === 1;
                case 'elephant':
                    if (piece.color === 'red' ? to.y < 5 : to.y > 4) return false;
                    if (absDx !== 2 || absDy !== 2) return false;
                    return !board[from.y + dy / 2][from.x + dx / 2];
                case 'horse':
                    if (!((absDx === 1 && absDy === 2) || (absDx === 2 && absDy === 1))) return false;
                    const blockX = from.x + (absDx === 2 ? Math.sign(dx) : 0);
                    const blockY = from.y + (absDy === 2 ? Math.sign(dy) : 0);
                    return !board[blockY]?.[blockX];
                case 'chariot':
                    if (dx !== 0 && dy !== 0) return false;
                    return this.countPiecesOnPath(board, from, to) === 0;
                case 'cannon':
                    if (dx !== 0 && dy !== 0) return false;
                    const pathPieces = this.countPiecesOnPath(board, from, to);
                    return targetPiece ? pathPieces === 1 : pathPieces === 0;
                case 'soldier':
                    const forward = piece.color === 'red' ? -1 : 1;
                    if (dy === forward && dx === 0) return true;
                    const hasCrossedRiver = piece.color === 'red' ? from.y < 5 : from.y > 4;
                    return hasCrossedRiver && dy === 0 && absDx === 1;
            }
            return false;
        }

        static countPiecesOnPath(board, from, to) {
            let count = 0;
            if (from.x === to.x) {
                for (let y = Math.min(from.y, to.y) + 1; y < Math.max(from.y, to.y); y++) if (board[y]?.[from.x]) count++;
            } else if (from.y === to.y) {
                for (let x = Math.min(from.x, to.x) + 1; x < Math.max(from.x, to.x); x++) if (board[from.y]?.[x]) count++;
            }
            return count;
        }

        static findKing(board, color) {
            const kingId = color === 'red' ? 'r_g' : 'b_g';
            for (let y = 0; y < BOARD_ROWS; y++) {
                for (let x = 0; x < BOARD_COLS; x++) {
                    if (board[y][x] === kingId) return { x, y };
                }
            }
            return null;
        }
        
        static isKingInCheck(board, kingColor) {
            const kingPos = this.findKing(board, kingColor);
            if (!kingPos) return true;
            const opponentColor = kingColor === 'red' ? 'black' : 'red';
            for (let y = 0; y < BOARD_ROWS; y++) {
                for (let x = 0; x < BOARD_COLS; x++) {
                    const pieceId = board[y][x];
                    if (pieceId && PIECE_DATA[pieceId].color === opponentColor) {
                        if (this._isPseudoLegalMove(board, { x, y }, kingPos)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        static getValidMoves(board, fromX, fromY) {
            const pieceId = board[fromY]?.[fromX];
            if (!pieceId) return [];
            const pieceColor = PIECE_DATA[pieceId].color;
            const validMoves = [];

            for (let y = 0; y < BOARD_ROWS; y++) {
                for (let x = 0; x < BOARD_COLS; x++) {
                    if (this._isPseudoLegalMove(board, { x: fromX, y: fromY }, { x, y })) {
                        const tempBoard = JSON.parse(JSON.stringify(board));
                        tempBoard[y][x] = tempBoard[fromY][fromX];
                        tempBoard[fromY][fromX] = null;
                        if (!this.isKingInCheck(tempBoard, pieceColor)) {
                            validMoves.push({ x, y });
                        }
                    }
                }
            }
            return validMoves;
        }
        
        static getAllLegalMovesForPlayer(board, color) {
            let allMoves = [];
            for (let y = 0; y < BOARD_ROWS; y++) {
                for (let x = 0; x < BOARD_COLS; x++) {
                    const pieceId = board[y][x];
                    if (pieceId && PIECE_DATA[pieceId].color === color) {
                        const moves = this.getValidMoves(board, x, y);
                        if (moves.length > 0) allMoves.push(...moves);
                    }
                }
            }
            return allMoves;
        }

        static checkGameEndCondition(board, turnColor) {
            const hasLegalMoves = this.getAllLegalMovesForPlayer(board, turnColor).length > 0;
            const inCheck = this.isKingInCheck(board, turnColor);
            const opponentColor = turnColor === 'red' ? 'black' : 'red';

            if (!hasLegalMoves) {
                if (inCheck) {
                    return { over: true, winner: opponentColor, reason: "Checkmate" };
                } else {
                    return { over: true, winner: 'draw', reason: "Stalemate" };
                }
            }
            
            return { over: false };
        }
    }
    
    // UIRenderer Class
    class UIRenderer {
        constructor(onCellClick) {
            this.elements = {
                board: document.getElementById('board'),
                roomCodeDisplay: document.getElementById('roomCodeDisplay'),
                gameStatus: document.getElementById('gameStatus'),
                undoBtn: document.getElementById('undoBtn'),
                surrenderBtn: document.getElementById('surrenderBtn'),
                modal: document.getElementById('game-modal'),
                playerRedTag: document.getElementById('player-red-indicator'),
                playerBlackTag: document.getElementById('player-black-indicator'),
            };
            this.onCellClick = onCellClick;
            this.pieceElements = {};
        }
        
        initialize(roomCode, playerColor) {
            this.elements.roomCodeDisplay.textContent = roomCode;
            this.elements.playerRedTag.classList.toggle('is-self', playerColor === 'red');
            this.elements.playerBlackTag.classList.toggle('is-self', playerColor === 'black');
        }

        renderBoard(board) {
            this.elements.board.innerHTML = '';
            this.pieceElements = {};
            
            for (let y = 0; y < BOARD_ROWS; y++) {
                for (let x = 0; x < BOARD_COLS; x++) {
                    const cell = document.createElement('div');
                    cell.className = 'board-cell';
                    cell.style.left = `${(x / (BOARD_COLS - 1)) * 100}%`;
                    cell.style.top = `${(y / (BOARD_ROWS - 1)) * 100}%`;
                    cell.dataset.x = x;
                    cell.dataset.y = y;
                    cell.addEventListener('click', () => this.onCellClick(x, y));
                    this.elements.board.appendChild(cell);

                    const pieceId = board[y][x];
                    if (pieceId) this.createPieceElement(pieceId, x, y);
                }
            }
        }
        
        createPieceElement(pieceId, x, y) {
            const pData = PIECE_DATA[pieceId];
            const pieceEl = document.createElement('div');
            pieceEl.className = `piece ${pData.color}`;
            pieceEl.textContent = pData.text;
            pieceEl.dataset.piece = pieceId;
            pieceEl.style.left = `${(x / (BOARD_COLS - 1)) * 100}%`;
            pieceEl.style.top = `${(y / (BOARD_ROWS - 1)) * 100}%`;
            
            this.elements.board.appendChild(pieceEl);
            this.pieceElements[`${x},${y}`] = pieceEl;
        }

        animateMove(from, to, capturedPieceId) {
            const movingPieceEl = this.pieceElements[`${from.x},${from.y}`];
            if (!movingPieceEl) return;

            movingPieceEl.classList.add('moving');
            movingPieceEl.style.zIndex = 100;
            movingPieceEl.style.left = `${(to.x / (BOARD_COLS - 1)) * 100}%`;
            movingPieceEl.style.top = `${(to.y / (BOARD_ROWS - 1)) * 100}%`;

            const handleTransitionEnd = () => {
                movingPieceEl.removeEventListener('transitionend', handleTransitionEnd);
                movingPieceEl.classList.remove('moving');
                movingPieceEl.style.zIndex = 20;

                if (capturedPieceId) {
                    const capturedEl = this.pieceElements[`${to.x},${to.y}`];
                    if (capturedEl) {
                        capturedEl.classList.add('captured');
                        setTimeout(() => capturedEl.remove(), 300);
                    }
                }
                
                delete this.pieceElements[`${from.x},${from.y}`];
                this.pieceElements[`${to.x},${to.y}`] = movingPieceEl;
                
                this.clearHighlights();
                this.highlightLastMove(from, to);
            };
            movingPieceEl.addEventListener('transitionend', handleTransitionEnd);
        }

        updateStatus(text, type = 'info') {
            const statusEl = this.elements.gameStatus;
            statusEl.innerHTML = `<span>${text}</span>`;
            statusEl.className = 'game-status';
            
            if (type === 'red' || type === 'black') {
                statusEl.classList.add('active');
                statusEl.classList.add(type);
            } else {
                statusEl.classList.remove('active');
            }
            
            this.elements.playerRedTag.classList.toggle('active', type === 'red');
            this.elements.playerBlackTag.classList.toggle('active', type === 'black');
        }
        
        updateButtonStates(gameState) {
            this.elements.undoBtn.disabled = !gameState.isMyTurn() || gameState.moveHistory.length < 1;
            this.elements.surrenderBtn.disabled = !gameState.gameActive;
        }
        
        clearHighlights() {
            document.querySelectorAll('.selected, .move-indicator, .last-move-highlight').forEach(el => el.remove());
        }

        highlightSelected(x, y) {
            this.clearHighlights();
            const pieceEl = this.pieceElements[`${x},${y}`];
            if (pieceEl) pieceEl.classList.add('selected');
        }

        highlightValidMoves(moves) {
            moves.forEach(move => {
                const indicator = document.createElement('div');
                indicator.className = 'move-indicator';
                if (this.pieceElements[`${move.x},${move.y}`]) {
                    indicator.classList.add('capture');
                }
                indicator.style.left = `${(move.x / (BOARD_COLS - 1)) * 100}%`;
                indicator.style.top = `${(move.y / (BOARD_ROWS - 1)) * 100}%`;
                this.elements.board.appendChild(indicator);
            });
        }

        highlightLastMove(from, to) {
            [from, to].forEach(pos => {
                const highlight = document.createElement('div');
                highlight.className = 'last-move-highlight';
                highlight.style.left = `${(pos.x / (BOARD_COLS - 1)) * 100}%`;
                highlight.style.top = `${(pos.y / (BOARD_ROWS - 1)) * 100}%`;
                this.elements.board.appendChild(highlight);
            });
        }
        
        showModal({ title, content, buttons }) {
            const modal = this.elements.modal;
            modal.querySelector('#modal-title').textContent = title;
            modal.querySelector('#modal-text').innerHTML = content;
            
            // Set icon based on result
            const icon = modal.querySelector('#modal-icon');
            if (title.includes('赢')) {
                icon.className = 'fa-solid fa-trophy';
            } else if (title.includes('输')) {
                icon.className = 'fa-solid fa-face-sad-tear';
            } else if (title.includes('和')) {
                icon.className = 'fa-solid fa-handshake';
            } else {
                icon.className = 'fa-solid fa-circle-info';
            }
            
            const actionsContainer = modal.querySelector('.modal-actions');
            actionsContainer.innerHTML = '';
            
            buttons.forEach(btn => {
                const buttonEl = document.createElement('button');
                buttonEl.id = btn.id;
                buttonEl.textContent = btn.text;
                buttonEl.className = btn.class;
                buttonEl.addEventListener('click', () => {
                    btn.callback();
                    this.hideModal(); 
                }, { once: true });
                actionsContainer.appendChild(buttonEl);
            });
            
            if (!modal.open) modal.showModal();
        }
        
        hideModal() { this.elements.modal.close(); }
    }

    // NetworkController Class
    class NetworkController {
        constructor(roomId, clientId, onMessage, onPresenceUpdate) {
            try {
                this.ably = new Ably.Realtime({ key: ABLY_API_KEY, clientId: clientId, recover: (lcd, cb) => cb(true) });
                this.channel = this.ably.channels.get(`xiangqi:${roomId}`);
                this.onMessage = onMessage;
                this.onPresenceUpdate = onPresenceUpdate;

                this.ably.connection.on('connected', () => console.log('✅ Ably connection established.'));
                this.ably.connection.on('failed', (err) => {
                    console.error('Ably connection failed.', err.reason);
                    alert("无法连接到实时服务器，请刷新页面重试。");
                });
            } catch (error) {
                console.error("Failed to initialize Ably:", error);
                alert("无法连接到实时服务。请检查您的网络连接并刷新。");
            }
        }
        
        subscribeToEvents() {
            this.channel.subscribe(msg => this.onMessage(msg.name, msg.data));
            this.channel.presence.subscribe(['enter', 'leave'], () => this.onPresenceUpdate());
            this.onPresenceUpdate();
        }
        
        async enterPresence(playerColor) {
            await this.channel.presence.enter({ color: playerColor });
        }
        
        publish(name, data) { this.channel.publish(name, data); }
        async getPresence() { return await this.channel.presence.get(); }
    }

    // GameController Class
    class GameController {
        constructor() {
            const urlParams = new URLSearchParams(window.location.search);
            this.roomId = urlParams.get('room');
            this.playerColor = localStorage.getItem('xiangqi_color');
            this.clientId = localStorage.getItem('xiangqi_clientId');
            
            if (!this.roomId || !this.playerColor || !this.clientId) {
                alert("游戏信息缺失，正在返回大厅。");
                window.location.href = 'index.html';
                return;
            }

            this.gameState = new GameState(this.playerColor);
            this.ui = new UIRenderer(this.handleCellClick.bind(this));
            this.network = new NetworkController(
                this.roomId,
                this.clientId,
                this.handleNetworkMessage.bind(this),
                this.handlePresenceUpdate.bind(this)
            );

            this.initializeGame();
        }

        async initializeGame() {
            this.ui.initialize(this.roomId, this.gameState.playerColor);
            this.ui.renderBoard(this.gameState.board);
            await this.network.enterPresence(this.gameState.playerColor);
            this.network.subscribeToEvents();
            this.addEventListeners();
            this.updateGameStatusUI();
        }
        
        addEventListeners() {
            this.ui.elements.undoBtn.addEventListener('click', () => this.requestUndo());
            this.ui.elements.surrenderBtn.addEventListener('click', () => this.confirmSurrender());
            document.getElementById('backBtn').addEventListener('click', () => {
                if (confirm('确定要返回大厅吗？当前游戏将会结束。')) {
                    window.location.href = 'index.html';
                }
            });
            document.getElementById('modal-action-secondary').addEventListener('click', () => {
                this.ui.hideModal();
            });
            document.getElementById('modal-action-primary').addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        updateGameStatusUI() {
            if (!this.gameState.gameActive) return;
            
            if (!this.gameState.opponentConnected) {
                this.ui.updateStatus('<i class="fa-solid fa-users"></i> 等待对手连接...');
            } else if (GameLogic.isKingInCheck(this.gameState.board, this.gameState.currentTurn)) {
                this.ui.updateStatus(`<i class="fa-solid fa-exclamation-triangle"></i> ${this.gameState.currentTurn === 'red' ? '红方' : '黑方'}被将军!`, this.gameState.currentTurn);
            } else if (this.gameState.isMyTurn()) {
                this.ui.updateStatus('<i class="fa-solid fa-chess"></i> 轮到你走棋', this.gameState.currentTurn);
            } else {
                this.ui.updateStatus('<i class="fa-solid fa-clock"></i> 等待对方走棋...', this.gameState.currentTurn);
            }
            this.ui.updateButtonStates(this.gameState);
        }
        
        async handlePresenceUpdate() {
            const presence = await this.network.getPresence();
            const wasConnected = this.gameState.opponentConnected;
            this.gameState.opponentConnected = presence.length === 2;
            
            if (!wasConnected && this.gameState.opponentConnected) {
                console.log("对手已连接。");
                this.ui.updateStatus('<i class="fa-solid fa-play"></i> 游戏开始！', 'info');
            } else if (wasConnected && !this.gameState.opponentConnected && this.gameState.gameActive) {
                console.log("对手已断开连接。");
                this.endGame(this.gameState.playerColor, '对手断开连接');
            }
            
            this.updateGameStatusUI();
        }

        handleCellClick(x, y) {
            if (!this.gameState.isMyTurn()) return;
            
            if (this.gameState.selectedPiece) {
                const from = this.gameState.selectedPiece;
                const to = { x, y };
                if (from.x === to.x && from.y === to.y) {
                    this.gameState.selectedPiece = null;
                    this.ui.clearHighlights();
                    return;
                }
                const validMoves = GameLogic.getValidMoves(this.gameState.board, from.x, from.y);
                if (validMoves.some(move => move.x === to.x && move.y === to.y)) {
                    this.performMove(from, to, true);
                } else {
                    this.selectPiece(x, y);
                }
            } else {
                this.selectPiece(x, y);
            }
        }
        
        selectPiece(x, y) {
            const pieceId = this.gameState.getPiece(x, y);
            if (pieceId && PIECE_DATA[pieceId].color === this.gameState.playerColor) {
                this.gameState.selectedPiece = { x, y };
                this.ui.highlightSelected(x, y);
                const validMoves = GameLogic.getValidMoves(this.gameState.board, x, y);
                this.ui.highlightValidMoves(validMoves);
            } else {
                this.gameState.selectedPiece = null;
                this.ui.clearHighlights();
            }
        }

        performMove(from, to, isLocalAction) {
            const { capturedPieceId } = this.gameState.movePiece(from, to);
            this.ui.animateMove(from, to, capturedPieceId);
            this.gameState.selectedPiece = null;
            
            if (isLocalAction) {
                this.network.publish('move', { from, to });
                
                const gameEndState = GameLogic.checkGameEndCondition(this.gameState.board, this.gameState.currentTurn);
                if (gameEndState.over) {
                    this.network.publish('game-over', gameEndState);
                    this.endGame(gameEndState.winner, gameEndState.reason === "Checkmate" ? "绝杀" : "无棋可走（和棋）");
                }
            }
            
            this.updateGameStatusUI();
        }
        
        endGame(winner, reason) {
            if (!this.gameState.gameActive) return;
            this.gameState.gameActive = false;
            
            const isWinner = winner === this.gameState.playerColor;
            const isDraw = winner === 'draw';
            const title = isDraw ? '和棋!' : (isWinner ? '你赢了!' : '你输了');
            
            this.ui.updateStatus(`${title} (${reason})`, isDraw ? 'info' : (isWinner ? 'win' : 'lose'));
            this.ui.updateButtonStates(this.gameState);

            this.ui.showModal({
                title,
                content: `游戏结束。原因: <strong>${reason}</strong>`,
                buttons: [{
                    id: 'modal-back-home',
                    text: '返回大厅',
                    class: 'btn btn-primary',
                    callback: () => window.location.href='index.html'
                }]
            });
        }

        handleNetworkMessage(name, data) {
            if (!this.gameState.gameActive && !['game-over', 'undo:response'].includes(name)) return;

            switch (name) {
                case 'move':
                    this.performMove(data.from, data.to, false);
                    break;
                case 'undo:request':
                    this.handleUndoRequest();
                    break;
                case 'undo:response':
                    this.handleUndoResponse(data.accepted);
                    break;
                case 'game-over':
                    this.endGame(data.winner, data.reason === "Surrender" ? "对方认输" : "对方宣告绝杀");
                    break;
            }
        }
        
        requestUndo() {
            this.ui.elements.undoBtn.disabled = true;
            this.network.publish('undo:request', {});
            this.ui.updateStatus('<i class="fa-solid fa-hourglass-half"></i> 悔棋请求已发送...', 'wait');
        }
        
        handleUndoRequest() {
            this.ui.showModal({
                title: '悔棋请求',
                content: '你的对手请求撤销上一步棋。你同意吗？',
                buttons: [
                    { id: 'reject-undo', text: '拒绝', class: 'btn btn-secondary', callback: () => this.respondToUndo(false) },
                    { id: 'accept-undo', text: '同意', class: 'btn btn-primary', callback: () => this.respondToUndo(true) }
                ]
            });
        }

        respondToUndo(accepted) {
            this.network.publish('undo:response', { accepted });
            if (accepted) {
                this.gameState.undoLastMove();
                this.ui.renderBoard(this.gameState.board); 
                this.updateGameStatusUI();
            }
        }

        handleUndoResponse(accepted) {
            if (accepted) {
                this.ui.updateStatus('<i class="fa-solid fa-check"></i> 对方同意了你的悔棋请求。', 'info');
                this.gameState.undoLastMove();
                this.ui.renderBoard(this.gameState.board);
            } else {
                this.ui.updateStatus('<i class="fa-solid fa-times"></i> 对方拒绝了你的悔棋请求。', 'info');
            }
            this.updateGameStatusUI();
        }
        
        confirmSurrender() {
            this.ui.showModal({
                title: '确认认输',
                content: '你确定要认输吗？此操作将立即结束游戏。',
                buttons: [
                    { id: 'cancel-surrender', text: '取消', class: 'btn btn-secondary', callback: () => {} },
                    { id: 'confirm-surrender', text: '确认认输', class: 'btn btn-danger', callback: () => this.doSurrender() }
                ]
            });
        }
        
        doSurrender() {
            this.ui.hideModal();
            const winner = this.gameState.playerColor === 'red' ? 'black' : 'red';
            const gameOverState = { winner, reason: 'Surrender' };
            this.network.publish('game-over', gameOverState);
            this.endGame(winner, '你认输了');
        }
    }

    // Add particles effect
    const particlesContainer = document.querySelector('.particles-container');
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.animationDuration = `${Math.random() * 10 + 10}s`;
        particle.style.animationDelay = `${Math.random() * 5}s`;
        particlesContainer.appendChild(particle);
    }

    // Initialize Game
    new GameController();
});
