const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const authRouter = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = './wiki.db';
const PERMISSIONS_FILE_PATH = './permissions.json';

// 데이터베이스 설정
const db = new sqlite3.Database(DB_PATH);

// Create database and table if not exists
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        password TEXT,
        isAdmin INTEGER DEFAULT 0,
        blocked INTEGER DEFAULT 0,
        blockedUntil TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        createdBy TEXT
    )`);

    // 최초 가입자에게 관리자 권한을 부여
    db.get('SELECT * FROM users WHERE isAdmin = 1', (err, row) => {
        if (!row) {
            db.run('INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)', ['admin', 'admin123', 1]);
        }
    });
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

// 페이지 삭제 라우트
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

// 페이지 상세 보기 라우트
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

// 로그인 라우트
app.get('/login', (req, res) => {
    res.render('login');
});

// 회원가입 라우트
app.get('/register', (req, res) => {
    res.render('register');
});

// 차단된 사용자 페이지 라우트
app.get('/blocked', (req, res) => {
    if (!req.session.isAdmin) {
        res.status(403).send('권한이 부족합니다.');
    } else {
        db.all('SELECT username FROM users WHERE blocked = 1', (err, users) => {
            if (err) {
                console.error(err.message);
                res.status(500).send('서버 오류');
            } else {
                res.render('blocked', { users });
            }
        });
    }
});

app.post('/blocked', (req, res) => {
    if (!req.session.isAdmin) {
        res.status(403).send('권한이 부족합니다.');
    } else {
        const { username, duration } = req.body;
        const blockedUntil = calculateBlockedUntil(duration);
        db.run('UPDATE users SET blocked = 1, blockedUntil = ? WHERE username = ?', [blockedUntil, username], (err) => {
            if (err) {
                console.error(err.message);
                res.status(500).send('서버 오류');
            } else {
                res.redirect('/blocked');
            }
        });
    }
});

// 권한 업데이트 라우트
app.post('/updatePermissions', (req, res) => {
    const { username, isAdmin } = req.body;
    updatePermissions(username, isAdmin);
    res.redirect('/permissions');
});

// 사용자 정보를 업데이트하고 permissions.json 파일을 업데이트하는 함수
function updatePermissions(username, isAdmin) {
    // 파일에서 기존 데이터 읽기
    let data = [];
    try {
        data = JSON.parse(fs.readFileSync(PERMISSIONS_FILE_PATH, 'utf8'));
    } catch (error) {
        console.error('permissions.json 파일을 읽는 도중 오류 발생:', error);
    }

    // 새로운 사용자 정보 추가 또는 업데이트
    const existingUserIndex = data.findIndex(user => user.username === username);
    if (existingUserIndex !== -1) {
        data[existingUserIndex].isAdmin = isAdmin;
    } else {
        data.push({ username, isAdmin });
    }

    // 파일에 데이터 쓰기
    fs.writeFile(PERMISSIONS_FILE_PATH, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error('permissions.json 파일을 쓰는 도중 오류 발생:', err);
        } else {
            console.log('권한 정보를 성공적으로 업데이트하였습니다.');
        }
    });
}

function calculateBlockedUntil(duration) {
    const now = new Date();
    switch (duration) {
        case '1second':
            return new Date(now.getTime() + 1000);
        case '2weeks':
            return new Date(now.getTime() + (2 * 7 * 24 * 60 * 60 * 1000));
        case '1month':
            return new Date(now.setMonth(now.getMonth() + 1));
        case 'permanent':
            return 'permanent';
        default:
            return null;
    }
}

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다`);
});
