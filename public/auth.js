function attemptLogin(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Check credentials
    if (email === "admin@254.ac.ke" && password === "1234") {
        console.log("Login successful!");
        
        // Hide Login, Show Dashboard
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard-screen').classList.remove('hidden');

        // Check if the dashboard function exists before calling it
        if (typeof initDashboard === "function") {
            initDashboard(); 
        } else {
            console.error("Error: initDashboard function not found in dashboard.js");
        }
    } else {
        document.getElementById('error-msg').style.display = 'block';
    }
}

function handleLogout() {
    console.log("Logging out...");
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('login-form').reset();
    document.getElementById('error-msg').style.display = 'none';
}