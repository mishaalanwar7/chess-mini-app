const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection - SIMPLIFIED FOR RENDER
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', timestamp: new Date().toISOString() });
});

// Initialize database tables
async function initDatabase() {
  try {
    console.log('📊 Initializing database tables...');
    
    // Create users table
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
      );
    `);

    // Create games table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        opponent VARCHAR(50) DEFAULT 'computer',
        result VARCHAR(10),
        moves TEXT,
        difficulty VARCHAR(20),
        time_control VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
}

// Test database connection
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// SIGNUP endpoint - FIXED
app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log('Signup attempt:', { username, email });

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    if (username.length < 3) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username must be at least 3 characters' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email or username already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, rating, games_played, wins, losses, draws`,
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    console.log('User created:', user.id);

    // Create token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        username: user.username 
      },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Account created successfully!',
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
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during signup' 
    });
  }
});

// LOGIN endpoint - FIXED
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Create token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        username: user.username 
      },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Login successful!',
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
    res.status(500).json({ 
      success: false, 
      error: 'Server error during login' 
    });
  }
});

// VERIFY token endpoint
app.get('/api/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');

    // Get fresh user data
    const result = await pool.query(
      'SELECT id, username, email, rating, games_played, wins, losses, draws FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Verify error:', error.message);
    res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
});

// Save game endpoint
app.post('/api/games', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { result, moves, difficulty, time_control } = req.body;

    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');

    // Save game
    await pool.query(
      `INSERT INTO games (user_id, result, moves, difficulty, time_control) 
       VALUES ($1, $2, $3, $4, $5)`,
      [decoded.userId, result, JSON.stringify(moves), difficulty, time_control]
    );

    // Update user stats
    if (result === 'win') {
      await pool.query(
        `UPDATE users 
         SET games_played = games_played + 1, 
             wins = wins + 1, 
             rating = rating + 10 
         WHERE id = $1`,
        [decoded.userId]
      );
    } else if (result === 'loss') {
      await pool.query(
        `UPDATE users 
         SET games_played = games_played + 1, 
             losses = losses + 1, 
             rating = rating - 10 
         WHERE id = $1`,
        [decoded.userId]
      );
    } else if (result === 'draw') {
      await pool.query(
        `UPDATE users 
         SET games_played = games_played + 1, 
             draws = draws + 1 
         WHERE id = $1`,
        [decoded.userId]
      );
    }

    res.json({
      success: true,
      message: 'Game saved successfully'
    });

  } catch (error) {
    console.error('Save game error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error saving game' 
    });
  }
});

// Get user stats
app.get('/api/stats', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');

    const result = await pool.query(
      `SELECT username, rating, games_played, wins, losses, draws 
       FROM users 
       WHERE id = $1`,
      [decoded.userId]
    );

    res.json({
      success: true,
      stats: result.rows[0]
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error fetching stats' 
    });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT username, rating, wins, games_played 
      FROM users 
      WHERE games_played > 0 
      ORDER BY rating DESC 
      LIMIT 10
    `);

    res.json({
      success: true,
      leaderboard: result.rows
    });

  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error fetching leaderboard' 
    });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
async function startServer() {
  const dbConnected = await testConnection();
  
  if (dbConnected) {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Open in browser: http://localhost:${PORT}`);
      console.log(`📊 Test API: http://localhost:${PORT}/api/test`);
    });
  } else {
    console.log('⚠️ Starting server without database connection...');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (without database)`);
    });
  }
}

startServer();
