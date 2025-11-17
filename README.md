# Real-Time Chat Application

A modern real-time chat application built with **Vite**, **Node.js/Express**, **Socket.IO**, **MongoDB**, and **Tailwind CSS**.

## Features

✅ **Real-time messaging** - Instant message delivery using WebSocket (Socket.IO)  
✅ **Multiple chat rooms** - Join different channels for organized conversations  
✅ **User authentication** - Anonymous users with auto-generated unique usernames  
✅ **User lists** - See who's online in each room  
✅ **Message history** - All messages persisted in MongoDB  
✅ **Responsive design** - Beautiful UI with Tailwind CSS  
✅ **Local deployment** - Easy to run locally  

## Prerequisites

- Node.js (v14+)
- MongoDB (local or cloud instance)
- npm or yarn

## Installation

### 1. Clone or navigate to project directory
```bash
cd chat-app
```

### 2. Install Server Dependencies
```bash
cd server
npm install
```

### 3. Install Client Dependencies
```bash
cd ../client
npm install
```

### 4. Setup MongoDB

#### Option A: Local MongoDB
- Install MongoDB and start the service
- Default connection: `mongodb://localhost:27017/chat-app`

#### Option B: MongoDB Atlas (Cloud)
- Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Create a cluster and get connection string
- Set `MONGODB_URI` in server `.env` file

### 5. Configure Environment Variables

Create `.env` file in the `server` directory:
```
MONGODB_URI=mongodb://localhost:27017/chat-app
PORT=3001
NODE_ENV=development
```

## Running the Application

### Start the Backend Server
```bash
cd server
npm run dev
```
Server will run on `http://localhost:3001`

### Start the Frontend (in another terminal)
```bash
cd client
npm run dev
```
Frontend will run on `http://localhost:5173`

### Access the App
Open your browser and go to: `http://localhost:5173`

## Build for Production

### Build Frontend
```bash
cd client
npm run build
```

### Run Production Server
```bash
cd server
npm start
```

## Project Structure

```
chat-app/
├── server/
│   ├── server.js          # Express server & Socket.IO setup
│   ├── package.json       # Server dependencies
│   └── .env.example       # Environment variables template
│
└── client/
    ├── index.html         # Main HTML file
    ├── src/
    │   ├── main.js        # Client app logic
    │   └── style.css      # Tailwind styles
    ├── package.json       # Client dependencies
    ├── vite.config.js     # Vite configuration
    ├── tailwind.config.js # Tailwind configuration
    └── postcss.config.js  # PostCSS configuration
```

## Usage

1. **Join a room**: Click on a room in the sidebar
2. **Send messages**: Type in the input field and press Enter or click Send
3. **View users**: See active users on the right sidebar
4. **Switch rooms**: Click different rooms to switch conversations

## Technologies Used

- **Frontend**: Vite, Vanilla JavaScript, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO
- **Database**: MongoDB & Mongoose
- **Communication**: WebSocket (Socket.IO)

## Features Detail

### Real-time Communication
- WebSocket connection via Socket.IO
- Instant message delivery to all users in a room
- Real-time user join/leave notifications

### Message Persistence
- All messages stored in MongoDB
- Up to 50 recent messages loaded when joining a room
- Timestamps on all messages

### Chat Rooms
- Pre-created default rooms: General, Random, Tech
- Easy to add more rooms via database
- Separate user lists per room

### Anonymous Users
- Auto-generated unique usernames (e.g., "BrightEagle", "SwiftDolphin")
- Unique user IDs for tracking
- No login required

## Troubleshooting

### Server won't connect
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- Verify port 3001 is not in use

### Frontend can't reach backend
- Ensure server is running on port 3001
- Check CORS settings in `server.js`
- Verify Socket.IO connection URL in `main.js`

### Messages not persisting
- Verify MongoDB connection is working
- Check MongoDB user permissions
- Ensure database and collections exist

## Future Enhancements

- User authentication with password
- Private messaging between users
- Message search functionality
- Typing indicators
- Message reactions/emojis
- File/image sharing
- Message editing and deletion

## License

MIT

