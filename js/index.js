// Constants
const LOCAL_STORAGE_KEYS = {
    USERS: 'splitease_users',
    CURRENT_USER: 'splitease_current_user',
    GROUPS: 'splitease_groups',
    EXPENSES: 'splitease_expenses',
    SETTLEMENTS: 'splitease_settlements',
    NOTIFICATIONS: 'splitease_notifications'
};

// Authentication Functions
function initializeApp() {
    // Initialize local storage if needed
    const keys = Object.values(LOCAL_STORAGE_KEYS);
    keys.forEach(key => {
        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify([]));
        }
    });
}

function requireAuth() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_USER));
}

function handleLogout() {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_USER);
    window.location.href = 'login.html';
}

// Group Management Functions
function createGroup(groupData) {
    const groups = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.GROUPS)) || [];
    const newGroup = {
        id: Date.now().toString(),
        ...groupData,
        createdBy: getCurrentUser().email,
        createdAt: new Date().toISOString()
    };
    groups.push(newGroup);
    localStorage.setItem(LOCAL_STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    return newGroup;
}

function addMemberToGroup(groupId, memberEmail) {
    const groups = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.GROUPS)) || [];
    const users = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.USERS)) || [];
    
    // Validate if user exists
    if (!users.some(u => u.email === memberEmail)) {
        throw new Error('User does not exist. Please enter a registered email.');
    }

    // Find the group
    const groupIndex = groups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) {
        throw new Error('Group not found');
    }

    const group = groups[groupIndex];
    
    // Check if current user is group creator
    const currentUser = getCurrentUser();
    if (group.createdBy !== currentUser.email) {
        throw new Error('Only group creator can add members');
    }

    // Check if member already exists in group
    if (group.members.includes(memberEmail)) {
        throw new Error('Member already exists in group');
    }

    // Add member to group
    group.members.push(memberEmail);
    groups[groupIndex] = group;
    localStorage.setItem(LOCAL_STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    return group;
}

function deleteGroup(groupId) {
    // Get current groups and expenses
    let groups = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.GROUPS)) || [];
    let expenses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.EXPENSES)) || [];
    let settlements = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.SETTLEMENTS)) || [];
    
    // Find the group to delete
    const group = groups.find(g => g.id === groupId);
    if (!group) {
        throw new Error('Group not found');
    }

    // Check if user is the group creator
    const currentUser = getCurrentUser();
    if (group.createdBy !== currentUser.email) {
        throw new Error('Only the group creator can delete the group');
    }

    // Remove all expenses and settlements associated with this group
    expenses = expenses.filter(expense => expense.group !== groupId);
    settlements = settlements.filter(settlement => settlement.groupId !== groupId);
    
    // Remove the group
    groups = groups.filter(g => g.id !== groupId);
    
    // Save updated data
    localStorage.setItem(LOCAL_STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    localStorage.setItem(LOCAL_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    localStorage.setItem(LOCAL_STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));

    // Notify members about group deletion
    notifyGroupMembers(group, 'group_deleted');
}

function getGroups() {
    const currentUser = getCurrentUser();
    const groups = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.GROUPS)) || [];
    return groups.filter(group => group.members.includes(currentUser.email));
}

// Expense Management Functions
function addExpense(expenseData) {
    const expenses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.EXPENSES)) || [];
    const newExpense = {
        id: Date.now().toString(),
        ...expenseData,
        createdBy: getCurrentUser().email,
        createdAt: new Date().toISOString()
    };
    expenses.push(newExpense);
    localStorage.setItem(LOCAL_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    return newExpense;
}

function getExpenses(groupId = null) {
    const expenses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.EXPENSES)) || [];
    if (groupId) {
        return expenses.filter(expense => expense.group === groupId);
    }
    return expenses;
}

// User Management Functions
function registerUser(userData) {
    const users = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.USERS)) || [];
    if (users.some(user => user.email === userData.email)) {
        throw new Error('User already exists');
    }
    const newUser = {
        id: Date.now().toString(),
        ...userData,
        createdAt: new Date().toISOString(),
        profilePhoto: null
    };
    users.push(newUser);
    localStorage.setItem(LOCAL_STORAGE_KEYS.USERS, JSON.stringify(users));
    return newUser;
}

async function signupUser(event) {
    event.preventDefault();
    
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Signup failed');
        }

        alert('Signup successful! Please login.');
        document.getElementById('loginEmail').value = email;
        showLoginForm();
    } catch (error) {
        alert(error.message);
    }
}

async function loginUser(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Store user data in localStorage
        localStorage.setItem('currentUser', JSON.stringify(data));
        
        // Redirect to expense summary page
        window.location.href = 'expense-summary.html';
    } catch (error) {
        alert(error.message);
    }
}

function updateUserProfile(updatedProfile) {
    const users = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.USERS)) || [];
    const currentUser = getCurrentUser();
    
    if (!currentUser || !currentUser.email) {
        throw new Error('No user is currently logged in');
    }

    // Find and update user in users array
    const userIndex = users.findIndex(u => u.email === currentUser.email);
    if (userIndex === -1) {
        throw new Error('User not found');
    }

    // Update user data while preserving existing fields
    const updatedUser = {
        ...users[userIndex],
        ...updatedProfile,
        updatedAt: new Date().toISOString()
    };

    // Update in users array
    users[userIndex] = updatedUser;
    localStorage.setItem(LOCAL_STORAGE_KEYS.USERS, JSON.stringify(users));

    // Update current user session
    const sessionUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        currency: updatedUser.currency,
        language: updatedUser.language,
        profilePicture: updatedUser.profilePicture,
        emailNotifications: updatedUser.emailNotifications,
        createdAt: updatedUser.createdAt
    };
    localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_USER, JSON.stringify(sessionUser));

    return true;
}

// Settlement Functions
function calculateBalances(groupId) {
    // Get all data
    const expenses = getExpenses(groupId);
    const settlements = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.SETTLEMENTS)) || [];
    const group = getGroups().find(g => g.id === groupId);
    if (!group) return {};

    // Initialize balances for all members
    const balances = {};
    group.members.forEach(member => {
        balances[member] = 0;
    });

    // Step 1: Calculate expense balances
    expenses.forEach(expense => {
        const amount = parseFloat(expense.amount);
        const paidBy = expense.paidBy;
        const sharePerPerson = amount / group.members.length;

        // Add full amount to payer
        balances[paidBy] += amount;

        // Subtract each person's share
        group.members.forEach(member => {
            balances[member] -= sharePerPerson;
        });
    });

    // Step 2: Apply settlements
    const groupSettlements = settlements.filter(s => s.groupId === groupId);
    groupSettlements.forEach(settlement => {
        const amount = parseFloat(settlement.amount);
        // When someone pays, their balance increases (they owe less)
        balances[settlement.paidBy] += amount;
        // When someone receives, their balance decreases (they are owed less)
        balances[settlement.paidTo] -= amount;
    });

    // Round all balances to 2 decimal places
    Object.keys(balances).forEach(member => {
        balances[member] = Math.round(balances[member] * 100) / 100;
    });

    return balances;
}

function settlePayment(settlementData) {
    const settlements = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.SETTLEMENTS)) || [];
    
    // Validate settlement data
    const amount = parseFloat(settlementData.amount);
    if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid settlement amount');
    }

    // Create new settlement
    const newSettlement = {
        id: Date.now().toString(),
        ...settlementData,
        amount: amount.toFixed(2),
        status: 'completed',
        createdAt: new Date().toISOString()
    };

    // Save settlement
    settlements.push(newSettlement);
    localStorage.setItem(LOCAL_STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));

    return newSettlement;
}

function getSettlementHistory(userId = null) {
    const settlements = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.SETTLEMENTS)) || [];
    const currentUser = getCurrentUser();
    const userGroups = getGroups(); // Get groups for current user
    
    // Get all members who share groups with the current user
    const groupMembers = new Set();
    userGroups.forEach(group => {
        group.members.forEach(member => {
            groupMembers.add(member);
        });
    });

    // Filter settlements to only include those between users who share a group
    return settlements.filter(settlement => {
        // If userId is specified, filter for that specific user
        if (userId) {
            return (settlement.paidBy === userId || settlement.paidTo === userId) &&
                   (groupMembers.has(settlement.paidBy) && groupMembers.has(settlement.paidTo));
        }
        
        // Otherwise, show only settlements where both users share a group with current user
        return groupMembers.has(settlement.paidBy) && groupMembers.has(settlement.paidTo);
    });
}

// Notification Functions
function createNotification(type, message) {
    const notifications = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.NOTIFICATIONS)) || [];
    const notification = {
        id: Date.now().toString(),
        type,
        message,
        timestamp: new Date().toISOString(),
        read: false
    };
    notifications.push(notification);
    localStorage.setItem(LOCAL_STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    return notification;
}

function notifyGroupMembers(group, action) {
    const currentUser = getCurrentUser();
    let message = '';
    
    switch(action) {
        case 'group_deleted':
            message = `Group "${group.name}" has been deleted by ${currentUser.email}`;
            break;
        case 'member_added':
            message = `You have been added to group "${group.name}" by ${currentUser.email}`;
            break;
        default:
            return;
    }
    
    group.members.forEach(member => {
        if (member !== currentUser.email) {
            createNotification('group_update', message);
        }
    });
}

// UI Helper Functions
function updateUserUI() {
    const currentUser = getCurrentUser();
    const userNameElement = document.getElementById('userName');
    if (userNameElement && currentUser) {
        userNameElement.textContent = currentUser.name;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    if (requireAuth()) {
        updateUserUI();
    }
});

// Export functions for use in other files
window.SplitEase = {
    // Authentication
    requireAuth,
    getCurrentUser,
    handleLogout,
    registerUser,
    loginUser,
    
    // Group Management
    createGroup,
    getGroups,
    deleteGroup,
    addMemberToGroup,
    
    // Expense Management
    addExpense,
    getExpenses,
    
    // Settlement Management
    calculateBalances,
    settlePayment,
    getSettlementHistory,
    
    // Profile Management
    updateUserProfile,
    
    // UI Helpers
    formatCurrency,
    updateUserUI,
    
    // Notification Functions
    createNotification,
    notifyGroupMembers
}; 