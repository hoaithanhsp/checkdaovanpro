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
    isTrial?: boolean;
}

// ============ DANH SÁCH TÀI KHOẢN VIP ============
// Thêm mỗi tài khoản 1 dòng theo format: { username: "...", password: "...", displayName: "..." },

// ============ TÀI KHOẢN DÙNG THỬ ============
export const TRIAL_ACCOUNT: VIPAccount = {
    username: "TRANHOAITHANH",
    password: "SKKN123",
    displayName: "Dùng Thử",
    isTrial: true
};

export const VIP_ACCOUNTS: VIPAccount[] = [
    TRIAL_ACCOUNT,
    { username: "admin", password: "admin123", displayName: "Quản trị viên" },
    { username: "trannguyenyennhi19@gmail.com", password: "SKKN100", name: "GV" },
    { username: "phuong87gdktpl@gmail.com", password: "SKKN100", name: "GV" },
    { username: "caibaptron15391@gmail.com", password: "SKKN100", name: "GV" },
    { username: "caoxuanque2025@gmail.com", password: "SKKN100", name: "GV" },
    { username: "anhtuyet195@gmail.com", password: "SKKN100", name: "GV" },
    { username: "tantai421995@gmail.com", password: "SKKN100", name: "GV" },
    { username: "quyducbn34@gmail.com", password: "SKKN100", name: "GV" },
    { username: "lienspdiak37@gmail.com", password: "SKKN100", name: "GV" },
    { username: "nhutuan91982@gmail.com", password: "SKKN100", name: "GV" },
    { username: "dinhphuongthaogvth@gmail.com", password: "SKKN100", name: "GV" },
    { username: "nguyenquocvuongthpt@gmail.com", password: "SKKN100", name: "GV" },
    { username: "Vulananhk56a1s@gmail.com", password: "SKKN100", name: "GV" },
    { username: "Hanghangg93@gmail.com", password: "SKKN100", name: "GV" },
    { username: "huongthachkhoi@gmail.com", password: "SKKN100", name: "GV" },
    { username: "tranthikimngan198787@gmail.com", password: "SKKN100", name: "GV" },
    { username: "thuquyen0606@gmail.com", password: "SKKN100", name: "GV" },
    { username: "chitalinh26@gmail.com", password: "SKKN100", name: "GV" },
    { username: "Ntpngoc@gmail.com", password: "SKKN100", name: "GV" },
    { username: "hasonha75@gmail.com", password: "SKKN100", name: "GV" },
    { username: "nguyenthithanhthuy24491@gmail.com", password: "SKKN100", name: "GV" },
    { username: "ngocmai2304bm@gmail.com", password: "SKKN100", name: "GV" },
    { username: "nguyentrieuduong015@gmail.com", password: "SKKN100", name: "GV" },
    { username: "ledunghlls@gmail.com", password: "SKKN100", name: "GV" },
    { username: "quangthu1912013@gmail.com", password: "SKKN100", name: "GV" },
    { username: "bonmat177@gmail.com", password: "SKKN100", name: "GV" },
    { username: "phanlamkhang2015@gmail.com", password: "SKKN100", name: "GV" },
    { username: "hienluongcb@gmail.com", password: "SKKN100", name: "GV" },
    { username: "phuongtramng039@gmail.com", password: "SKKN100", name: "GV" },
    { username: "trangnana1992@gmail.com", password: "SKKN100", name: "GV" },
    { username: "tuongvi110589@gmail.com", password: "SKKN100", name: "GV" },
    { username: "nguyenthithanhthuy24491@gmail.com", password: "SKKN100", name: "GV" },
    { username: "xiengng@gmail.com", password: "SKKN100", name: "GV" },
    { username: "mypyty@gmail.com", password: "SKKN100", name: "GV" },
    { username: "0345tung@gmail.com", password: "SKKN100", name: "GV" },
    { username: "tuyet207k37dia@gmail.com", password: "SKKN100", name: "GV" },
    { username: "Thienmygia@gmail. Com", password: "SKKN100", name: "GV" },
    { username: "Nonguyen01655011252@gmail.com", password: "SKKN100", name: "GV" },
    { username: "caothithuong83@gmail.com", password: "SKKN100", name: "GV" },
    { username: "Anminh70@gmail.com", password: "SKKN100", name: "GV" },
    { username: "thanhvan0716@gmail.com", password: "SKKN100", name: "GV" },
    { username: "Phuongichichi97@gmail.com", password: "SKKN100", name: "GV" },
    { username: "nttha.yt@gmail.com", password: "SKKN100", name: "GV" },
    { username: "Dophuong1795@gmail.com", password: "SKKN100", name: "GV" },
    { username: "tranhoangbach185@gmail.com", password: "SKKN100", name: "GV" },
    { username: "thanhdien24@gmail.com", password: "SKKN100", name: "GV" },
    { username: "ntnh.q7@gmail.com", password: "SKKN100", name: "GV" },
    { username: "giangtintpk@gmail.com", password: "SKKN100", name: "GV" },
    { username: "uyennhi.edu.vn@gmail.com", password: "SKKN100", name: "GV" },
    { username: "hongto267@gmail.com", password: "SKKN100", name: "GV" },
    { username: "Viethungnvmt@gmail.com", password: "SKKN100", name: "GV" },
    { username: "quanghuyitlt@gmail.com", password: "SKKN100", name: "GV" },
    { username: "luanvuthptnguyenvancu.edu.vn@gmail.com", password: "SKKN100", name: "GV" },
    { username: "Thuyduyencms@gmail.com", password: "SKKN100", name: "GV" },
    { username: "minhhien.tg1997@gmail.com", password: "SKKN100", name: "GV" },
    { username: "leminhtrangc3@gmail.com", password: "SKKN100", name: "GV" },
    { username: "dangthitrang.hlam@hatinh.edu.vn", password: "SKKN100", name: "GV" },
    { username: "petnguyenhoang@gmail.com", password: "SKKN100", name: "GV" },
    { username: "thanhdonguyen0683@gmail.com", password: "SKKN100", name: "GV" },
    { username: "tuyetnga270985@gmail.com", password: "SKKN100", name: "GV" },
    { username: "phamthomndlc@gmail.com", password: "SKKN100", name: "GV" },
    { username: "Minhntnqp@tu.sgdbinhduong.edu.vn", password: "SKKN100", name: "GV" },
    { username: "buithihoan511@gmail.com", password: "SKKN100", name: "GV" },
    { username: "mr.ducletrong@gmail.com", password: "SKKN100", name: "GV" },
    { username: "ngocthptgialoc@gmail.com", password: "SKKN100", name: "GV" },
    { username: "nhungphamphys@gmail.com", password: "SKKN100", name: "GV" },
    { username: "cathiquynh0797@gmail.com", password: "SKKN100", name: "GV" },
    { username: "ngoctramanh121@gmail.com", password: "SKKN100", name: "GV" },
    { username: "vothituyetmai1203@gmail.com", password: "SKKN100", name: "GV" },
    { username: "lengochongdao.gvth@gmail.com", password: "SKKN100", name: "GV" },
    { username: "ntphuong.vts@gmail.com", password: "SKKN100", name: "GV" },
    { username: "hkquoc.thptthuanhoa@cantho.edu.vn", password: "SKKN100", name: "GV" },
    { username: "Caothithanhhoai44@gmail.com", password: "SKKN100", name: "GV" },
    { username: "ho.lan.huong87@gmail.com", password: "SKKN100", name: "GV" },
    { username: "gamlienhong@gmail.com", password: "SKKN100", name: "GV" },
    { username: "linhthuy985@gmail.com", password: "SKKN100", name: "GV" },
    { username: "khoahoctunhien92@gmail.com", password: "SKKN100", name: "GV" },
    { username: "huonggiangpc89@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "hieumanhdoan@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "ntphucthao@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "soccoi222@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "nlv232.nk@gmail.com", password: "SKKN100", name: "GV" },
    { username: "photonbmt@gmail.com", password: "SKKN100", name: "GV" },
    { username: "quockieng111996@gmail.com", password: "SKKN100", name: "GV" },
    { username: "truonghau2410@gmail.com", password: "SKKN100", name: "GV" },
    { username: "hoaquyen238@gmail.com", password: "SKKN100", name: "GV" },
    { username: "nongthtu.c3bache@quangninh.edu.vn", password: "SKKN100", name: "GV" },
    { username: "havo.280788@gmail.com", password: "SKKN100", name: "GV" },
    { username: "linh.tonghoang@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "Thuhang86cva@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "trananhtuuyen@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "phamhuulinh8787@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "tientuandmc@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "h.quynhpham15@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "lephutuangtcc@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "Txphua3nd2018@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "yenngoc532@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "nguyenthihuyen2988@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "hasonha75@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "thanhdieukt27691@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "phtai.c2ntay.nh@khanhhoa.edu.vn", password: "SKKN100", displayName: "GV" },
    { username: "diemthuan.truongtanthuan@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "dangtranbinh123@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "ntntuyet0281@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "hunglekieu@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "Anhnguyet166@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "ducanhhagi45@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "aubinhdinh2023@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "nguyenthanh.k31@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "kieuanh.s2hh@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "nguyenquangloc.td@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "lethanhxuantukiet@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "lebaochau18042005@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "maria.doantrang@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "mcuongvt82@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "tranthimylinh151174@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "tranhuyenthnd@gmail.com", password: "123456", displayName: "GV" },
    { username: "phamthihiep.kd@elc.vn", password: "SKKN100", displayName: "GV" },
    { username: "Buihuusonkx@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "nhantrannsg@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "chutrinhtayninh@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "Xhuong91@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "Hoangha220488@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "ngthuynhi2011gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "duonghangdtntls@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "nguyenthoa2306dn@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "nguyenphuongnhi1807@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "hatran105.hp@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "Nguyenlinh16594@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "nguyenhang27101986@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "lananh98bnn@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "trananhtuuyen@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "linh.tonghoang@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "0353504969", password: "SKKN100", displayName: "GV" },
    { username: "chulinhchitihon@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "minhly2411@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "torangdaylipc1@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "viet2903edu@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "freelife0510@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "phantruongduy1981@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "Belam088@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "duongle2512@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "minhtrang", password: "SKKN100", displayName: "GV" },
    { username: "slowsoftst@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "hoangnhancva86@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "lanuyen79@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "jullyxuan1983@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "trivvt@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "thuyhoaiagrai@gmail.com", password: "SKKN100", displayName: "GV" },
    { username: "myfuture579@gmail.com", password: "SKKN100", displayName: "GV" },
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
    { username: "hadayhoc2@gmail.com", password: "SKKN100", displayName: "GV18" },
    { username: "huynhthisam25@gmail.com", password: "SKKN100", displayName: "GV19" },
    { username: "ngocthanhluong2023@gmail.com", password: "SKKN100", displayName: "GV20" },
    { username: "phongc3vvk@gmail.com", password: "SKKN100", displayName: "GV21" },
    { username: "hnguyenthiminhhuong@gmail.com", password: "SKKN100", displayName: "GV22" },
    { username: "tranvanvinh.sqtt@gmail.com", password: "SKKN100", displayName: "GV23" },
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

// ============ HÀM DÙNG THỬ ============

export const isTrialAccount = (username: string): boolean => {
    return username === TRIAL_ACCOUNT.username;
};

export const hasUsedTrial = (): boolean => {
    return localStorage.getItem('trial_used') === 'true';
};

export const markTrialUsed = (): void => {
    localStorage.setItem('trial_used', 'true');
};



















































































































































































