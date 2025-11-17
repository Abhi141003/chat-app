import { io } from 'socket.io-client';
import './style.css';

// Server URL (production)
const SOCKET_SERVER_URL = 'https://chat-app-backend-sable-five.vercel.app';
const API_URL = SOCKET_SERVER_URL + '/api';

// Storage keys
const TOKEN_KEY = 'chat_token';
const USER_KEY = 'chat_user';

class ChatApp {
  constructor() {
    this.socket = null;
    this.user = null;
    this.token = null;
    this.currentRoom = null;
    this.rooms = [];
    this.roomUsers = [];
    
    this.init();
  }

  init() {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    
    if (storedToken && storedUser) {
      this.token = storedToken;
      this.user = JSON.parse(storedUser);
      this.showRoomSelection();
    } else {
      this.showAuthScreen();
    }
  }

  // ===== AUTH SCREEN =====
  showAuthScreen() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('roomSelectionScreen').style.display = 'none';
    document.getElementById('chatScreen').style.display = 'none';

    // Setup tab toggles
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    showLoginBtn.onclick = () => {
      showLoginBtn.classList.add('active');
      showRegisterBtn.classList.remove('active');
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
    };
    showRegisterBtn.onclick = () => {
      showRegisterBtn.classList.add('active');
      showLoginBtn.classList.remove('active');
      registerForm.style.display = 'block';
      loginForm.style.display = 'none';
    };

    // Attach handlers
    loginForm.removeEventListener('submit', (e) => this.handleLogin(e));
    loginForm.addEventListener('submit', (e) => this.handleLogin(e));

    registerForm.removeEventListener('submit', (e) => this.handleRegister(e));
    registerForm.addEventListener('submit', (e) => this.handleRegister(e));
  }

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('loginError');

    if (!username || !password) {
      errorEl.textContent = 'Username and password are required';
      return;
    }

    if (username.length < 3) {
      errorEl.textContent = 'Username must be at least 3 characters';
      return;
    }

    if (password.length < 4) {
      errorEl.textContent = 'Password must be at least 4 characters';
      return;
    }

    try {
      errorEl.textContent = 'Logging in...';
      
      // Call login endpoint
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (!response.ok) {
        errorEl.textContent = data.error || 'Login failed';
        return;
      }

      // Store token and user
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem(TOKEN_KEY, this.token);
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));

      errorEl.textContent = '';
      document.getElementById('loginForm').reset();
      this.showRoomSelection();
    } catch (error) {
      console.error('Auth error:', error);
      errorEl.textContent = 'Authentication failed: ' + error.message;
    }
  }

  // ===== Register =====
  async handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const password2 = document.getElementById('regPassword2').value.trim();
    const errorEl = document.getElementById('regError');

    if (!username || !password || !password2) {
      errorEl.textContent = 'All fields are required';
      return;
    }
    if (password !== password2) {
      errorEl.textContent = 'Passwords do not match';
      return;
    }
    try {
      errorEl.textContent = 'Registering...';
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) {
        errorEl.textContent = data.error || 'Registration failed';
        return;
      }

      // Store token and user
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem(TOKEN_KEY, this.token);
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));

      errorEl.textContent = '';
      document.getElementById('registerForm').reset();
      this.showRoomSelection();
    } catch (err) {
      console.error('Register error:', err);
      errorEl.textContent = 'Registration failed: ' + err.message;
    }
  }

  // ===== ROOM SELECTION SCREEN =====
  async showRoomSelection() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('roomSelectionScreen').style.display = 'flex';
    document.getElementById('chatScreen').style.display = 'none';

    document.getElementById('selectedUsername').textContent = this.user.username;

    try {
      const response = await fetch(`${API_URL}/rooms`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      this.rooms = await response.json();
      this.renderRoomSelection();
    } catch (error) {
      console.error('Error loading rooms:', error);
    }

    // Setup logout button
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
  }

  renderRoomSelection() {
    const roomList = document.getElementById('roomSelectionList');
    roomList.innerHTML = '';

    this.rooms.forEach(room => {
      const roomCard = document.createElement('div');
      roomCard.className = 'room-card';
      roomCard.innerHTML = `
        <h3>${room.name}</h3>
        <p>${room.description}</p>
      `;
      roomCard.addEventListener('click', () => this.joinRoom(room._id, room.name));
      roomList.appendChild(roomCard);
    });
  }

  // ===== CHAT SCREEN =====
  async joinRoom(roomId, roomName) {
    this.currentRoom = roomId;
    
    // Show chat screen
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('roomSelectionScreen').style.display = 'none';
    document.getElementById('chatScreen').style.display = 'flex';

    document.getElementById('loggedInUsername').textContent = this.user.username;
    document.getElementById('roomName').textContent = '#' + roomName;
    document.getElementById('messagesContainer').innerHTML = '';
    this.roomUsers = [];
    this.updateUserList();

    // Initialize Socket.IO if not already connected
    if (!this.socket || !this.socket.connected) {
      this.setupSocket();
    }

    // Join the room
    this.socket.emit('join_room', {
      roomId,
      username: this.user.username,
      userId: this.user.id
    });

    this.renderRooms();
    this.setupEventListeners();

    // Setup logout button
    document.getElementById('logoutChatBtn').addEventListener('click', () => this.logout());
  }

  setupSocket() {
    this.socket = io(SOCKET_SERVER_URL, {
      auth: {
        token: this.token
      }
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('load_messages', (messages) => {
      this.displayMessages(messages);
    });

    this.socket.on('receive_message', (message) => {
      this.addMessageToUI(message, message.userId === this.user.id);
    });

    this.socket.on('user_joined', (data) => {
      this.roomUsers = data.users;
      this.updateUserList();
      if (data.userId !== this.user.id) {
        this.showNotification(`${data.username} joined the room`);
      }
    });

    this.socket.on('user_left', (data) => {
      this.roomUsers = data.users;
      this.updateUserList();
      this.showNotification(`${data.username} left the room`);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.logout();
    });
  }

  setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    sendBtn.onclick = () => this.sendMessage();
    messageInput.onkeypress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    };
  }

  renderRooms() {
    const roomList = document.getElementById('roomList');
    roomList.innerHTML = '';
    
    this.rooms.forEach(room => {
      const roomEl = document.createElement('div');
      roomEl.className = 'room-item';
      if (this.currentRoom === room._id) {
        roomEl.classList.add('active');
      }
      roomEl.textContent = '#' + room.name;
      roomEl.addEventListener('click', () => {
        if (this.currentRoom !== room._id) {
          this.leaveCurrentRoom();
          this.joinRoom(room._id, room.name);
        }
      });
      roomList.appendChild(roomEl);
    });
  }

  sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();
    
    if (!text || !this.currentRoom) return;

    this.socket.emit('send_message', {
      roomId: this.currentRoom,
      text,
      username: this.user.username,
      userId: this.user.id
    });

    messageInput.value = '';
    messageInput.focus();
  }

  addMessageToUI(message, isOwn) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageEl = document.createElement('div');
    messageEl.className = `message ${isOwn ? 'own' : 'other'}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = `
      <div class="font-semibold text-sm">${message.username}</div>
      <div>${this.escapeHtml(message.text)}</div>
    `;

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date(message.timestamp).toLocaleTimeString();

    messageEl.appendChild(bubble);
    messageEl.appendChild(time);
    messagesContainer.appendChild(messageEl);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  displayMessages(messages) {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
      this.addMessageToUI(msg, msg.userId === this.user.id);
    });
  }

  updateUserList() {
    const userList = document.getElementById('userList');
    userList.innerHTML = '<div class="text-sm font-semibold text-gray-300 mb-2">Online Users</div>';
    
    this.roomUsers.forEach(user => {
      const userEl = document.createElement('div');
      userEl.className = 'user-item';
      const indicator = user.userId === this.user.id ? ' (You)' : '';
      userEl.textContent = '• ' + user.username + indicator;
      userList.appendChild(userEl);
    });
  }

  leaveCurrentRoom() {
    if (this.currentRoom) {
      this.socket.emit('leave_room', {
        roomId: this.currentRoom,
        userId: this.user.id,
        username: this.user.username
      });
    }
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'bg-blue-500 text-white px-4 py-2 rounded mb-2 text-sm';
    notification.textContent = message;
    
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.insertBefore(notification, messagesContainer.firstChild);
    
    setTimeout(() => notification.remove(), 5000);
  }

  logout() {
    this.leaveCurrentRoom();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user = null;
    this.token = null;
    this.currentRoom = null;
    this.showAuthScreen();
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ChatApp();
});
