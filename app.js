const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const authRouter = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = './wiki.db';

// 데이터베이스 설정
const db = new sqlite3.Database(DB_PATH);

// Create database and table if not exists
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        createdBy TEXT
    )`, (err) => {
        if (err) {
            console.error(err.message);
        } else {
            // createdBy 컬럼이 존재하지 않을 경우에만 추가
            db.run(`ALTER TABLE pages ADD COLUMN createdBy TEXT DEFAULT ''`, (err) => {
                if (err) {
                    console.error(err.message);
                }
            });
        }
    });
});

// 미들웨어 설정
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

// 라우트 설정
app.get('/', (req, res) => {
    res.redirect('/pages');
});

app.use('/', authRouter);

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

// 게시물 상세 페이지 라우팅
app.get('/pages/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM pages WHERE id = ?', [id], (err, page) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('서버 오류');
        } else if (!page) {
            res.status(404).send('게시물을 찾을 수 없습니다.');
        } else {
            res.render('page', { page, username: req.session.username, isAdmin: req.session.isAdmin });
        }
    });
});

// 게시물 삭제 라우팅
app.post('/pages/:id/delete', (req, res) => {
    if (!req.session.userId) {
        res.status(403).send('로그인이 필요합니다.');
    } else {
        const id = req.params.id;
        db.run('DELETE FROM pages WHERE id = ?', [id], (err) => {
            if (err) {
                console.error(err.message);
                res.status(500).send('서버 오류');
            } else {
                res.redirect('/pages');
            }
        });
    }
});

// 로그인 페이지 라우팅
app.get('/login', (req, res) => {
    res.render('login');
});

// 회원가입 페이지 라우팅
app.get('/register', (req, res) => {
    res.render('register');
});

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다`);
});
