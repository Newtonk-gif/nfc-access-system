// --- Element Selectors ---
let enrollModal, enrollBtn, enrollForm, capturedUidInput, uidStatus, logTable;
let userTableBody;
let userManagementSection, liveMonitorSection;

// Backend API URL (Update the port if your Node server runs on a different one)
const API_BASE_URL = 'http://localhost:3000';

function initDashboard() {
    console.log("Dashboard has been initialized.");
    
    // Initialize DOM element references
    enrollModal = document.getElementById('enroll-modal');
    enrollBtn = document.getElementById('enroll-btn');
    enrollForm = document.getElementById('enroll-form');
    capturedUidInput = document.getElementById('captured-uid');
    uidStatus = document.getElementById('uid-status');
    logTable = document.getElementById('log-table');
    userTableBody = document.getElementById('user-table-body');
    userManagementSection = document.getElementById('user-management-section');
    liveMonitorSection = document.getElementById('live-monitor-section');
    // Nav switching
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            if (item.textContent.trim() === 'User Management') {
                liveMonitorSection.classList.add('hidden');
                userManagementSection.classList.remove('hidden');
                document.getElementById('dashboard-title').textContent = 'User Management';
                fetchAndRenderUsers();
            } else {
                userManagementSection.classList.add('hidden');
                liveMonitorSection.classList.remove('hidden');
                document.getElementById('dashboard-title').textContent = 'Live Activity Feed';
                fetchAndRenderLogs();
            }
        });
    });
    
    // Check if the backend server is running and update UI
    checkServerStatus();
    setInterval(checkServerStatus, 15000); // Re-check every 15 seconds
    
    // Setup event listeners
    if (enrollBtn) {
        enrollBtn.addEventListener('click', () => {
            enrollModal.classList.remove('hidden');
            resetEnrollmentUI();
            console.log("System: Entering Enrollment Mode...");
        });
    }
    if (enrollForm) {
        enrollForm.addEventListener('submit', handleEnrollSubmit);
    }

    // Load access logs initially to display existing scan history
    fetchAndRenderLogs();
    console.log("Dashboard event listeners initialized");
}

// Ping the backend health endpoint to verify it is running
function checkServerStatus() {
    const statusIndicator = document.querySelector('.status-indicator');
    if (!statusIndicator) return;

    fetch(`${API_BASE_URL}/health`)
        .then(res => {
            if (res.ok) {
                statusIndicator.innerHTML = '<span class="dot pulse" style="background-color: #22c55e;"></span> System Online';
            } else {
                throw new Error('Server returned an error');
            }
        })
        .catch(err => {
            statusIndicator.innerHTML = '<span class="dot" style="background-color: #ef4444; animation: none;"></span> Backend Offline';
        });
}

// Fetch users from API and render table
function fetchAndRenderUsers() {
    fetch(`${API_BASE_URL}/api/users`) // point at backend API
        .then(res => res.json())
        .then(response => {
            if (response.success && response.data) {
                // convert object to array if necessary
                const users = Array.isArray(response.data) ? response.data : Object.values(response.data);
                renderUserTable(users);
            } else {
                throw new Error(response.error || 'Unexpected response');
            }
        })
        .catch(err => {
            userTableBody.innerHTML = '<tr><td colspan="5">Failed to load users</td></tr>';
            console.error('Error fetching users:', err);
        });
}

function renderUserTable(users) {
    userTableBody.innerHTML = '';
    if (!users || users.length === 0) {
        userTableBody.innerHTML = '<tr><td colspan="5">No users found</td></tr>';
        return;
    }
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.uid || 'No UID'}</td>
            <td>${user.active ? 'Active' : 'Inactive'}</td>
            <td>${user.last_access || ''}</td>
        `;
        userTableBody.appendChild(row);
    });
}

// --- Enrollment Functions ---

function closeEnrollModal() {
    if (enrollModal) {
        enrollModal.classList.add('hidden');
    }
    if (enrollForm) {
        enrollForm.reset();
    }
}

function resetEnrollmentUI() {
    if (uidStatus) {
        uidStatus.innerText = "Waiting for NFC Scan...";
        uidStatus.style.color = "#3b82f6"; // Reset to theme blue
    }
    if (capturedUidInput) {
        capturedUidInput.value = "";
    }
}

/**
 * SIMULATION: Capture a UID
 * In the real system, your Node.js backend will emit a 'new-tag' 
 * event via Socket.io, which triggers this function.
 */
function onTagScanned(uid) {
    if (!enrollModal || enrollModal.classList.contains('hidden')) {
        // We are in live monitor mode
        addLogEntry("GRANTED", "Gideon Mark", new Date().toLocaleTimeString(), "Main Gate");
    } else {
        // We are in enrollment mode
        if (capturedUidInput && uidStatus) {
            capturedUidInput.value = uid;
            uidStatus.innerText = "UID Captured Successfully!";
            uidStatus.style.color = "#22c55e"; // Success green
            console.log("UID captured:", uid);
        }
    }
}

// Handle saving the new user
function handleEnrollSubmit(e) {
    e.preventDefault();
    
    const userData = {
        name: document.getElementById('new-user-name').value,
        id: document.getElementById('new-user-id').value,
        uid: capturedUidInput.value
    };

    if (!userData.uid) {
        alert("Action Required: Please scan a physical tag first.");
        return;
    }

    // send to backend API
    fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userData.id, name: userData.name, uid: userData.uid })
    })
    .then(res => res.json())
    .then(response => {
        if (response.success) {
            alert(`Success: ${userData.name} has been allocated UID ${userData.uid}`);
            fetchAndRenderUsers(); // refresh user list
        } else {
            throw new Error(response.error || 'Failed to save user');
        }
    })
    .catch(err => {
        console.error('Error saving user:', err);
        alert('Failed to save user. See console for details.');
    })
    .finally(() => closeEnrollModal());
}

// --- Live Feed Functions ---

/**
 * Adds a new row to the top of the activity table
 */
function addLogEntry(status, user, time, area) {
    if (!logTable) return;
    
    const row = document.createElement('tr');
    
    // Status colors
    const statusClass = status === "GRANTED" ? "text-green-600 font-bold" : "text-red-600 font-bold";

    row.innerHTML = `
        <td><span class="${statusClass}">${status}</span></td>
        <td>${user}</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>${area}</td>
        <td>-</td>
        <td>${time}</td>
    `;

    // Prepend ensures the newest scan is always at the top
    logTable.prepend(row);
}

// Fetch access logs from the database
function fetchAndRenderLogs() {
    if (!logTable) {
        console.error("Dashboard Error: Could not find 'log-table' in your HTML.");
        return;
    }
    
    fetch(`${API_BASE_URL}/api/access-logs`)
        .then(res => res.json())
        .then(response => {
            console.log("Backend API Response (Logs):", response);
            if (response.success && response.data) {
                // Ensure data is an array before looping
                const logs = Array.isArray(response.data) ? response.data : Object.values(response.data);
                renderLogsTable(logs);
            } else {
                console.warn("Backend returned empty data or failed:", response);
                renderLogsTable([]); // Render empty state
            }
        })
        .catch(err => {
            console.error('Error fetching logs. Is the backend running? Details:', err);
            logTable.innerHTML = '<tr><td colspan="9" class="text-center text-red-500 font-bold">Failed to load data from backend. Check console.</td></tr>';
        });
}

function renderLogsTable(logs) {
    logTable.innerHTML = '';

    // Display a friendly message if there is no data
    if (!logs || logs.length === 0) {
        logTable.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 1rem;">No recent activity found.</td></tr>';
        return;
    }

    // Response is newest-first. Appending them preserves the order.
    logs.forEach(log => {
        // Handle timestamp (supports both integer milliseconds and ISO strings)
        const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A';
        
        // Handle status mapping (supports your 'status' string or boolean 'granted')
        let isGranted = log.granted === true;
        if (log.status) {
            isGranted = log.status.toLowerCase() === 'granted';
        }
        const status = isGranted ? "GRANTED" : "DENIED";
        const statusClass = isGranted ? "text-green-600 font-bold" : "text-red-600 font-bold";
        
        // Display Name (uses your userName, falls back to userId, then tagUid)
        const userDisplay = log.userName || log.userId || 'Unknown';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="${statusClass}">${status}</span></td>
            <td>${userDisplay}</td>
            <td style="text-transform: capitalize;">${log.role || 'N/A'}</td>
            <td>${log.department || 'N/A'}</td>
            <td style="font-family: monospace;">${log.tagUid || log.tagUID || 'N/A'}</td>
            <td style="text-transform: capitalize;">${log.eventType || 'N/A'}</td>
            <td>${log.location || 'Unknown'}</td>
            <td>${log.readerId || 'N/A'}</td>
            <td>${time}</td>
        `;
        logTable.appendChild(row);
    });
}

// Simulate NFC scan for testing - scan after dashboard loads
function simulateNFCScan(uid) {
    console.log("Simulating NFC scan with UID:", uid);
    onTagScanned(uid);
}

// Initial simulation to see the table work - disabled by default
// Uncomment to test: setTimeout(() => simulateNFCScan("4A:5B:6C:7D"), 3000);

// Export functions to window for browser console testing
window.simulateNFCScan = simulateNFCScan;
window.closeEnrollModal = closeEnrollModal;
window.onTagScanned = onTagScanned;