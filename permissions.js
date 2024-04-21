// permissions.js

// 권한 확인 함수
function checkPermission(req, res, next) {
    if (!req.session.isAdmin) {
        res.status(403).send('권한이 부족합니다.');
    } else {
        next();
    }
}

// 권한 업데이트 함수
function updatePermission(req, res, next) {
    // 차단된 사용자에 대한 ACL 접근 가능하도록 업데이트
    req.session.canAccessBlockedUsers = true;
    
    next();
}

module.exports = { checkPermission, updatePermission };
