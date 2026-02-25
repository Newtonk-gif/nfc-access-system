const loginForm = document.getElementById('login-form');
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const errorMsg = document.getElementById('error-msg');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Logic: Eventually, this will fetch from the Node.js backend
    if (email === "admin@jkuat.ac.ke" && password === "1234") {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        initDashboard(); // Function inside dashboard.js
    } else {
        errorMsg.classList.remove('hidden');
    }
});

function handleLogout() {
    location.reload(); 
}