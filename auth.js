const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const router = express.Router();
const DB_PATH = './wiki.db';

// 데이터베이스 설정
const db = new sqlite3.Database(DB_PATH);

// 회원가입 처리
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 패스워드 해시 생성
        const hashedPassword = await bcrypt.hash(password, 10);

        // 사용자 생성
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
            if (err) {
                console.error(err.message);
                res.status(500).send('회원가입에 실패했습니다.');
            } else {
                res.redirect('/login');
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('회원가입에 실패했습니다.');
    }
});

// 로그인 처리
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // 사용자 검색
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('로그인에 실패했습니다.');
        } else if (!row) {
            res.status(401).send('사용자가 존재하지 않습니다.');
        } else {
            // 비밀번호 확인
            const passwordMatch = await bcrypt.compare(password, row.password);
            if (passwordMatch) {
                req.session.userId = row.id; // 세션에 사용자 ID 저장
                req.session.username = row.username; // 세션에 사용자 이름 저장
                res.redirect('/pages');
            } else {
                res.status(401).send('비밀번호가 일치하지 않습니다.');
            }
        }
    });
});

// 로그아웃 처리
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            res.status(500).send('로그아웃에 실패했습니다. 다시 시도 해주세요.');
        } else {
            res.redirect('/');
        }
    });
});

module.exports = router;

