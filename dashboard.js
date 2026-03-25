// --- Element Selectors ---
let enrollModal, enrollBtn, enrollForm, capturedUidInput, uidStatus, logTable;
let userTableBody;
let userManagementSection, liveMonitorSection;

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
            }
        });
    });
    
    // Start the pulse animation
    const dot = document.querySelector('.dot');
    if (dot) {
        dot.classList.add('pulse');
    }
    
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
    console.log("Dashboard event listeners initialized");
}

// Fetch users from API and render table
function fetchAndRenderUsers() {
    fetch('/api/users') // point at backend API
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
            <td>${user.uid}</td>
            <td>${user.status}</td>
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
    fetch('/api/users', {
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
        <td>${time}</td>
        <td>${area}</td>
    `;

    // Prepend ensures the newest scan is always at the top
    logTable.prepend(row);
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