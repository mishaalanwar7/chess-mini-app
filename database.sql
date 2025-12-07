-- Create database
CREATE DATABASE chess_game;

-- Connect to database
\c chess_game;

-- Create users table
CREATE TABLE users (
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

-- Create games table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    opponent VARCHAR(50) DEFAULT 'computer',
    result VARCHAR(10),
    moves TEXT,
    difficulty VARCHAR(20),
    time_control VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_games_user_id ON games(user_id);
CREATE INDEX idx_users_rating ON users(rating DESC);
