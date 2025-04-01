const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// app.use(express.static('public'));

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
    
    // Create users table if not exists
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            profile_picture VARCHAR(255),
            preferred_currency VARCHAR(10) DEFAULT 'INR',
            preferred_language VARCHAR(10) DEFAULT 'en',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    db.query(createTableQuery, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
            return;
        }
        console.log('Users table created or already exists');
        
        // Create grouplist table
        const createGroupsTable = `
            CREATE TABLE IF NOT EXISTS grouplist (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        `;
        
        db.query(createGroupsTable, (err) => {
            if (err) {
                console.error('Error creating grouplist table:', err);
                return;
            }
            console.log('Grouplist table created or already exists');
            
            // Create group_members table
            const createGroupMembersTable = `
                CREATE TABLE IF NOT EXISTS group_members (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    group_id INT,
                    user_id INT,
                    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (group_id) REFERENCES grouplist(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE KEY unique_group_member (group_id, user_id)
                )
            `;
            
            db.query(createGroupMembersTable, (err) => {
                if (err) {
                    console.error('Error creating group_members table:', err);
                    return;
                }
                console.log('Group members table created or already exists');
            });
        });
    });

    // Create notifications table
    const createNotificationsTable = `
        CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            type VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            group_id INT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (group_id) REFERENCES grouplist(id)
        )
    `;

    db.query(createNotificationsTable, (err) => {
        if (err) {
            console.error('Error creating notifications table:', err);
            return;
        }
        console.log('Notifications table created or already exists');
        
        // Create expenses table
        const createExpensesTable = `
            CREATE TABLE IF NOT EXISTS expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                group_id INT NOT NULL,
                description VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                paid_by INT NOT NULL,
                split_type ENUM('EQUAL', 'PERCENTAGE', 'EXACT') NOT NULL DEFAULT 'EQUAL',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES grouplist(id),
                FOREIGN KEY (paid_by) REFERENCES users(id)
            )
        `;
        
        db.query(createExpensesTable, (err) => {
            if (err) {
                console.error('Error creating expenses table:', err);
                return;
            }
            console.log('Expenses table created or already exists');
            
            // Create expense_shares table for storing individual shares
            const createExpenseSharesTable = `
                CREATE TABLE IF NOT EXISTS expense_shares (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    expense_id INT NOT NULL,
                    user_id INT NOT NULL,
                    share_amount DECIMAL(10,2) NOT NULL,
                    share_percentage DECIMAL(5,2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (expense_id) REFERENCES expenses(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE KEY unique_expense_user (expense_id, user_id)
                )
            `;
            
            db.query(createExpenseSharesTable, (err) => {
                if (err) {
                    console.error('Error creating expense shares table:', err);
                    return;
                }
                console.log('Expense shares table created or already exists');

                // Create settlements table
                const createSettlementsTable = `
                    CREATE TABLE IF NOT EXISTS settlements (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        group_id INT NOT NULL,
                        paid_by INT NOT NULL,
                        paid_to INT NOT NULL,
                        amount DECIMAL(10,2) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (group_id) REFERENCES grouplist(id),
                        FOREIGN KEY (paid_by) REFERENCES users(id),
                        FOREIGN KEY (paid_to) REFERENCES users(id)
                    )
                `;
                
                db.query(createSettlementsTable, (err) => {
                    if (err) {
                        console.error('Error creating settlements table:', err);
                        return;
                    }
                    console.log('Settlements table created or already exists');
                });
            });
        });
    });
});

// Signup endpoint
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const checkUser = 'SELECT * FROM users WHERE email = ?';
        db.query(checkUser, [email], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (results.length > 0) {
                return res.status(400).json({ error: 'User already exists' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert new user
            const insertUser = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
            db.query(insertUser, [name, email, hashedPassword], (err, result) => {
                if (err) {
                    console.error('Error creating user:', err);
                    return res.status(500).json({ error: 'Failed to create user' });
                }

                res.status(201).json({
                    message: 'User created successfully',
                    userId: result.insertId
                });
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
app.post('/api/login', (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const query = 'SELECT * FROM users WHERE email = ?';
        db.query(query, [email], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (results.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = results[0];

            // Compare password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Send user data (excluding password)
            const userData = {
                id: user.id,
                name: user.name,
                email: user.email,
                profile_picture: user.profile_picture,
                preferred_currency: user.preferred_currency,
                preferred_language: user.preferred_language
            };

            res.json(userData);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Get user's expense summary
// app.get('/api/expense-summary/:userId', (req, res) => {
//     try {
//         const userId = req.params.userId;

//         // Get user's groups with correct member count and balance
//         const groupsQuery = `
//             SELECT 
//                 g.*,
//                 (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
//                 u.name as creator_name,
//                 (
//                     SELECT COALESCE(SUM(
//                         CASE 
//                             WHEN e.paid_by = ? THEN e.amount - (e.amount / gm_count.member_count)
//                             ELSE -(e.amount / gm_count.member_count)
//                         END
//                     ), 0)
//                     FROM expenses e
//                     JOIN (
//                         SELECT group_id, COUNT(*) as member_count 
//                         FROM group_members 
//                         GROUP BY group_id
//                     ) gm_count ON e.group_id = gm_count.group_id
//                     WHERE e.group_id = g.id
//                 ) as balance
//             FROM grouplist g
//             INNER JOIN group_members gm ON g.id = gm.group_id
//             LEFT JOIN users u ON g.created_by = u.id
//             WHERE gm.user_id = ?
//             GROUP BY g.id
//         `;

//         db.query(groupsQuery, [userId, userId], (err, groups) => {
//             if (err) {
//                 console.error('Error fetching groups:', err);
//                 return res.status(500).json({ error: 'Failed to fetch groups' });
//             }

//             // Get expenses for these groups
//             const groupIds = groups.map(g => g.id);
//             if (groupIds.length === 0) {
//                 return res.json({
//                     groups: [],
//                     totalBalance: 0,
//                     expenses: [],
//                     settlements: []
//                 });
//             }

//             const expensesQuery = `
//                 SELECT 
//                     e.*, 
//                     g.name as group_name, 
//                     u.name as paid_by_name,
//                     (SELECT COUNT(*) FROM group_members WHERE group_id = e.group_id) as member_count
//                 FROM expenses e
//                 INNER JOIN grouplist g ON e.group_id = g.id
//                 INNER JOIN users u ON e.paid_by = u.id
//                 WHERE e.group_id IN (?)
//                 ORDER BY e.created_at DESC
//             `;

//             db.query(expensesQuery, [groupIds], (err, expenses) => {
//                 if (err) {
//                     console.error('Error fetching expenses:', err);
//                     return res.status(500).json({ error: 'Failed to fetch expenses' });
//                 }

//                 // Calculate total balance
//                 let totalBalance = 0;
//                 expenses.forEach(expense => {
//                     const perPersonShare = parseFloat(expense.amount) / expense.member_count;
//                     if (expense.paid_by === parseInt(userId)) {
//                         // If user paid, they should get back others' shares
//                         totalBalance += parseFloat(expense.amount) - perPersonShare;
//                     } else {
//                         // If someone else paid, user owes their share
//                         totalBalance -= perPersonShare;
//                     }
//                 });

//                 res.json({
//                     groups,
//                     totalBalance: Math.round(totalBalance * 100) / 100,
//                     expenses,
//                     settlements: []
//                 });
//             });
//         });
//     } catch (error) {
//         console.error('Server error:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

app.get('/api/expense-summary/:userId', (req, res) => {
    try {
        const userId = req.params.userId;

        // Get user's groups with correct member count and balance
        const groupsQuery = `
            SELECT 
                g.*,
                (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
                u.name as creator_name,
                (
                    SELECT COALESCE(SUM(
                        CASE 
                            WHEN e.paid_by = ? THEN e.amount - (e.amount / gm_count.member_count)
                            ELSE -(e.amount / gm_count.member_count)
                        END
                    ), 0)
                    FROM expenses e
                    JOIN (
                        SELECT group_id, COUNT(*) as member_count 
                        FROM group_members 
                        GROUP BY group_id
                    ) gm_count ON e.group_id = gm_count.group_id
                    WHERE e.group_id = g.id
                ) as balance
            FROM grouplist g
            INNER JOIN group_members gm ON g.id = gm.group_id
            LEFT JOIN users u ON g.created_by = u.id
            WHERE gm.user_id = ?
            GROUP BY g.id
        `;

        db.query(groupsQuery, [userId, userId], (err, groups) => {
            if (err) {
                console.error('Error fetching groups:', err);
                return res.status(500).json({ error: 'Failed to fetch groups' });
            }

            const groupIds = groups.map(g => g.id);
            if (groupIds.length === 0) {
                return res.json({
                    groups: [],
                    totalBalance: 0,
                    totalOwed: 0,
                    totalOwing: 0,
                    expenses: [],
                    settlements: []
                });
            }

            const expensesQuery = `
                SELECT 
                    e.*, 
                    g.name as group_name, 
                    u.name as paid_by_name,
                    (SELECT COUNT(*) FROM group_members WHERE group_id = e.group_id) as member_count
                FROM expenses e
                INNER JOIN grouplist g ON e.group_id = g.id
                INNER JOIN users u ON e.paid_by = u.id
                WHERE e.group_id IN (?)
                ORDER BY e.created_at DESC
            `;

            db.query(expensesQuery, [groupIds], (err, expenses) => {
                if (err) {
                    console.error('Error fetching expenses:', err);
                    return res.status(500).json({ error: 'Failed to fetch expenses' });
                }

                const settlementsQuery = `
                    SELECT * FROM settlements 
                    WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)
                `;

                db.query(settlementsQuery, [userId], (err, settlements) => {
                    if (err) {
                        console.error('Error fetching settlements:', err);
                        return res.status(500).json({ error: 'Failed to fetch settlements' });
                    }

                    let totalOwed = 0;
                    let totalOwing = 0;

                    expenses.forEach(expense => {
                        const perPersonShare = parseFloat(expense.amount) / expense.member_count;
                        if (expense.paid_by === parseInt(userId)) {
                            totalOwing += parseFloat(expense.amount) - perPersonShare;
                        } else {
                            totalOwed += perPersonShare;
                        }
                    });

                    settlements.forEach(settlement => {
                        if (settlement.paid_by == userId) {
                            totalOwed -= settlement.amount;
                        } else if (settlement.paid_to == userId) {
                            totalOwing -= settlement.amount;
                        }
                    });

                    const totalBalance = totalOwing - totalOwed;

                    res.json({
                        groups,
                        totalBalance: Math.round(totalBalance * 100) / 100,
                        totalOwed: Math.round(totalOwed * 100) / 100,
                        totalOwing: Math.round(totalOwing * 100) / 100,
                        expenses,
                        settlements
                    });
                });
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Create a new group
app.post('/api/groups', (req, res) => {
    try {
        const { name, description, created_by, members } = req.body;

        // First, create the group
        const createGroupQuery = 'INSERT INTO grouplist (name, description, created_by, total_balance) VALUES (?, ?, ?, 0)';
        db.query(createGroupQuery, [name, description, created_by], (err, result) => {
            if (err) {
                console.error('Error creating group:', err);
                return res.status(500).json({ error: 'Failed to create group' });
            }

            const groupId = result.insertId;

            // Add creator as a member
            const creatorMemberQuery = 'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)';
            db.query(creatorMemberQuery, [groupId, created_by], (err) => {
                if (err) {
                    console.error('Error adding creator as member:', err);
                    return res.status(500).json({ error: 'Failed to add group creator' });
                }

                // If additional members are provided, add them
                if (members && members.length > 0) {
                    const memberValues = members.map(memberId => [groupId, memberId]);
                    const addMembersQuery = 'INSERT INTO group_members (group_id, user_id) VALUES ?';
                    
                    db.query(addMembersQuery, [memberValues], (err) => {
                        if (err) {
                            console.error('Error adding members:', err);
                            return res.status(500).json({ error: 'Failed to add some members' });
                        }

                        res.status(201).json({
                            message: 'Group created successfully',
                            groupId: groupId
                        });
                    });
                } else {
                    res.status(201).json({
                        message: 'Group created successfully',
                        groupId: groupId
                    });
                }
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all users for member selection
app.get('/api/users/search', (req, res) => {
    try {
        const searchTerm = req.query.q || '';
        
        if (!searchTerm) {
            return res.status(400).json({ 
                error: 'Please enter an email address to search' 
            });
        }

        const isEmail = searchTerm.includes('@');
        
        let query;
        let searchPattern;
        
        if (isEmail) {
            // If searching by email, do exact match
            query = 'SELECT id, name, email, profile_picture FROM users WHERE email = ?';
            searchPattern = searchTerm;
        } else {
            // If searching by name, do partial match
            query = `
                SELECT id, name, email, profile_picture 
                FROM users 
                WHERE name LIKE ? OR email LIKE ?
                LIMIT 10
            `;
            searchPattern = `%${searchTerm}%`;
        }
        
        const queryParams = isEmail ? [searchPattern] : [searchPattern, searchPattern];
        
        db.query(query, queryParams, (err, results) => {
            if (err) {
                console.error('Error searching users:', err);
                return res.status(500).json({ 
                    error: 'Error searching for users. Please try again.' 
                });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ 
                    error: 'No user found with this email address' 
                });
            }
            
            res.json(results);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Server error. Please try again later.' 
        });
    }
});

// Get group details
app.get('/api/groups/:groupId', (req, res) => {
    try {
        const groupId = req.params.groupId;
        const query = `
            SELECT g.*, 
                   u.name as creator_name,
                   COUNT(DISTINCT gm.user_id) as member_count
            FROM grouplist g
            LEFT JOIN users u ON g.created_by = u.id
            LEFT JOIN group_members gm ON g.id = gm.group_id
            WHERE g.id = ?
            GROUP BY g.id
        `;
        
        db.query(query, [groupId], (err, results) => {
            if (err) {
                console.error('Error fetching group:', err);
                return res.status(500).json({ error: 'Failed to fetch group details' });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ error: 'Group not found' });
            }
            
            // Get group members
            const membersQuery = `
                SELECT u.id, u.name, u.email, u.profile_picture
                FROM group_members gm
                JOIN users u ON gm.user_id = u.id
                WHERE gm.group_id = ?
            `;
            
            db.query(membersQuery, [groupId], (err, members) => {
                if (err) {
                    console.error('Error fetching members:', err);
                    return res.status(500).json({ error: 'Failed to fetch group members' });
                }
                
                const groupData = results[0];
                groupData.members = members;
                
                res.json(groupData);
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update group details
app.put('/api/groups/:groupId', (req, res) => {
    try {
        const groupId = req.params.groupId;
        const { name, description, userId } = req.body;

        // First check if user is the creator
        const checkCreatorQuery = 'SELECT created_by FROM grouplist WHERE id = ?';
        db.query(checkCreatorQuery, [groupId], (err, results) => {
            if (err) {
                console.error('Error checking group creator:', err);
                return res.status(500).json({ error: 'Failed to verify group creator' });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: 'Group not found' });
            }

            if (results[0].created_by !== userId) {
                return res.status(403).json({ error: 'Only group creator can update group details' });
            }

            // Update group details
            const updateQuery = 'UPDATE grouplist SET name = ?, description = ? WHERE id = ?';
            db.query(updateQuery, [name, description, groupId], (err) => {
                if (err) {
                    console.error('Error updating group:', err);
                    return res.status(500).json({ error: 'Failed to update group' });
                }

                res.json({ message: 'Group updated successfully' });
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add member to group
app.post('/api/groups/:groupId/members', (req, res) => {
    try {
        const groupId = req.params.groupId;
        const { userId, creatorId } = req.body;

        // Check if user is the creator
        const checkCreatorQuery = 'SELECT g.created_by, g.name, u.name as creator_name FROM grouplist g JOIN users u ON g.created_by = u.id WHERE g.id = ?';
        db.query(checkCreatorQuery, [groupId], (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to verify group creator' });
            }

            if (results[0].created_by !== creatorId) {
                return res.status(403).json({ error: 'Only group creator can add members' });
            }

            const groupName = results[0].name;
            const creatorName = results[0].creator_name;

            // Add new member
            const addMemberQuery = 'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)';
            db.query(addMemberQuery, [groupId, userId], (err) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ error: 'User is already a member of this group' });
                    }
                    return res.status(500).json({ error: 'Failed to add member' });
                }

                // Create notification for the new member
                const notificationMessage = `${creatorName} has added you to the group "${groupName}"`;
                const createNotificationQuery = 'INSERT INTO notifications (user_id, type, message, group_id) VALUES (?, ?, ?, ?)';
                db.query(createNotificationQuery, [userId, 'GROUP_INVITATION', notificationMessage, groupId], (err) => {
                    if (err) {
                        console.error('Error creating notification:', err);
                    }
                });

                res.json({ message: 'Member added successfully' });
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's notifications
app.get('/api/notifications/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const query = `
            SELECT n.*, g.name as group_name 
            FROM notifications n
            LEFT JOIN grouplist g ON n.group_id = g.id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
        `;

        db.query(query, [userId], (err, notifications) => {
            if (err) {
                console.error('Error fetching notifications:', err);
                return res.status(500).json({ error: 'Failed to fetch notifications' });
            }

            res.json(notifications);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark notification as read
app.put('/api/notifications/:notificationId', (req, res) => {
    try {
        const notificationId = req.params.notificationId;
        const query = 'UPDATE notifications SET is_read = TRUE WHERE id = ?';

        db.query(query, [notificationId], (err) => {
            if (err) {
                console.error('Error updating notification:', err);
                return res.status(500).json({ error: 'Failed to update notification' });
            }

            res.json({ message: 'Notification marked as read' });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove member from group
app.delete('/api/groups/:groupId/members/:memberId', (req, res) => {
    try {
        const { groupId, memberId } = req.params;
        const { creatorId } = req.body;

        // Check if user is the creator
        const checkCreatorQuery = 'SELECT created_by FROM grouplist WHERE id = ?';
        db.query(checkCreatorQuery, [groupId], (err, results) => {
            if (err) {
                console.error('Error checking creator:', err);
                return res.status(500).json({ error: 'Failed to verify group creator' });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: 'Group not found' });
            }

            if (parseInt(results[0].created_by) !== parseInt(creatorId)) {
                return res.status(403).json({ error: 'Only group creator can remove members' });
            }

            // Check if trying to remove the creator
            if (parseInt(memberId) === parseInt(results[0].created_by)) {
                return res.status(400).json({ error: 'Cannot remove group creator' });
            }

            // Check if member exists in group
            const checkMemberQuery = 'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?';
            db.query(checkMemberQuery, [groupId, memberId], (err, memberResults) => {
                if (err) {
                    console.error('Error checking member:', err);
                    return res.status(500).json({ error: 'Failed to verify group member' });
                }

                if (memberResults.length === 0) {
                    return res.status(404).json({ error: 'Member not found in group' });
                }

                // Remove member
                const removeMemberQuery = 'DELETE FROM group_members WHERE group_id = ? AND user_id = ?';
                db.query(removeMemberQuery, [groupId, memberId], (err) => {
                    if (err) {
                        console.error('Error removing member:', err);
                        return res.status(500).json({ error: 'Failed to remove member' });
                    }

                    res.json({ message: 'Member removed successfully' });
                });
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete group
app.delete('/api/groups/:groupId', (req, res) => {
    try {
        const groupId = req.params.groupId;
        // const { userId } = req.body;
        const userId = req.body.userId; 

        // Check if user is the creator
        const checkCreatorQuery = 'SELECT created_by FROM grouplist WHERE id = ?';
        db.query(checkCreatorQuery, [groupId], (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to verify group creator' });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: 'Group not found' });
            }

            if (parseInt(results[0].created_by) !== parseInt(userId)) {
                return res.status(403).json({ error: 'Only group creator can delete the group' });
            }

            // First delete notifications
            const deleteNotificationsQuery = 'DELETE FROM notifications WHERE group_id = ?';
            db.query(deleteNotificationsQuery, [groupId], (err) => {
                if (err) {
                    console.error('Error deleting notifications:', err);
                    return res.status(500).json({ error: 'Failed to delete group notifications' });
                }
                
                // Delete related expense shares
                const deleteSharesQuery = 'DELETE FROM expense_shares WHERE expense_id IN (SELECT id FROM expenses WHERE group_id = ?)';
                db.query(deleteSharesQuery, [groupId], (err) => {
                    if (err) {
                        console.error('Error deleting expense shares:', err);
                        return res.status(500).json({ error: 'Failed to delete group expense shares' });
                    }

                    // Then delete expenses
                    const deleteExpensesQuery = 'DELETE FROM expenses WHERE group_id = ?';
                    db.query(deleteExpensesQuery, [groupId], (err) => {
                        if (err) {
                            console.error('Error deleting expenses:', err);
                            return res.status(500).json({ error: 'Failed to delete group expenses' });
                        }

                        // Then delete settlements
                        const deleteSettlementsQuery = 'DELETE FROM settlements WHERE group_id = ?';
                        db.query(deleteSettlementsQuery, [groupId], (err) => {
                            if (err) {
                                console.error('Error deleting settlements:', err);
                                return res.status(500).json({ error: 'Failed to delete group settlements' });
                            }

                            // Then delete group members
                            const deleteGroupMembersQuery = 'DELETE FROM group_members WHERE group_id = ?';
                            db.query(deleteGroupMembersQuery, [groupId], (err) => {
                                if (err) {
                                    console.error('Error deleting group members:', err);
                                    return res.status(500).json({ error: 'Failed to delete group members' });
                                }

                            // Finally delete the group
                            // const deleteGroupQuery = 'DELETE FROM grouplist WHERE id = ?';
                            // db.query(deleteGroupQuery, [groupId], (err) => {
                            //     if (err) {
                            //         console.error('Error deleting group:', err);
                            //         return res.status(500).json({ error: 'Failed to delete group' });
                            //     }

                            //     res.json({ message: 'Group deleted successfully' });
                            // });
                            db.query('DELETE FROM grouplist WHERE id = ? AND created_by = ?', [groupId, userId], (err) => {
                                if (err) {
                                    return res.status(500).json({ error: 'Failed to delete group' });
                                }
                                res.status(200).json({ message: 'Group deleted successfully' });
                            });
                        });
                    });
                });
            });
        });
    });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new expense
app.post('/api/expenses', (req, res) => {
    try {
        const { groupId, description, amount, paidBy, splitType = 'EQUAL', shares } = req.body;

        // First create the expense
        const createExpenseQuery = `
            INSERT INTO expenses (group_id, description, amount, paid_by, split_type)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        db.query(createExpenseQuery, [groupId, description, amount, paidBy, splitType], (err, result) => {
            if (err) {
                console.error('Error creating expense:', err);
                return res.status(500).json({ error: 'Failed to create expense' });
            }

            const expenseId = result.insertId;

            // Then add expense shares
            const shareValues = shares.map(share => [expenseId, share.userId, share.amount, share.percentage || null]);
            const addSharesQuery = `
                INSERT INTO expense_shares (expense_id, user_id, share_amount, share_percentage)
                VALUES ?
            `;

            db.query(addSharesQuery, [shareValues], (err) => {
                if (err) {
                    console.error('Error adding expense shares:', err);
                    return res.status(500).json({ error: 'Failed to add expense shares' });
                }

                 // ✅ Update group total balance after expense
                const updateBalanceQuery = `
                UPDATE grouplist 
                SET total_balance = total_balance + ? 
                WHERE id = ?
            `;

            db.query(updateBalanceQuery, [amount, groupId], (err) => {
                if (err) {
                    console.error('Error updating total balance:', err);
                }
            });


                // Create notifications for all members except the payer
                const getGroupMembersQuery = `
                    SELECT gm.user_id, u.name as user_name, g.name as group_name 
                    FROM group_members gm
                    JOIN users u ON gm.user_id = u.id
                    JOIN grouplist g ON gm.group_id = g.id
                    WHERE gm.group_id = ? AND gm.user_id != ?
                `;

                db.query(getGroupMembersQuery, [groupId, paidBy], (err, members) => {
                    if (err) {
                        console.error('Error fetching group members:', err);
                        return res.status(500).json({ error: 'Failed to create notifications' });
                    }

                    // Get payer's name
                    const getPayerQuery = 'SELECT name FROM users WHERE id = ?';
                    db.query(getPayerQuery, [paidBy], (err, payerResult) => {
                        if (err || !payerResult.length) {
                            console.error('Error fetching payer details:', err);
                            return res.status(500).json({ error: 'Failed to create notifications' });
                        }

                        const payerName = payerResult[0].name;
                        const groupName = members[0]?.group_name;

                        // Create notifications for each member
                        const notificationValues = members.map(member => [
                            member.user_id,
                            'NEW_EXPENSE',
                            `${payerName} added an expense of ₹${amount} in "${groupName}"`,
                            groupId
                        ]);

                        if (notificationValues.length > 0) {
                            const createNotificationsQuery = `
                                INSERT INTO notifications (user_id, type, message, group_id)
                                VALUES ?
                            `;

                            db.query(createNotificationsQuery, [notificationValues], (err) => {
                                if (err) {
                                    console.error('Error creating notifications:', err);
                                }
                            });
                        }

                        res.status(201).json({
                            message: 'Expense added successfully',
                            expenseId: expenseId
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get expense details
app.get('/api/expenses/:expenseId', (req, res) => {
    try {
        const expenseId = req.params.expenseId;
        const query = `
            SELECT e.*, 
                   u.name as paid_by_name,
                   g.name as group_name
            FROM expenses e
            JOIN users u ON e.paid_by = u.id
            JOIN grouplist g ON e.group_id = g.id
            WHERE e.id = ?
        `;

        db.query(query, [expenseId], (err, results) => {
            if (err) {
                console.error('Error fetching expense:', err);
                return res.status(500).json({ error: 'Failed to fetch expense details' });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: 'Expense not found' });
            }

            const expense = results[0];

            // Get expense shares
            const sharesQuery = `
                SELECT es.*, u.name as user_name
                FROM expense_shares es
                JOIN users u ON es.user_id = u.id
                WHERE es.expense_id = ?
            `;

            db.query(sharesQuery, [expenseId], (err, shares) => {
                if (err) {
                    console.error('Error fetching expense shares:', err);
                    return res.status(500).json({ error: 'Failed to fetch expense shares' });
                }

                expense.shares = shares;
                res.json(expense);
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get group expenses
app.get('/api/groups/:groupId/expenses', (req, res) => {
    try {
        const groupId = req.params.groupId;
        const query = `
            SELECT e.*, 
                   u.name as paid_by_name,
                   COUNT(DISTINCT gm.user_id) as member_count
            FROM expenses e
            JOIN users u ON e.paid_by = u.id
            JOIN group_members gm ON e.group_id = gm.group_id
            WHERE e.group_id = ?
            GROUP BY e.id
            ORDER BY e.created_at DESC
        `;

        db.query(query, [groupId], (err, expenses) => {
            if (err) {
                console.error('Error fetching expenses:', err);
                return res.status(500).json({ error: 'Failed to fetch expenses' });
            }

            res.json(expenses);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get group settlements
app.get('/api/groups/:groupId/settlements', (req, res) => {
    try {
        const groupId = req.params.groupId;
        const query = `
            SELECT s.*, 
                   u1.name as paid_by_name,
                   u2.name as paid_to_name
            FROM settlements s
            JOIN users u1 ON s.paid_by = u1.id
            JOIN users u2 ON s.paid_to = u2.id
            WHERE s.group_id = ?
            ORDER BY s.created_at DESC
        `;

        db.query(query, [groupId], (err, settlements) => {
            if (err) {
                console.error('Error fetching settlements:', err);
                return res.status(500).json({ error: 'Failed to fetch settlements' });
            }

            res.json(settlements);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get group balance summary
app.get('/api/groups/:groupId/balance', (req, res) => {
    try {
        const groupId = req.params.groupId;
        const query = `
            SELECT 
                gm.user_id,
                u.name as user_name,
                COALESCE(
                    SUM(
                        CASE 
                            WHEN e.paid_by = gm.user_id THEN e.amount - (e.amount / member_count.count)
                            WHEN e.group_id = ? THEN -(e.amount / member_count.count)
                            ELSE 0
                        END
                    ), 0
                ) as balance
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            LEFT JOIN expenses e ON e.group_id = gm.group_id
            JOIN (
                SELECT group_id, COUNT(*) as count
                FROM group_members
                GROUP BY group_id
            ) member_count ON gm.group_id = member_count.group_id
            WHERE gm.group_id = ?
            GROUP BY gm.user_id, u.name
        `;

        db.query(query, [groupId, groupId], (err, balances) => {
            if (err) {
                console.error('Error fetching balances:', err);
                return res.status(500).json({ error: 'Failed to fetch balances' });
            }

            res.json(balances);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new settlement
// app.post('/api/settlements', (req, res) => {
//     try {
//         let { groupId, paidBy, paidTo, amount } = req.body;

//         // Validate input
//         amount = parseFloat(amount);

//         if (!groupId || !paidBy || !paidTo || !amount || amount <= 0 || isNaN(amount)) {
//             return res.status(400).json({ error: 'Invalid settlement data' });
//         }

//         console.log("🔹 Step 1: Settlement request received", { groupId, paidBy, paidTo, amount });

//         // First check if both users are in the group
//         const checkMembersQuery = `
//             SELECT user_id FROM group_members 
//             WHERE group_id = ? AND user_id IN (?, ?)
//         `;

//         db.query(checkMembersQuery, [groupId, paidBy, paidTo], (err, members) => {
//             if (err) {
//                 console.error('Error checking members:', err);
//                 return res.status(500).json({ error: 'Failed to verify group members' });
//             }

//             if (members.length !== 2) {
//                 return res.status(400).json({ error: 'Both users must be members of the group' });
//             }

//             console.log("✅ Step 2: Both users are members of the group");

//              // 🔹 Ensure `expense_splits` entries exist for both users
//             const insertExpenseSplitQuery = `
//                 INSERT INTO expense_splits (group_id, user_id, balance) 
//                 VALUES (?, ?, 0), (?, ?, 0) 
//                 ON DUPLICATE KEY UPDATE balance = VALUES(balance);
//             `;

//             db.query(insertExpenseSplitQuery, [groupId, paidBy, groupId, paidTo], (err) => {
//                 if (err) {
//                     console.error('❌ Error inserting expense_splits entries:', err);
//                     return res.status(500).json({ error: 'Failed to initialize balances' });
//                 }

//                 console.log("✅ Step 3: `expense_splits` entries ensured");


//             // Create settlement
//             const createSettlementQuery = `
//                 INSERT INTO settlements (group_id, paid_by, paid_to, amount)
//                 VALUES (?, ?, ?, ?)
//             `;

//             db.query(createSettlementQuery, [groupId, paidBy, paidTo, amount], (err, result) => {
//                 if (err) {
//                     console.error('Error creating settlement:', err);
//                     return res.status(500).json({ error: 'Failed to create settlement' });
//                 }

//                 console.log("✅ Step 4: Settlement recorded");

                

//                  // Update balance for paidBy (payer)
//                 //  const updatePayerBalanceQuery = `
//                 //     UPDATE expense_splits SET balance = balance - ? WHERE user_id = ? AND group_id = ?
//                 // `;

//                 // db.query(updatePayerBalanceQuery, [amount, paidBy, groupId], (err) => {
//                 //     if (err) {
//                 //         console.error('Error updating payer balance:', err);
//                 //         return res.status(500).json({ error: 'Failed to update payer balance' });
//                 //     }

//                 //     console.log("✅ Step 5: Payer balance updated");

//                     // Update balance for paidTo (receiver)
//                     // const updateReceiverBalanceQuery = `
//                     //     UPDATE expense_splits SET balance = balance + ? WHERE user_id = ? AND group_id = ?
//                     // `;

//                     // db.query(updateReceiverBalanceQuery, [amount, paidTo, groupId], (err) => {
//                     //     if (err) {
//                     //         console.error('Error updating receiver balance:', err);
//                     //         return res.status(500).json({ error: 'Failed to update receiver balance' });
//                     //     }

//                     //     console.log("✅ Step 6: Receiver balance updated");

                   
                    
//                 // 🔹 INSERT IF NOT EXISTS (Ensure balance entry exists before updating)
//                     const ensureBalanceQuery = `
//                         INSERT INTO expense_splits (group_id, user_id, balance)
//                         SELECT ?, ?, 0 FROM DUAL
//                         WHERE NOT EXISTS (
//                             SELECT 1 FROM expense_splits WHERE group_id = ? AND user_id = ?
//                         );
//                     `;

//                     db.query(ensureBalanceQuery, [groupId, paidBy, groupId, paidBy], (err) => {
//                         if (err) {
//                             console.error('❌ Error ensuring payer balance:', err);
//                         }
//                     });

//                     db.query(ensureBalanceQuery, [groupId, paidTo, groupId, paidTo], (err) => {
//                         if (err) {
//                             console.error('❌ Error ensuring receiver balance:', err);
//                         }
//                     });

//                     console.log("✅ Step 5: Ensured balance entry exists for both users");


//                     const checkBalanceQuery = `
//                         SELECT user_id, balance FROM expense_splits 
//                         WHERE group_id = ? AND user_id IN (?, ?)
//                     `;
            
//                     db.query(checkBalanceQuery, [groupId, paidBy, paidTo], (err, balances) => {
//                         if (err) {
//                             console.error('❌ Error fetching pre-update balances:', err);
//                         } else {
//                             console.log("🔹 Pre-Update Balances:", balances);
//                         }

//                     // 🔹 STEP 3: DEBUGGING KE LIYE `console.log()` ADD KARO
//                     console.log("🟡 DEBUG: Before updating balances");
//                     console.log("Group ID:", groupId);
//                     console.log("Paid By (Payer):", paidBy);
//                     console.log("Paid To (Receiver):", paidTo);
//                     console.log("Settlement Amount:", amount);


//                     const updateBalancesQuery = `
//                         UPDATE expense_splits
//                         SET balance = CASE
//                             WHEN user_id = ? THEN balance - ?
//                             WHEN user_id = ? THEN balance + ?
//                         END
//                         WHERE group_id = ? AND user_id IN (?, ?);
//                     `;

//             db.query(updateBalancesQuery, [paidBy, amount, paidTo, amount, groupId, paidBy, paidTo], (err) => {
//                 if (err) {
//                     console.error('❌ Error updating balances:', err);
//                     return res.status(500).json({ error: 'Failed to update balances' });
//                 }

//                 console.log("✅ Balances updated successfully");


//                         // ✅ ✅ FETCH UPDATED BALANCES ✅ ✅
//                         // const fetchBalancesQuery = `
//                         //     SELECT user_id, balance FROM expense_splits 
//                         //     WHERE group_id = ? AND user_id IN (?, ?)
//                         // `;

//                         // db.query(checkBalanceQuery, [groupId, paidBy, paidTo], (err, balances) => {
//                         //     if (err) {
//                         //         console.error('Error fetching updated balances:', err);
//                         //         return res.status(500).json({ error: 'Failed to fetch updated balances' });
//                         //     }

//                              // Update payer's total_balance (subtract settlement amount)
//                             const updatePayerBalanceQuery = `
//                                 UPDATE users SET total_balance = total_balance + ? WHERE id = ?
//                             `;

//                             // Update receiver's total_balance (add settlement amount)
//                             const updateReceiverBalanceQuery = `
//                                 UPDATE users SET total_balance = total_balance - ? WHERE id = ?
//                             `;

//                             db.query(updatePayerBalanceQuery, [amount, paidBy], (err) => {
//                                 if (err) {
//                                     console.error('❌ Error updating payer balance:', err);
//                                 } else {
//                                     console.log(`✅ Payer (User ID: ${paidBy}) balance updated successfully!`);
//                                 }
//                             });

//                             db.query(updateReceiverBalanceQuery, [amount, paidTo], (err) => {
//                                 if (err) {
//                                     console.error('❌ Error updating receiver balance:', err);
//                                 } else {
//                                     console.log(`✅ Receiver (User ID: ${paidTo}) balance updated successfully!`);
//                                 }
//                             });

//                              // Fetch updated balances
//                             const fetchUpdatedBalancesQuery  = `
//                                 SELECT id, total_balance FROM users WHERE id IN (?, ?)
//                             `;

//                             db.query(fetchUpdatedBalancesQuery , [paidBy, paidTo], (err, balances) => {
//                                 if (err) {
//                                     console.error('❌ Error fetching updated balances:', err);
//                                     return res.status(500).json({ error: 'Failed to fetch updated balances' });
//                                 }

//                                 let updatedBalances = {};
//                                 balances.forEach(user => {
//                                     updatedBalances[user.id] = user.total_balance;
//                                 });
            

//                                 console.log("✅ Step 7: Updated balances fetched", updatedBalances);

//                                 // Create notification for the recipient
//                                 const getPayerNameQuery = 'SELECT name FROM users WHERE id = ?';
//                                 db.query(getPayerNameQuery, [paidBy], (err, payerResult) => {
//                                     if (!err && payerResult.length > 0) {
//                                         const notificationQuery = `
//                                             INSERT INTO notifications (user_id, type, message, group_id)
//                                             VALUES (?, 'SETTLEMENT', ?, ?)
//                                         `;
//                                         const message = `${payerResult[0].name} marked a settlement of ₹${amount}`;
//                                         db.query(notificationQuery, [paidTo, message, groupId]);
//                                     }
//                                 });

//                                 res.status(201).json({
//                                     message: 'Settlement recorded successfully',
//                                     settlementId: result.insertId,
//                                     updatedBalances
//                                     });
//                                 });
//                             });
//                         // });
//                     });
//                 });
//             });
//         });
//     } catch (error) {
//         console.error('Server error:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

// Record a settlement
app.post('/api/settlements', (req, res) => {
    try {
        let { groupId, paidBy, paidTo, amount } = req.body;

        // Validate input
        amount = parseFloat(amount);
        if (!groupId || !paidBy || !paidTo || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Invalid settlement data' });
        }

        console.log("🔹 Step 1: Settlement request received", { groupId, paidBy, paidTo, amount });

        // Check if both users are in the group
        const checkMembersQuery = `
            SELECT user_id FROM group_members 
            WHERE group_id = ? AND user_id IN (?, ?)
        `;

        db.query(checkMembersQuery, [groupId, paidBy, paidTo], (err, members) => {
            if (err) {
                console.error('Error checking members:', err);
                return res.status(500).json({ error: 'Failed to verify group members' });
            }

            if (members.length !== 2) {
                return res.status(400).json({ error: 'Both users must be members of the group' });
            }

            console.log("✅ Step 2: Both users are members of the group");

            // Insert settlement record
            const createSettlementQuery = `
                INSERT INTO settlements (group_id, paid_by, paid_to, amount)
                VALUES (?, ?, ?, ?)
            `;

            db.query(createSettlementQuery, [groupId, paidBy, paidTo, amount], (err, result) => {
                if (err) {
                    console.error('Error creating settlement:', err);
                    return res.status(500).json({ error: 'Failed to create settlement' });
                }

                console.log("✅ Step 3: Settlement recorded");

                // Fetch updated balances from `expense-summary` API
                const fetchUpdatedBalancesQuery = `
                    SELECT e.*, 
                        (SELECT COUNT(*) FROM group_members WHERE group_id = e.group_id) as member_count
                    FROM expenses e
                    WHERE e.group_id = ?
                `;

                db.query(fetchUpdatedBalancesQuery, [groupId], (err, expenses) => {
                    if (err) {
                        console.error('Error fetching expenses:', err);
                        return res.status(500).json({ error: 'Failed to fetch updated balances' });
                    }

                    let totalOwed = 0;
                    let totalOwing = 0;

                    expenses.forEach(expense => {
                        const perPersonShare = parseFloat(expense.amount) / expense.member_count;
                        if (expense.paid_by === parseInt(paidBy)) {
                            totalOwing += parseFloat(expense.amount) - perPersonShare;
                        } else {
                            totalOwed += perPersonShare;
                        }
                    });

                    // Apply settlements impact
                    const settlementsQuery = `SELECT * FROM settlements WHERE group_id = ?`;
                    db.query(settlementsQuery, [groupId], (err, settlements) => {
                        if (err) {
                            console.error('Error fetching settlements:', err);
                            return res.status(500).json({ error: 'Failed to fetch settlements' });
                        }

                        settlements.forEach(settlement => {
                            if (settlement.paid_by == paidBy) {
                                totalOwed -= settlement.amount;
                            } else if (settlement.paid_to == paidBy) {
                                totalOwing -= settlement.amount;
                            }
                        });

                        const totalBalance = totalOwing - totalOwed;

                        // Create notification for recipient
                        const getPayerNameQuery = 'SELECT name FROM users WHERE id = ?';
                        db.query(getPayerNameQuery, [paidBy], (err, payerResult) => {
                            if (!err && payerResult.length > 0) {
                                const notificationQuery = `
                                    INSERT INTO notifications (user_id, type, message, group_id)
                                    VALUES (?, 'SETTLEMENT', ?, ?)
                                `;
                                const message = `${payerResult[0].name} marked a settlement of ₹${amount}`;
                                db.query(notificationQuery, [paidTo, message, groupId]);
                            }
                        });

                        res.status(201).json({
                            message: 'Settlement recorded successfully',
                            settlementId: result.insertId,
                            updatedBalances: {
                                totalBalance: Math.round(totalBalance * 100) / 100,
                                totalOwed: Math.round(totalOwed * 100) / 100,
                                totalOwing: Math.round(totalOwing * 100) / 100
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch user profile
app.get('/profile', (req, res) => {
    try {
        const { userId } = req.query;
        db.query('SELECT name, email, profile_picture FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) {
                console.error('Database error:', err); // ✅ ERROR PRINT
                return res.status(500).json({ error: err.message });
            }
            if (results.length === 0) return res.status(404).json({ error: 'User not found' });
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Server error:', error); // ✅ ERROR PRINT
        res.status(500).json({ error: error.message });
    }
});

// Update profile (name & photo)
app.put('/profile', (req, res) => {
    try {
        const { userId, name, profilePhoto } = req.body;

        const updateQuery = 'UPDATE users SET name = ?, profile_picture = ? WHERE id = ?';
        db.query(updateQuery, [name, profilePhoto, userId], (err) => {
            if (err) {
                console.error('Error updating user profile:', err);
                return res.status(500).json({ error: 'Server error' });
            }
               
            res.json({ message: 'Profile updated successfully' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload profile photo (new photo add karega)
app.post('/profile/photo', async (req, res) => {
    try {
        const { userId, profilePhoto } = req.body;
        const updatephoto ='UPDATE users SET profile_picture = ? WHERE id = ?';
        db.query( updatephoto,[profilePhoto, userId]);
        res.json({ message: 'Profile photo uploaded successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Change password

app.put('/profile/password', async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;

    // Fetch current hashed password from DB
    db.query('SELECT password FROM users WHERE id = ?', [userId], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hashedPasswordFromDB = results[0].password;

        // Compare current password
        const passwordMatch = await bcrypt.compare(currentPassword, hashedPasswordFromDB);
        if (!passwordMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password in DB
        db.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId], (updateErr, result) => {
            if (updateErr) {
                console.error('Database update error:', updateErr);
                return res.status(500).json({ error: 'Server error' });
            }
            if (result.affectedRows === 0) {
                return res.status(400).json({ error: 'Password update failed' });
            }

            res.json({ message: 'Password updated successfully' });
        });
    });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 