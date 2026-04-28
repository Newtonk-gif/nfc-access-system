// --- Element Selectors ---
let logTable;
let userTableBody;
let userManagementSection, liveMonitorSection;
let enrollmentSection;
let editModal, editForm, editUserNameInput, editUserRoleInput, editUserDeptInput, editUserActiveInput, currentEditUserId;
let userSearchInput;
let logSearchInput;
let exportCsvBtn;
let exportStartDate;
let exportEndDate;
let currentLogsPage = 1;
const logsPerPage = 10;
let allLogsData = [];
let currentUsersPage = 1;
const usersPerPage = 10;
let allUsersData = [];
let activityChart = null;
let statusPieChart = null;
let locationChart = null;

// Backend API URL (Replace with your actual live Render URL, e.g., 'https://nfc-backend-abcd.onrender.com')
const API_BASE_URL = 'https://nfc-access-system-1.onrender.com'; // 👈 Paste your actual Render URL here

function initDashboard() {
    console.log("Dashboard has been initialized.");
    
    // Initialize DOM element references
    logTable = document.getElementById('log-table');
    userTableBody = document.getElementById('user-table-body');
    userManagementSection = document.getElementById('user-management-section');
    liveMonitorSection = document.getElementById('live-monitor-section');
    enrollmentSection = document.getElementById('enrollment-section');
    editModal = document.getElementById('edit-modal');
    editForm = document.getElementById('edit-form');
    editUserNameInput = document.getElementById('edit-user-name');
    editUserRoleInput = document.getElementById('edit-user-role');
    editUserDeptInput = document.getElementById('edit-user-dept');
    editUserActiveInput = document.getElementById('edit-user-active');
    userSearchInput = document.getElementById('user-search');
    logSearchInput = document.getElementById('log-search');
    exportCsvBtn = document.getElementById('export-csv-btn');
    exportStartDate = document.getElementById('export-start-date');
    exportEndDate = document.getElementById('export-end-date');
    
    // Nav switching
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const target = item.textContent.trim();
            if (target === 'User Management') {
                liveMonitorSection.classList.add('hidden');
                if (enrollmentSection) enrollmentSection.classList.add('hidden');
                userManagementSection.classList.remove('hidden');
                document.getElementById('dashboard-title').textContent = 'User Management';
                fetchAndRenderUsers();
            } else if (target === 'Enrollment Console') {
                liveMonitorSection.classList.add('hidden');
                userManagementSection.classList.add('hidden');
                if (enrollmentSection) enrollmentSection.classList.remove('hidden');
                document.getElementById('dashboard-title').textContent = 'Enrollment Console';
            } else {
                userManagementSection.classList.add('hidden');
                if (enrollmentSection) enrollmentSection.classList.add('hidden');
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
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }
    
    // User Search Listener
    if (userSearchInput) {
        userSearchInput.addEventListener('input', () => {
            currentUsersPage = 1; // Reset to first page on search
            renderUserTable();
        });
    }

    // Log Search Listener
    if (logSearchInput) {
        logSearchInput.addEventListener('input', () => {
            currentLogsPage = 1; // Reset to first page on search
            renderLogsTable();
        });
    }
    
    // Export CSV Listener
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportLogsToCSV);
    }
    
    // Date Filter Listeners
    if (exportStartDate) {
        exportStartDate.addEventListener('change', () => {
            currentLogsPage = 1;
            renderLogsTable();
            updateAnalyticsChart();
        });
    }
    if (exportEndDate) {
        exportEndDate.addEventListener('change', () => {
            currentLogsPage = 1;
            renderLogsTable();
            updateAnalyticsChart();
        });
    }

    // Load access logs initially to display existing scan history
    fetchAndRenderLogs();
    
    // WEBSOCKETS: Listen for real-time updates from the server
    const socket = io(API_BASE_URL);
    socket.on('new_access_log', (newLog) => {
        console.log("⚡ Real-time update received via WebSocket!");
        fetchAndRenderLogs(); // Instantly refresh the table
    });

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
    if (userTableBody) {
        userTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #6b7280; font-weight: bold;">⏳ Waking up backend and loading users... (May take up to 50 seconds)</td></tr>';
    }
    fetch(`${API_BASE_URL}/api/users`) // point at backend API
        .then(res => res.json())
        .then(response => {
            if (response.success && response.data) {
                // convert object to array if necessary
                allUsersData = Array.isArray(response.data) ? response.data : Object.values(response.data);
                renderUserTable();
            } else {
                throw new Error(response.error || 'Unexpected response');
            }
        })
        .catch(err => {
            allUsersData = [];
            userTableBody.innerHTML = '<tr><td colspan="5">Failed to load users</td></tr>';
            console.error('Error fetching users:', err);
        });
}

function renderUserTable() {
    userTableBody.innerHTML = '';

    let filteredUsers = allUsersData || [];
    
    // Apply search filter
    if (userSearchInput && userSearchInput.value.trim() !== '') {
        const term = userSearchInput.value.trim().toLowerCase();
        filteredUsers = filteredUsers.filter(u => 
            (u.name && u.name.toLowerCase().includes(term)) ||
            (u.uid && u.uid.toLowerCase().includes(term))
        );
    }

    if (filteredUsers.length === 0) {
        userTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No users found</td></tr>';
        updateUserPaginationControls(0);
        return;
    }

    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    if (currentUsersPage > totalPages) currentUsersPage = totalPages;

    const startIndex = (currentUsersPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    paginatedUsers.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td style="text-transform: capitalize;">${user.role || 'N/A'}</td>
            <td>${user.department || 'N/A'}</td>
            <td>${user.uid || 'No UID'}</td>
            <td>${user.active ? 'Active' : 'Inactive'}</td>
            <td>${user.last_access || ''}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editUser('${user.id}')">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteUser('${user.id}')">Delete</button>
            </td>
        `;
        userTableBody.appendChild(row);
    });

    updateUserPaginationControls(filteredUsers.length);
}

function updateUserPaginationControls(totalItems) {
    let paginationDiv = document.getElementById('user-pagination-controls');
    // Fallback to the section if table-container isn't wrapping the user table
    const container = userTableBody.closest('.table-container') || userManagementSection; 
    
    if (!container) return;

    if (!paginationDiv) {
        paginationDiv = document.createElement('div');
        paginationDiv.id = 'user-pagination-controls';
        paginationDiv.className = 'pagination-container';
        container.appendChild(paginationDiv);
    }

    const totalPages = Math.ceil(totalItems / usersPerPage) || 1;

    paginationDiv.innerHTML = `
        <button id="user-prev-page" class="secondary-btn" ${currentUsersPage === 1 ? 'disabled' : ''}>Previous</button>
        <span class="page-info">Page ${currentUsersPage} of ${totalPages}</span>
        <button id="user-next-page" class="secondary-btn" ${currentUsersPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Next</button>
    `;

    document.getElementById('user-prev-page').addEventListener('click', () => {
        if (currentUsersPage > 1) {
            currentUsersPage--;
            renderUserTable();
        }
    });

    document.getElementById('user-next-page').addEventListener('click', () => {
        if (currentUsersPage < totalPages) {
            currentUsersPage++;
            renderUserTable();
        }
    });
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

// Helper to get logs filtered by date range
function getFilteredLogsByDate() {
    let logs = allLogsData || [];

    if (exportStartDate && exportStartDate.value) {
        const start = new Date(exportStartDate.value);
        start.setHours(0, 0, 0, 0);
        logs = logs.filter(log => log.timestamp && new Date(log.timestamp) >= start);
    }

    if (exportEndDate && exportEndDate.value) {
        const end = new Date(exportEndDate.value);
        end.setHours(23, 59, 59, 999);
        logs = logs.filter(log => log.timestamp && new Date(log.timestamp) <= end);
    }

    return logs;
}

// Fetch access logs from the database
function fetchAndRenderLogs() {
    if (!logTable) {
        console.error("Dashboard Error: Could not find 'log-table' in your HTML.");
        return;
    }
    
    fetch(`${API_BASE_URL}/api/access-logs?limit=200`)
        .then(res => res.json())
        .then(response => {
            console.log("Backend API Response (Logs):", response);
            if (response.success && response.data) {
                // Ensure data is an array before looping
                allLogsData = Array.isArray(response.data) ? response.data : Object.values(response.data);
                renderLogsTable();
                updateAnalyticsChart();
            } else {
                console.warn("Backend returned empty data or failed:", response);
                allLogsData = [];
                renderLogsTable(); // Render empty state
                updateAnalyticsChart();
            }
        })
        .catch(err => {
            console.error('Error fetching logs. Is the backend running? Details:', err);
            logTable.innerHTML = '<tr><td colspan="9" class="text-center text-red-500 font-bold">Failed to load data from backend. Check console.</td></tr>';
        });
}

function renderLogsTable() {
    logTable.innerHTML = '';

    let filteredLogs = getFilteredLogsByDate();
    
    // Apply search filter
    if (logSearchInput && logSearchInput.value.trim() !== '') {
        const term = logSearchInput.value.trim().toLowerCase();
        filteredLogs = filteredLogs.filter(log => {
            const userDisplay = (log.userName || log.userId || '').toLowerCase();
            const tagDisplay = (log.tagUid || log.tagUID || '').toLowerCase();
            const locationDisplay = (log.location || '').toLowerCase();
            
            return userDisplay.includes(term) || tagDisplay.includes(term) || locationDisplay.includes(term);
        });
    }

    // Display a friendly message if there is no data
    if (filteredLogs.length === 0) {
        logTable.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 1rem;">No recent activity found.</td></tr>';
        updatePaginationControls(0);
        return;
    }

    const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
    if (currentLogsPage > totalPages) currentLogsPage = totalPages;

    const startIndex = (currentLogsPage - 1) * logsPerPage;
    const endIndex = startIndex + logsPerPage;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    // Response is newest-first. Appending them preserves the order.
    paginatedLogs.forEach(log => {
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

    updatePaginationControls(filteredLogs.length);
}

function updatePaginationControls(totalItems) {
    let paginationDiv = document.getElementById('pagination-controls');
    const container = logTable.closest('.table-container');
    
    if (!container) return;

    if (!paginationDiv) {
        paginationDiv = document.createElement('div');
        paginationDiv.id = 'pagination-controls';
        paginationDiv.className = 'pagination-container';
        container.appendChild(paginationDiv);
    }

    const totalPages = Math.ceil(totalItems / logsPerPage) || 1;

    paginationDiv.innerHTML = `
        <button id="prev-page" class="secondary-btn" ${currentLogsPage === 1 ? 'disabled' : ''}>Previous</button>
        <span class="page-info">Page ${currentLogsPage} of ${totalPages}</span>
        <button id="next-page" class="secondary-btn" ${currentLogsPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Next</button>
    `;

    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentLogsPage > 1) {
            currentLogsPage--;
            renderLogsTable();
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        if (currentLogsPage < totalPages) {
            currentLogsPage++;
            renderLogsTable();
        }
    });
}

// --- User Management Actions ---
function editUser(userId) {
    const user = allUsersData.find(u => u.id === userId);
    if (!user) return;
    
    currentEditUserId = userId;
    if (editUserNameInput) editUserNameInput.value = user.name;
    if (editUserRoleInput) editUserRoleInput.value = user.role || 'student';
    if (editUserDeptInput) editUserDeptInput.value = user.department || '';
    if (editUserActiveInput) editUserActiveInput.checked = user.active !== false; // Default to true if undefined
    if (editModal) editModal.classList.remove('hidden');
}

function closeEditModal() {
    if (editModal) editModal.classList.add('hidden');
    if (editForm) editForm.reset();
    currentEditUserId = null;
}

function handleEditSubmit(e) {
    e.preventDefault();
    if (!currentEditUserId) return;
    
    const newName = editUserNameInput.value;
    const newRole = editUserRoleInput ? editUserRoleInput.value : undefined;
    const newDept = editUserDeptInput ? editUserDeptInput.value : undefined;
    const newActive = editUserActiveInput ? editUserActiveInput.checked : undefined;

    if (newName && newName.trim() !== "") {
        const payload = { name: newName.trim() };
        if (newRole !== undefined) payload.role = newRole;
        if (newDept !== undefined) payload.department = newDept.trim();
        if (newActive !== undefined) payload.active = newActive;

        fetch(`${API_BASE_URL}/api/users/${currentEditUserId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                fetchAndRenderUsers();
                closeEditModal();
            } else {
                alert('Failed to update user: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(err => console.error('Error updating user:', err));
    }
}

function deleteUser(userId) {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
        fetch(`${API_BASE_URL}/api/users/${userId}`, {
            method: 'DELETE'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) fetchAndRenderUsers();
            else alert('Failed to delete user: ' + (data.error || 'Unknown error'));
        })
        .catch(err => console.error('Error deleting user:', err));
    }
}

// --- CSV Export ---
function exportLogsToCSV() {
    if (!allLogsData || allLogsData.length === 0) {
        alert("No logs available to export.");
        return;
    }

    let logsToExport = getFilteredLogsByDate();

    if (logsToExport.length === 0) {
        alert("No logs found in the selected date range.");
        return;
    }

    // Define CSV Headers
    const headers = ["Status", "User", "Role", "Department", "Tag UID", "Event Type", "Location", "Reader ID", "Time"];
    const csvRows = [headers.join(',')];

    // Map data to CSV rows
    logsToExport.forEach(log => {
        const time = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
        
        let isGranted = log.granted === true;
        if (log.status) isGranted = log.status.toLowerCase() === 'granted';
        
        const status = isGranted ? "GRANTED" : "DENIED";
        const userDisplay = log.userName || log.userId || 'Unknown';
        const uid = log.tagUid || log.tagUID || 'N/A';

        // Enclose strings in quotes to prevent issues with commas inside the data
        const row = [
            status,
            `"${userDisplay}"`,
            `"${log.role || 'N/A'}"`,
            `"${log.department || 'N/A'}"`,
            `"${uid}"`,
            `"${log.eventType || 'N/A'}"`,
            `"${log.location || 'Unknown'}"`,
            `"${log.readerId || 'N/A'}"`,
            `"${time}"`
        ];
        csvRows.push(row.join(','));
    });

    // Create Blob and download
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `access_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Analytics ---
function updateAnalyticsChart() {
    const canvas = document.getElementById('activityChart');
    if (!canvas || typeof Chart === 'undefined') return;

    let logsToProcess = getFilteredLogsByDate();

    // Calculate Data Groupings
    let grantedCount = 0;
    let deniedCount = 0;
    const countsByDate = {};
    const countsByLocation = {};

    logsToProcess.forEach(log => {
        // Group by Date
        if (log.timestamp) {
            const date = new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            countsByDate[date] = (countsByDate[date] || 0) + 1;
        }

        // Group by Status
        let isGranted = log.granted === true;
        if (log.status) isGranted = log.status.toLowerCase() === 'granted';
        if (isGranted) grantedCount++;
        else deniedCount++;

        // Group by Location
        const loc = log.location || 'Unknown';
        countsByLocation[loc] = (countsByLocation[loc] || 0) + 1;
    });

    // Update Summary Counters
    const totalScansEl = document.getElementById('total-scans-count');
    const grantedScansEl = document.getElementById('granted-scans-count');
    const deniedScansEl = document.getElementById('denied-scans-count');
    
    if (totalScansEl) totalScansEl.textContent = logsToProcess.length;
    if (grantedScansEl) grantedScansEl.textContent = grantedCount;
    if (deniedScansEl) deniedScansEl.textContent = deniedCount;

    // Prepare data for Chart.js (reverse to show chronological order left-to-right)
    const labels = Object.keys(countsByDate).reverse();
    const data = Object.values(countsByDate).reverse();

    if (activityChart) {
        activityChart.destroy(); // Destroy previous instance to prevent visual bugs
    }

    activityChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Access Scans per Day',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: '#2563eb',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });

    // --- Pie Chart (Granted vs Denied) ---
    const pieCanvas = document.getElementById('statusPieChart');
    if (pieCanvas) {

        if (statusPieChart) statusPieChart.destroy();

        statusPieChart = new Chart(pieCanvas, {
            type: 'pie',
            data: {
                labels: ['Granted', 'Denied'],
                datasets: [{
                    data: [grantedCount, deniedCount],
                    backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)'],
                    borderColor: ['#16a34a', '#dc2626'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    }

    // --- Location Chart (Scan frequency by location) ---
    const locationCanvas = document.getElementById('locationChart');
    if (locationCanvas) {
        const locLabels = Object.keys(countsByLocation);
        const locData = Object.values(countsByLocation);

        if (locationChart) locationChart.destroy();

        locationChart = new Chart(locationCanvas, {
            type: 'doughnut',
            data: {
                labels: locLabels,
                datasets: [{
                    data: locData,
                    backgroundColor: ['rgba(139, 92, 246, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(236, 72, 153, 0.8)', 'rgba(56, 189, 248, 0.8)'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    }
}

// Export functions to window for browser console testing
window.editUser = editUser;
window.deleteUser = deleteUser;
window.closeEditModal = closeEditModal;
window.exportLogsToCSV = exportLogsToCSV;