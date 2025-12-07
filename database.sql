-- Create database (run this first in your PostgreSQL client)
CREATE DATABASE chess_game;

-- Connect to the database (in psql: \c chess_game)
-- Then run the following:

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);

-- Insert sample data for testing (optional)
INSERT INTO users (username, email, password, rating) VALUES
    ('grandmaster', 'gm@chess.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK4YpF5dXHZvLzB6Xc7QKq3YJQzW2', 2500),
    ('chessplayer', 'player@chess.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK4YpF5dXHZvLzB6Xc7QKq3YJQzW2', 1800),
    ('beginner', 'beginner@chess.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK4YpF5dXHZvLzB6Xc7QKq3YJQzW2', 1200)
ON CONFLICT (email) DO NOTHING;

-- View tables
SELECT * FROM users;
SELECT * FROM games;

-- Test query
SELECT COUNT(*) as total_users FROM users;
