import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production_12345';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Generate JWT Token
function generateToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
}

// Verify JWT Token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Auth Middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.user = decoded;
  next();
}

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true, minlength: 3 },
  password: { type: String, required: true, minlength: 4 },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcryptjs.genSalt(10);
  this.password = await bcryptjs.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(password) {
  return await bcryptjs.compare(password, this.password);
};

const messageSchema = new mongoose.Schema({
  roomId: String,
  username: String,
  userId: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
});

const roomSchema = new mongoose.Schema({
  name: String,
  description: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Room = mongoose.model('Room', roomSchema);

// In-memory storage as fallback
let usersStore = [];
let messagesStore = [];
let roomsStore = [
  { _id: '1', name: 'General', description: 'General discussion' },
  { _id: '2', name: 'Random', description: 'Random topics' },
  { _id: '3', name: 'Tech', description: 'Technology discussion' }
];

let mongoConnected = false;

// MongoDB Connection with retry
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app';
mongoose.connect(MONGODB_URI, { 
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 10000,
  connectTimeoutMS: 10000 
})
  .then(() => {
    console.log('✓ Connected to MongoDB');
    mongoConnected = true;
    initializeRooms();
  })
  .catch(err => {
    console.log('⚠ MongoDB connection failed, using in-memory storage');
    console.log('  Error:', err.message);
    mongoConnected = false;
  });

// Initialize default rooms in database
async function initializeRooms() {
  try {
    const count = await Room.countDocuments();
    if (count === 0) {
      const rooms = await Room.insertMany([
        { name: 'General', description: 'General discussion' },
        { name: 'Random', description: 'Random topics' },
        { name: 'Tech', description: 'Technology discussion' }
      ]);
      roomsStore = rooms.map(r => ({ _id: r._id.toString(), name: r.name, description: r.description }));
      console.log('✓ Default rooms created in MongoDB');
    } else {
      const rooms = await Room.find();
      roomsStore = rooms.map(r => ({ _id: r._id.toString(), name: r.name, description: r.description }));
    }
  } catch (err) {
    console.log('Could not initialize MongoDB rooms:', err.message);
  }
}

// Store active users
const users = new Map();
const roomUsers = new Map();

// Routes

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // Check if user already exists (in-memory or MongoDB)
    let existingUser = null;
    if (mongoConnected) {
      existingUser = await User.findOne({ username });
    } else {
      existingUser = usersStore.find(u => u.username === username);
    }

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    let newUser;
    if (mongoConnected) {
      newUser = new User({ username, password });
      await newUser.save();
    } else {
      const hashedPassword = await bcryptjs.hash(password, 10);
      newUser = { 
        id: 'user_' + Math.random().toString(36).substr(2, 9),
        username, 
        password: hashedPassword,
        createdAt: new Date()
      };
      usersStore.push(newUser);
    }

    const token = generateToken(newUser._id || newUser.id, username);

    res.status(201).json({
      success: true,
      token,
      user: { id: newUser._id || newUser.id, username }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user
    let user = null;
    if (mongoConnected) {
      user = await User.findOne({ username });
    } else {
      user = usersStore.find(u => u.username === username);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    let isPasswordValid;
    if (mongoConnected) {
      isPasswordValid = await user.comparePassword(password);
    } else {
      isPasswordValid = await bcryptjs.compare(password, user.password);
    }

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id || user.id, username);

    res.json({
      success: true,
      token,
      user: { id: user._id || user.id, username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify token endpoint
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Get rooms (protected route)
app.get('/api/rooms', authMiddleware, async (req, res) => {
  try {
    if (mongoConnected) {
      const rooms = await Room.find();
      res.json(rooms);
    } else {
      res.json(roomsStore);
    }
  } catch (error) {
    res.json(roomsStore);
  }
});

// Get messages (protected route)
app.get('/api/messages/:roomId', authMiddleware, async (req, res) => {
  try {
    if (mongoConnected) {
      const messages = await Message.find({ roomId: req.params.roomId })
        .sort({ timestamp: 1 })
        .limit(50);
      res.json(messages);
    } else {
      const messages = messagesStore
        .filter(m => m.roomId === req.params.roomId)
        .slice(-50)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      res.json(messages);
    }
  } catch (error) {
    res.json([]);
  }
});

// Socket.IO Middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication failed: No token provided'));
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return next(new Error('Authentication failed: Invalid or expired token'));
  }
  
  socket.userId = decoded.userId;
  socket.username = decoded.username;
  next();
});

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id, '- Username:', socket.username);

  socket.on('join_room', async (data) => {
    const { roomId } = data;
    const userId = socket.userId;
    const username = socket.username;
    
    socket.join(roomId);
    users.set(socket.id, { userId, username, roomId });
    
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, []);
    }
    roomUsers.get(roomId).push({ userId, username, socketId: socket.id });

    // Load message history
    try {
      let messages;
      if (mongoConnected) {
        messages = await Message.find({ roomId })
          .sort({ timestamp: 1 })
          .limit(50);
      } else {
        messages = messagesStore
          .filter(m => m.roomId === roomId)
          .slice(-50)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      }
      socket.emit('load_messages', messages);
    } catch (error) {
      console.log('Error loading messages:', error);
      socket.emit('load_messages', []);
    }

    // Notify room about user joining
    io.to(roomId).emit('user_joined', {
      username,
      userId,
      users: roomUsers.get(roomId)
    });
  });

  socket.on('send_message', async (data) => {
    const { roomId, text, username, userId } = data;
    
    try {
      let message;
      
      if (mongoConnected) {
        const newMessage = new Message({
          roomId,
          username,
          userId,
          text,
          timestamp: new Date()
        });
        await newMessage.save();
        message = newMessage;
      } else {
        message = {
          _id: 'msg_' + Math.random().toString(36).substr(2, 9),
          roomId,
          username,
          userId,
          text,
          timestamp: new Date()
        };
        messagesStore.push(message);
      }
      
      io.to(roomId).emit('receive_message', {
        userId,
        username,
        text,
        timestamp: message.timestamp,
        _id: message._id
      });
    } catch (error) {
      console.log('Error saving message:', error);
    }
  });

  socket.on('leave_room', (data) => {
    const { roomId, userId, username } = data;
    const user = users.get(socket.id);
    
    if (user) {
      socket.leave(roomId);
      
      if (roomUsers.has(roomId)) {
        const room = roomUsers.get(roomId);
        const index = room.findIndex(u => u.socketId === socket.id);
        if (index > -1) {
          room.splice(index, 1);
        }
      }
      
      io.to(roomId).emit('user_left', {
        username,
        userId,
        users: roomUsers.get(roomId) || []
      });
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const { roomId, userId, username } = user;
      
      if (roomUsers.has(roomId)) {
        const room = roomUsers.get(roomId);
        const index = room.findIndex(u => u.socketId === socket.id);
        if (index > -1) {
          room.splice(index, 1);
        }
      }
      
      io.to(roomId).emit('user_left', {
        username,
        userId,
        users: roomUsers.get(roomId) || []
      });
    }
    
    users.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
