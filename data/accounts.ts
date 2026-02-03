/**
 * VIP Accounts Data
 * Danh sách tài khoản VIP - Mỗi account 1 dòng để dễ thêm/sửa
 * 
 * Cấu trúc: { username: string, password: string, displayName?: string }
 */

export interface VIPAccount {
    username: string;
    password: string;
    displayName?: string;
}

// ============ DANH SÁCH TÀI KHOẢN VIP ============
// Thêm mỗi tài khoản 1 dòng theo format: { username: "...", password: "...", displayName: "..." },

export const VIP_ACCOUNTS: VIPAccount[] = [
    { username: "admin", password: "Hoaithanh@2", displayName: "Quản trị viên" },
    { username: "admin", password: "admin", displayName: "GV" },
    { username: "admin1", password: "admin", displayName: "Giáo viên" },
    { username: "tranhuyenthnd@gmail.com", password: "123456", displayName: "GV1" },
    { username: "haloch2010@gmail.com", password: "123456", displayName: "GV2" },
    { username: "baubinna@gmail.com", password: "123456", displayName: "GV3" },
    { username: "ducoanhdangthao@gmail.com", password: "123456", displayName: "GV4" },
    { username: "khoi5nct@gmail.com", password: "123456", displayName: "GV5" },
    { username: "huynhbaodang.py@gmail.com", password: "123456", displayName: "GV6" },
    { username: "baotrang95@gmail.com", password: "123456", displayName: "GV7" },
    { username: "nhuthanh12111995@gmail.com", password: "123456", displayName: "GV8" },
    { username: "ngthuynhi2011@gmail.com", password: "123456", displayName: "GV9" },
    { username: "hieuthao.hbc@gmail.com", password: "123456", displayName: "GV10" },
    { username: "0889727208qa@gmail.com", password: "123456", displayName: "GV11" },
    { username: "duonganhthu93@gmail.com", password: "123456", displayName: "GV12" },
    { username: "nguyenthaiminh196@gmail.com", password: "123456", displayName: "GV13" },
    { username: "Viethungnvmt@gmail.com", password: "123456", displayName: "GV14" },
    { username: "phi.tt13.h27@gmail.com", password: "SKKN100", displayName: "GV15" },
    { username: "nguyenhuucss@gmail.com", password: "SKKN100", displayName: "GV16" },
    { username: "thuongtin.ledat@gmail.com", password: "SKKN100", displayName: "GV17" },
    { username: "hanh.tran@ngs.edu.vn", password: "123456", displayName: "GV" }
];

// ============ HÀM XÁC THỰC ============

export const authenticateUser = (username: string, password: string): VIPAccount | null => {
    const account = VIP_ACCOUNTS.find(
        acc => acc.username === username && acc.password === password
    );
    return account || null;
};

// Lưu trạng thái đăng nhập vào localStorage
export const saveLoginState = (account: VIPAccount) => {
    localStorage.setItem('vip_user', JSON.stringify({
        username: account.username,
        displayName: account.displayName || account.username,
        loginTime: new Date().toISOString()
    }));
};

export const getLoggedInUser = (): { username: string; displayName: string } | null => {
    const data = localStorage.getItem('vip_user');
    if (data) {
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }
    return null;
};

export const logout = () => {
    localStorage.removeItem('vip_user');
};
























