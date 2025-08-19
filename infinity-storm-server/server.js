const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Disable caching in development so updated assets appear immediately
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Socket.io setup
const io = socketIo(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the parent directory (game client)
app.use(express.static(path.join(__dirname, '..')));

// Basic route for health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Infinity Storm Server is running' });
});

// Simple game API endpoints
app.post('/api/spin', (req, res) => {
    try {
        // Simple spin logic for testing (6 columns × 5 rows)
        const grid = [];
        for (let col = 0; col < 6; col++) {
            const gridCol = [];
            for (let row = 0; row < 5; row++) {
                // Use crypto.randomBytes for secure server-side randomness
                const randomBytes = require('crypto').randomBytes(4);
                const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF;
                gridCol.push(Math.floor(randomValue * 10) + 1); // Random symbol 1-10
            }
            grid.push(gridCol);
        }

        const response = {
            success: true,
            grid: grid,
            winAmount: 0,
            cascades: [],
            balance: 1000
        };

        res.json(response);
    } catch (error) {
        console.error('Spin error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('spin_request', (data) => {
        console.log('Spin request received:', data);
        
        // Simple spin response (6 columns × 5 rows)
        const grid = [];
        for (let col = 0; col < 6; col++) {
            const gridCol = [];
            for (let row = 0; row < 5; row++) {
                // Use crypto.randomBytes for secure server-side randomness
                const randomBytes = require('crypto').randomBytes(4);
                const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF;
                gridCol.push(Math.floor(randomValue * 10) + 1);
            }
            grid.push(gridCol);
        }

        const response = {
            success: true,
            grid: grid,
            winAmount: 0,
            cascades: [],
            balance: 1000
        };

        socket.emit('spin_result', response);
    });

    socket.on('test', (data) => {
        console.log('Test message received:', data);
        socket.emit('test_response', { message: 'Test successful', data: data });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

server.listen(PORT, () => {
    console.log(`🎰 Infinity Storm Server running on port ${PORT}`);
    console.log(`🌐 Client URL: ${CLIENT_URL}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🎮 Game available at: http://localhost:${PORT}`);
});

module.exports = { app, server, io };
