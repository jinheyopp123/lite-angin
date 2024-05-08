const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const authRouter = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = './wiki.db';

// 데이터베이스 설정
const db = new sqlite3.Database(DB_PATH);

// 최초 가입자에게 기본 권한을 부여
db.get('SELECT * FROM users ORDER BY id ASC LIMIT 1', (err, row) => {
    if (!row) {
        bcrypt.hash('admin123', 10, (err, hashedPassword) => {
            if (err) {
                console.error('비밀번호 해싱 실패:', err);
            } else {
                db.run('INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)', ['first_user', hashedPassword, 1], (err) => {  //*여기에서 first_user을 자기가 하고싶은걸로 하고 가입하여야 합니다.
                    if (err) {
                        console.error('사용자 추가 실패:', err);
                    } else {
                        console.log('첫 번째 사용자가 성공적으로 추가되었습니다.');
                    }
                });
            }
        });
    }
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
    res.render('blocked');
});

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다`);
});
