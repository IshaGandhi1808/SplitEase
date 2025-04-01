// Data structure initialization
const initializeData = () => {
    if (!localStorage.getItem('splitEaseData')) {
        localStorage.setItem('splitEaseData', JSON.stringify({
            users: [],
            groups: [],
            expenses: [],
            currentUser: null
        }));
    }
};

// Get all data
const getData = () => {
    return JSON.parse(localStorage.getItem('splitEaseData'));
};

// Save data
const saveData = (data) => {
    localStorage.setItem('splitEaseData', JSON.stringify(data));
};

// User authentication
const login = (email, password, rememberMe = false) => {
    const data = getData();
    const user = data.users.find(u => u.email === email && u.password === hashPassword(password));
    
    if (user) {
        user.isLoggedIn = true;
        user.lastLogin = new Date().toISOString();
        data.currentUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            isLoggedIn: true
        };
        saveData(data);
        return true;
    }
    return false;
};

const logout = () => {
    const data = getData();
    if (data.currentUser) {
        const user = data.users.find(u => u.id === data.currentUser.id);
        if (user) {
            user.isLoggedIn = false;
        }
        data.currentUser = null;
        saveData(data);
    }
};

const register = (userData) => {
    const data = getData();
    if (data.users.some(u => u.email === userData.email)) {
        throw new Error('Email already registered');
    }

    const newUser = {
        id: 'user_' + Date.now(),
        name: userData.name,
        email: userData.email,
        password: hashPassword(userData.password),
        createdAt: new Date().toISOString(),
        isLoggedIn: false
    };

    data.users.push(newUser);
    saveData(data);
    return true;
};

// Simple password hashing (in production, use a proper hashing library)
const hashPassword = (password) => {
    return btoa(password); // This is NOT secure, use proper hashing in production
};

// Authentication middleware
const requireAuth = () => {
    const data = getData();
    if (!data.currentUser || !data.currentUser.isLoggedIn) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
};

// Group operations with access control
const createGroup = (groupData) => {
    if (!requireAuth()) return;

    const data = getData();
    const newGroup = {
        id: 'group_' + Date.now(),
        name: groupData.name,
        description: groupData.description,
        members: groupData.members,
        createdAt: new Date().toISOString(),
        createdBy: data.currentUser.id
    };
    data.groups.push(newGroup);
    saveData(data);
    return newGroup;
};

const getGroups = () => {
    if (!requireAuth()) return [];

    const data = getData();
    return data.groups.filter(group => 
        group.members.includes(data.currentUser.email)
    );
};

// Expense operations with access control
const addExpense = (expenseData) => {
    if (!requireAuth()) return;

    const data = getData();
    const group = data.groups.find(g => g.id === expenseData.group);
    
    if (!group || !group.members.includes(data.currentUser.email)) {
        throw new Error('Unauthorized access to group');
    }

    const newExpense = {
        id: 'expense_' + Date.now(),
        groupId: expenseData.group,
        description: expenseData.description,
        amount: parseFloat(expenseData.amount),
        date: expenseData.date,
        paidBy: expenseData.paidBy,
        splitType: expenseData.splitType,
        splits: expenseData.splits || [],
        createdAt: new Date().toISOString(),
        createdBy: data.currentUser.id
    };
    data.expenses.push(newExpense);
    saveData(data);
    return newExpense;
};

const getExpenses = (groupId = null) => {
    if (!requireAuth()) return [];

    const data = getData();
    const userGroups = getGroups().map(g => g.id);
    let expenses = data.expenses;

    if (groupId) {
        expenses = expenses.filter(expense => expense.groupId === groupId);
    }

    return expenses.filter(expense => 
        userGroups.includes(expense.groupId)
    );
};

// Balance calculations with access control
const calculateBalances = () => {
    if (!requireAuth()) return {};

    const data = getData();
    const balances = {};
    const userGroups = getGroups();
    
    // Initialize balances for all members in user's groups
    userGroups.forEach(group => {
        group.members.forEach(member => {
            if (!balances[member]) {
                balances[member] = 0;
            }
        });
    });

    // Calculate balances from all expenses in user's groups
    getExpenses().forEach(expense => {
        const group = userGroups.find(g => g.id === expense.groupId);
        if (!group) return;

        const memberCount = group.members.length;
        const sharePerPerson = expense.amount / memberCount;

        // Add full amount to payer
        balances[expense.paidBy] += expense.amount;

        // Subtract share from each member
        group.members.forEach(member => {
            balances[member] -= sharePerPerson;
        });
    });

    return balances;
};

// Initialize data when the file loads
initializeData(); 