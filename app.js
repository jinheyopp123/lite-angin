const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const authRouter = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = './wiki.db';

// Database setup
const db = new sqlite3.Database(DB_PATH);

// Create database and table if not exists
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        nickname TEXT
    )`);
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Routes
app.get('/', (req, res) => {
    res.redirect('/pages');
});

app.use('/', authRouter);

app.get('/profile', (req, res) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        res.render('profile', { username: req.session.username, nickname: req.session.nickname });
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

// Server
app.listen(PORT, () => {
    console.log(`0.0.0.0:${PORT}에서 실행 중...`);
});
