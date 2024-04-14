const express = require('express');
const sqlite3 = require('sqlite3').verbose();

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
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));

// Routes
app.get('/', (req, res) => {
    res.redirect('/pages');
});

// Get all pages
app.get('/pages', (req, res) => {
    db.all('SELECT * FROM pages', (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.render('pages', { pages: rows });
        }
    });
});

// Get single page
app.get('/pages/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM pages WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else if (!row) {
            res.status(404).send('Page not found');
        } else {
            res.render('page', { page: row });
        }
    });
});

// Create new page
app.post('/pages', (req, res) => {
    const { title, content } = req.body;
    db.run('INSERT INTO pages (title, content) VALUES (?, ?)', [title, content], (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.redirect('/pages');
        }
    });
});

// Delete page
app.post('/pages/:id/delete', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM pages WHERE id = ?', [id], (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.redirect('/pages');
        }
    });
});

// Server
app.listen(PORT, () => {
    console.log(`0.0.0.0:${PORT}에서 실행 중...`);
});
