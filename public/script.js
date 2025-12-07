// Telegram WebApp Integration
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setHeaderColor('#1a1a2e');
    tg.setBackgroundColor('#1a1a2e');
}

// Configuration
let boardState = [];
let selectedPiece = null;
let validMoves = [];
let currentPlayer = 'white';
let gameOver = false;
let moveHistory = [];
let gameDifficulty = 'easy';
let gameTime = 600;
let currentUser = null;
let authToken = null;

// API Configuration
const API_BASE_URL = window.location.origin + '/api';

// DOM Elements
const welcomeScreen = document.getElementById('welcomeScreen');
const loginScreen = document.getElementById('loginScreen');
const signupScreen = document.getElementById('signupScreen');
const gameScreen = document.getElementById('gameScreen');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('♔ Chess Mini App Initializing...');
    
    // Check authentication
    checkAuth();
    
    // Setup event listeners
    setupEventListeners();
    
    // Create chess board
    createBoard();
    
    // Test API
    testAPIConnection();
});

// Test API connection
async function testAPIConnection() {
    try {
        const response = await fetch(API_BASE_URL + '/health');
        const data = await response.json();
        console.log('✅ API Connected:', data);
    } catch (error) {
        console.error('❌ API Connection failed:', error);
    }
}

// Check authentication
async function checkAuth() {
    console.log('🔐 Checking authentication...');
    
    const token = localStorage.getItem('chess_token');
    const user = localStorage.getItem('chess_user');
    
    if (token && user) {
        try {
            console.log('🔍 Found stored credentials');
            
            const response = await fetch(API_BASE_URL + '/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Authentication valid');
                authToken = token;
                currentUser = data.user;
                showGameScreen();
                setupPieces();
                renderBoard();
                updateUserInfo();
                return;
            }
        } catch (error) {
            console.error('❌ Auth check error:', error);
        }
        
        // Clear invalid credentials
        localStorage.removeItem('chess_token');
        localStorage.removeItem('chess_user');
    }
    
    console.log('👋 No valid session, showing welcome');
    showWelcomeScreen();
}

// Show screens
function showWelcomeScreen() {
    welcomeScreen.style.display = 'block';
    loginScreen.style.display = 'none';
    signupScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    clearErrors();
}

function showLoginScreen() {
    welcomeScreen.style.display = 'none';
    loginScreen.style.display = 'block';
    signupScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    clearErrors();
}

function showSignupScreen() {
    welcomeScreen.style.display = 'none';
    loginScreen.style.display = 'none';
    signupScreen.style.display = 'block';
    gameScreen.style.display = 'none';
    clearErrors();
}

function showGameScreen() {
    welcomeScreen.style.display = 'none';
    loginScreen.style.display = 'none';
    signupScreen.style.display = 'none';
    gameScreen.style.display = 'block';
}

// Clear form errors
function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });
}

// Show error message
function showError(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        element.style.color = type === 'error' ? '#ff6b6b' : '#7fa650';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Welcome screen
    document.getElementById('playNowBtn').addEventListener('click', showLoginScreen);
    
    // Auth navigation
    document.getElementById('goToSignup').addEventListener('click', (e) => {
        e.preventDefault();
        showSignupScreen();
    });
    
    document.getElementById('goToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginScreen();
    });
    
    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await login(
            document.getElementById('loginEmail').value.trim(),
            document.getElementById('loginPassword').value
        );
    });
    
    // Signup form
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await signup(
            document.getElementById('signupUsername').value.trim(),
            document.getElementById('signupEmail').value.trim(),
            document.getElementById('signupPassword').value
        );
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Game controls
    document.getElementById('newGameBtn').addEventListener('click', () => {
        setupPieces();
        renderBoard();
        document.getElementById('gameStatusText').textContent = 'White to move';
        gameOver = false;
        currentPlayer = 'white';
        document.getElementById('loading').style.display = 'none';
    });
    
    document.getElementById('undoBtn').addEventListener('click', () => {
        setupPieces();
        renderBoard();
        document.getElementById('gameStatusText').textContent = 'White to move';
        gameOver = false;
        currentPlayer = 'white';
    });
    
    document.getElementById('resignBtn').addEventListener('click', () => {
        if (!gameOver) {
            gameOver = true;
            const winner = currentPlayer === 'white' ? 'Black' : 'White';
            document.getElementById('gameStatusText').textContent = `${winner} wins by resignation!`;
        }
    });
    
    // Difficulty buttons
    document.querySelectorAll('[data-difficulty]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('[data-difficulty]').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            gameDifficulty = this.dataset.difficulty;
            console.log('Difficulty:', gameDifficulty);
        });
    });
    
    // Time control buttons
    document.querySelectorAll('[data-time]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('[data-time]').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            gameTime = parseInt(this.dataset.time) * 60;
            console.log('Time control:', gameTime);
        });
    });
}

// Login function - FIXED
async function login(email, password) {
    clearErrors();
    
    if (!email || !password) {
        showError('loginPasswordError', 'Email and password are required');
        return;
    }
    
    // Show loading
    const loginBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;
    
    try {
        console.log('🔑 Attempting login for:', email);
        
        const response = await fetch(API_BASE_URL + '/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (!response.ok || !data.success) {
            showError('loginPasswordError', data.error || 'Login failed');
            return;
        }
        
        // Save credentials
        localStorage.setItem('chess_token', data.token);
        localStorage.setItem('chess_user', JSON.stringify(data.user));
        authToken = data.token;
        currentUser = data.user;
        
        // Show success and transition to game
        showError('loginPasswordError', 'Login successful!', 'success');
        
        setTimeout(() => {
            showGameScreen();
            setupPieces();
            renderBoard();
            updateUserInfo();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Login error:', error);
        showError('loginPasswordError', 'Network error. Please try again.');
    } finally {
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
}

// Signup function - FIXED
async function signup(username, email, password) {
    clearErrors();
    
    // Validation
    if (!username || !email || !password) {
        showError('signupEmailError', 'All fields are required');
        return;
    }
    
    if (username.length < 3) {
        showError('signupUsernameError', 'Username must be at least 3 characters');
        return;
    }
    
    if (password.length < 6) {
        showError('signupPasswordError', 'Password must be at least 6 characters');
        return;
    }
    
    // Show loading
    const signupBtn = document.querySelector('#signupForm button[type="submit"]');
    const originalText = signupBtn.textContent;
    signupBtn.textContent = 'Creating account...';
    signupBtn.disabled = true;
    
    try {
        console.log('📝 Attempting signup:', { username, email });
        
        const response = await fetch(API_BASE_URL + '/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        console.log('Signup response:', data);
        
        if (!response.ok || !data.success) {
            showError('signupEmailError', data.error || 'Signup failed');
            return;
        }
        
        // Save credentials
        localStorage.setItem('chess_token', data.token);
        localStorage.setItem('chess_user', JSON.stringify(data.user));
        authToken = data.token;
        currentUser = data.user;
        
        // Show success and transition to game
        showError('signupEmailError', 'Account created successfully!', 'success');
        
        setTimeout(() => {
            showGameScreen();
            setupPieces();
            renderBoard();
            updateUserInfo();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Signup error:', error);
        showError('signupEmailError', 'Network error. Please try again.');
    } finally {
        signupBtn.textContent = originalText;
        signupBtn.disabled = false;
    }
}

function logout() {
    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_user');
    authToken = null;
    currentUser = null;
    showWelcomeScreen();
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('username').textContent = currentUser.username;
        document.getElementById('userRating').textContent = currentUser.rating || 1500;
        const firstLetter = currentUser.username.charAt(0).toUpperCase();
        document.getElementById('userAvatar').textContent = firstLetter;
    }
}

// Chess game functions (keep from previous version)
function createBoard() {
    const chessboard = document.getElementById('chessboard');
    chessboard.innerHTML = '';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;
            
            square.addEventListener('click', () => handleSquareClick(row, col));
            
            chessboard.appendChild(square);
        }
    }
}

function setupPieces() {
    boardState = Array(8).fill().map(() => Array(8).fill(null));
    
    // Pawns
    for (let col = 0; col < 8; col++) {
        boardState[6][col] = { type: 'pawn', color: 'white' };
        boardState[1][col] = { type: 'pawn', color: 'black' };
    }
    
    // Other pieces
    const pieceOrder = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    
    for (let col = 0; col < 8; col++) {
        boardState[7][col] = { type: pieceOrder[col], color: 'white' };
        boardState[0][col] = { type: pieceOrder[col], color: 'black' };
    }
    
    selectedPiece = null;
    validMoves = [];
    moveHistory = [];
    currentPlayer = 'white';
    gameOver = false;
    
    document.getElementById('moveList').innerHTML = '';
}

function renderBoard() {
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('selected', 'valid-move', 'capture-move');
    });
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
            
            square.innerHTML = '';
            
            if (piece) {
                const pieceChar = getPieceChar(piece.type, piece.color);
                const pieceDiv = document.createElement('div');
                pieceDiv.className = `piece ${piece.color}`;
                pieceDiv.textContent = pieceChar;
                square.appendChild(pieceDiv);
            }
        }
    }
    
    if (selectedPiece) {
        const { row, col } = selectedPiece.position;
        const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
        square.classList.add('selected');
        
        validMoves.forEach(move => {
            const moveSquare = document.querySelector(`.square[data-row="${move.row}"][data-col="${move.col}"]`);
            if (boardState[move.row][move.col]) {
                moveSquare.classList.add('capture-move');
            } else {
                moveSquare.classList.add('valid-move');
            }
        });
    }
}

function getPieceChar(type, color) {
    const pieces = {
        'king': color === 'white' ? '♔' : '♚',
        'queen': color === 'white' ? '♕' : '♛',
        'rook': color === 'white' ? '♖' : '♜',
        'bishop': color === 'white' ? '♗' : '♝',
        'knight': color === 'white' ? '♘' : '♞',
        'pawn': color === 'white' ? '♙' : '♟'
    };
    return pieces[type] || '';
}

function handleSquareClick(row, col) {
    if (gameOver || currentPlayer === 'black') return;
    
    const clickedPiece = boardState[row][col];
    
    if (selectedPiece) {
        const move = validMoves.find(m => m.row === row && m.col === col);
        
        if (move) {
            makeMove(selectedPiece.position, { row, col });
            selectedPiece = null;
            validMoves = [];
            
            currentPlayer = 'black';
            document.getElementById('gameStatusText').textContent = 'Computer thinking...';
            document.getElementById('loading').style.display = 'block';
            
            setTimeout(computerMove, 1000);
            return;
        }
        
        if (clickedPiece && clickedPiece.color === 'white') {
            selectPiece(row, col, clickedPiece);
            return;
        }
        
        selectedPiece = null;
        validMoves = [];
    }
    
    if (clickedPiece && clickedPiece.color === 'white') {
        selectPiece(row, col, clickedPiece);
    }
    
    renderBoard();
}

function selectPiece(row, col, piece) {
    selectedPiece = { position: { row, col }, piece };
    validMoves = getValidMoves(piece, row, col);
    renderBoard();
}

function getValidMoves(piece, row, col) {
    const moves = [];
    
    if (piece.type === 'pawn') {
        const forwardOne = row - 1;
        const forwardTwo = row - 2;
        
        if (forwardOne >= 0 && !boardState[forwardOne][col]) {
            moves.push({ row: forwardOne, col });
            
            if (row === 6 && !boardState[forwardTwo][col]) {
                moves.push({ row: forwardTwo, col });
            }
        }
        
        if (col > 0 && boardState[forwardOne][col - 1] && boardState[forwardOne][col - 1].color === 'black') {
            moves.push({ row: forwardOne, col: col - 1 });
        }
        
        if (col < 7 && boardState[forwardOne][col + 1] && boardState[forwardOne][col + 1].color === 'black') {
            moves.push({ row: forwardOne, col: col + 1 });
        }
    }
    
    return moves;
}

function makeMove(from, to) {
    const piece = boardState[from.row][from.col];
    const capturedPiece = boardState[to.row][to.col];
    
    boardState[to.row][to.col] = piece;
    boardState[from.row][from.col] = null;
    
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fromNotation = files[from.col] + (8 - from.row);
    const toNotation = files[to.col] + (8 - to.row);
    const moveNotation = capturedPiece ? `${fromNotation}x${toNotation}` : `${fromNotation}-${toNotation}`;
    
    moveHistory.push(moveNotation);
    updateMoveHistory();
    
    if (piece.type === 'pawn' && to.row === 0) {
        boardState[to.row][to.col].type = 'queen';
    }
    
    checkGameStatus();
}

function updateMoveHistory() {
    const moveList = document.getElementById('moveList');
    moveList.innerHTML = '';
    
    for (let i = 0; i < moveHistory.length; i += 2) {
        const moveEntry = document.createElement('div');
        moveEntry.className = 'move-entry';
        
        const whiteMove = moveHistory[i];
        const blackMove = moveHistory[i + 1];
        
        const turnNumber = Math.floor(i / 2) + 1;
        moveEntry.innerHTML = `
            <span>${turnNumber}. ${whiteMove || ''}</span>
            <span>${blackMove || ''}</span>
        `;
        
        moveList.appendChild(moveEntry);
    }
    
    moveList.scrollTop = moveList.scrollHeight;
}

function computerMove() {
    if (gameOver || currentPlayer !== 'black') return;
    
    const possibleMoves = [];
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && piece.color === 'black') {
                const moves = getValidMoves(piece, row, col);
                moves.forEach(move => {
                    possibleMoves.push({
                        from: { row, col },
                        to: move
                    });
                });
            }
        }
    }
    
    if (possibleMoves.length === 0) {
        checkGameStatus();
        document.getElementById('loading').style.display = 'none';
        return;
    }
    
    let selectedMove;
    if (gameDifficulty === 'easy') {
        selectedMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    } else {
        const captures = possibleMoves.filter(move => 
            boardState[move.to.row] && boardState[move.to.row][move.to.col]?.color === 'white'
        );
        
        if (captures.length > 0) {
            selectedMove = captures[Math.floor(Math.random() * captures.length)];
        } else {
            selectedMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        }
    }
    
    makeMove(selectedMove.from, selectedMove.to);
    
    currentPlayer = 'white';
    document.getElementById('gameStatusText').textContent = 'White to move';
    document.getElementById('loading').style.display = 'none';
    renderBoard();
    
    checkGameStatus();
}

function checkGameStatus() {
    let whiteHasMoves = false;
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && piece.color === 'white') {
                if (getValidMoves(piece, row, col).length > 0) {
                    whiteHasMoves = true;
                    break;
                }
            }
        }
        if (whiteHasMoves) break;
    }
    
    if (!whiteHasMoves) {
        gameOver = true;
        document.getElementById('gameStatusText').textContent = 'Checkmate! Black wins!';
    }
}
