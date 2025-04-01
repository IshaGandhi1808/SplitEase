// Navigation Component
class Navigation {
    static init() {
        const navElement = document.getElementById('mainNav');
        if (!navElement) return;

        const currentUser = SplitEase.getCurrentUser();
        const currentPath = window.location.pathname;

        navElement.innerHTML = `
            <nav class="navbar navbar-expand-lg navbar-light bg-light">
                <div class="container">
                    <a class="navbar-brand" href="index.html" onclick="window.location.href='index.html'; return false;" 
                       style="cursor: pointer; text-decoration: none; font-weight: bold; color: #2c3e50;">SplitEase</a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            ${currentUser ? `
                                <li class="nav-item">
                                    <a class="nav-link ${currentPath.includes('create-group') ? 'active' : ''}" 
                                       href="create-group.html">Create Group</a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link ${currentPath.includes('add-expense') ? 'active' : ''}" 
                                       href="add-expense.html">Add Expense</a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link ${currentPath.includes('expense-summary') ? 'active' : ''}" 
                                       href="expense-summary.html">Summary</a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link ${currentPath.includes('settle-up') ? 'active' : ''}" 
                                       href="settle-up.html">Settle Up</a>
                                </li>
                                <li class="nav-item dropdown">
                                    <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" id="userDropdown" 
                                       role="button" data-bs-toggle="dropdown">
                                        ${currentUser.profilePicture ? 
                                            `<img src="${currentUser.profilePicture}" alt="${currentUser.name}" 
                                                  class="rounded-circle me-2" width="24" height="24" 
                                                  style="object-fit: cover;">` :
                                            `<i class="fas fa-user-circle me-2"></i>`}
                                        <span id="userName">${currentUser.name || 'User'}</span>
                                    </a>
                                    <ul class="dropdown-menu dropdown-menu-end">
                                        <li>
                                            <a class="dropdown-item ${currentPath.includes('profile') ? 'active' : ''}" 
                                               href="profile.html">Profile</a>
                                        </li>
                                        <li>
                                            <a class="dropdown-item ${currentPath.includes('settlement-history') ? 'active' : ''}" 
                                               href="settlement-history.html">Settlement History</a>
                                        </li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li>
                                            <a class="dropdown-item" href="#" onclick="SplitEase.handleLogout()">
                                                Logout
                                            </a>
                                        </li>
                                    </ul>
                                </li>
                            ` : `
                                <li class="nav-item">
                                    <a class="nav-link ${currentPath.includes('login') ? 'active' : ''}" 
                                       href="login.html">Login</a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link ${currentPath.includes('signup') ? 'active' : ''}" 
                                       href="signup.html">Sign Up</a>
                                </li>
                            `}
                        </ul>
                    </div>
                </div>
            </nav>
        `;
    }
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    Navigation.init();
}); 