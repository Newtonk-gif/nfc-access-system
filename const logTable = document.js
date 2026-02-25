const logTable = document.getElementById('log-table');

function initDashboard() {
    console.log("Dashboard Loaded. Waiting for NFC scans...");
    // Simulate real-time data for now
    setTimeout(() => addLog('GRANTED', 'Gideon Kiprop', '12:05 PM', 'Main Gate'), 2000);
}

function addLog(status, user, time, area) {
    const row = document.createElement('tr');
    const color = status === 'GRANTED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    
    row.innerHTML = `
        <td class="px-6 py-4"><span class="px-2 py-1 ${color} rounded text-xs font-bold">${status}</span></td>
        <td class="px-6 py-4 font-medium">${user}</td>
        <td class="px-6 py-4 text-gray-500">${time}</td>
        <td class="px-6 py-4 text-gray-500">${area}</td>
    `;
    logTable.prepend(row);
}