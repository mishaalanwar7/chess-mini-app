const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chess-master-secret-key';

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to PostgreSQL:', err);
    } else {
        console.log('✅ Connected to PostgreSQL database');
        release();
    }
});

// Create tables if they don't exist
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                rating INTEGER DEFAULT 1500,
                games_played INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                draws INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS games (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                opponent VARCHAR(50) DEFAULT 'computer',
                result VARCHAR(10),
                moves TEXT,
                difficulty VARCHAR(20),
                time_control VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Database tables created/verified');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

initializeDatabase();

// API Routes

// Signup endpoint
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        // Check if user already exists
        const userCheck = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await pool.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, rating',
            [username, email, hashedPassword]
        );
        
        const user = result.rows[0];
        
        // Create JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                rating: user.rating
            },
            token
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Find user
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        // Create JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                rating: user.rating,
                games_played: user.games_played,
                wins: user.wins,
                losses: user.losses,
                draws: user.draws
            },
            token
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify token endpoint
app.get('/api/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Get user data
        const result = await pool.query(
            'SELECT id, username, email, rating FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ user: result.rows[0] });
        
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Save game endpoint
app.post('/api/games', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const { result, moves, difficulty, time_control } = req.body;
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Save game
        await pool.query(
            'INSERT INTO games (user_id, result, moves, difficulty, time_control) VALUES ($1, $2, $3, $4, $5)',
            [decoded.userId, result, JSON.stringify(moves), difficulty, time_control]
        );
        
        // Update user stats
        if (result === 'win') {
            await pool.query(
                'UPDATE users SET games_played = games_played + 1, wins = wins + 1, rating = rating + 10 WHERE id = $1',
                [decoded.userId]
            );
        } else if (result === 'loss') {
            await pool.query(
                'UPDATE users SET games_played = games_played + 1, losses = losses + 1, rating = rating - 10 WHERE id = $1',
                [decoded.userId]
            );
        } else if (result === 'draw') {
            await pool.query(
                'UPDATE users SET games_played = games_played + 1, draws = draws + 1 WHERE id = $1',
                [decoded.userId]
            );
        }
        
        res.json({ message: 'Game saved successfully' });
        
    } catch (error) {
        console.error('Save game error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user stats endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const result = await pool.query(
            'SELECT username, rating, games_played, wins, losses, draws FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ stats: result.rows[0] });
        
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Get leaderboard endpoint
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT username, rating, wins, games_played 
            FROM users 
            WHERE games_played > 0 
            ORDER BY rating DESC 
            LIMIT 10
        `);
        
        res.json({ leaderboard: result.rows });
        
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
});
