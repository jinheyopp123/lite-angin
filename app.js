const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = './wiki.db';
const SALT_ROUNDS = 10;

// 데이터베이스 설정
const db = new sqlite3.Database(DB_PATH);

// Create database and table if not exists
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        isAdmin INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        createdBy TEXT
    )`);
});

// 미들웨어 설정
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // secure 옵션이 false일 경우 HTTP에서도 쿠키를 사용할 수 있습니다.
}));

// 라우트 설정
app.get('/', (req, res) => {
    res.redirect('/pages');
});

app.get('/pages', (req, res) => {
    db.all('SELECT * FROM pages', (err, pages) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('서버 오류');
        } else {
            res.render('pages', { pages, username: req.session.username, isAdmin: req.session.isAdmin });
        }
    });
});

app.post('/pages', (req, res) => {
    if (!req.session.userId) {
        res.status(403).send('로그인이 필요합니다.');
    } else {
        const { title, content } = req.body;
        const createdBy = req.session.username;
        db.run('INSERT INTO pages (title, content, createdBy) VALUES (?, ?, ?)', [title, content, createdBy], (err) => {
            if (err) {
                console.error(err.message);
                res.status(500).send('서버 오류');
            } else {
                res.redirect('/pages');
            }
        });
    }
});

app.post('/pages/:id/delete', (req, res) => {
    const userId = req.session.userId;
    const { id } = req.params;
    db.get('SELECT createdBy FROM pages WHERE id = ?', id, (err, page) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('서버 오류');
        } else if (!page) {
            res.status(404).send('페이지를 찾을 수 없습니다.');
        } else if (req.session.isAdmin || req.session.username === page.createdBy) {
            db.run('DELETE FROM pages WHERE id = ?', id, (err) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send('서버 오류');
                } else {
                    res.redirect('/pages');
                }
            });
        } else {
            res.status(403).send('해당 페이지를 삭제할 권한이 없습니다.');
        }
    });
});

app.get('/pages/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM pages WHERE id = ?', id, (err, page) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('서버 오류');
        } else if (!page) {
            res.status(404).send('페이지를 찾을 수 없습니다.');
        } else {
            const canDelete = req.session.isAdmin || req.session.username === page.createdBy;
            res.render('page', { page, canDelete });
        }
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', username, (err, user) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('서버 오류');
        } else if (!user) {
            res.status(404).send('사용자를 찾을 수 없습니다.');
        } else {
            bcrypt.compare(password, user.password, (err, result) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send('서버 오류');
                } else if (!result) {
                    res.status(401).send('비밀번호가 일치하지 않습니다.');
                } else {
                    req.session.userId = user.id;
                    req.session.username = user.username;
                    req.session.isAdmin = user.isAdmin === 1;
                    res.redirect('/pages');
                }
            });
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('서버 오류');
        } else {
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], (err) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send('서버 오류');
                } else {
                    res.redirect('/login');
                }
            });
        }
    });
});

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다`);
});
