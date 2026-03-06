/**
 * Database Đề xuất Cải thiện SKKN
 * Tiêu chí đánh giá, phân loại điểm, vấn đề phổ biến và giải pháp
 */

export const EVALUATION_CRITERIA = [
    { criteriaId: 'C01', criteriaName: 'Cấu trúc', maxScore: 10, weightPercentage: 10, evaluationLevel: 'form', description: 'Đánh giá tính đầy đủ, logic và mạch lạc của cấu trúc SKKN' },
    { criteriaId: 'C02', criteriaName: 'Cơ sở lý luận', maxScore: 10, weightPercentage: 10, evaluationLevel: 'content', description: 'Đánh giá độ vững chắc của cơ sở lý luận, trích dẫn nghiên cứu' },
    { criteriaId: 'C03', criteriaName: 'Số liệu minh chứng', maxScore: 10, weightPercentage: 10, evaluationLevel: 'content', description: 'Đánh giá chất lượng và tính thuyết phục của số liệu' },
    { criteriaId: 'C04', criteriaName: 'Tính khả thi', maxScore: 10, weightPercentage: 10, evaluationLevel: 'practical', description: 'Khả năng áp dụng giải pháp trong thực tế' },
    { criteriaId: 'C05', criteriaName: 'Tính thực tiễn', maxScore: 10, weightPercentage: 10, evaluationLevel: 'practical', description: 'Mức độ giải quyết vấn đề thực tế trong giáo dục' },
    { criteriaId: 'C06', criteriaName: 'Tính mới', maxScore: 10, weightPercentage: 10, evaluationLevel: 'innovation', description: 'Mức độ sáng tạo, khác biệt so với các giải pháp hiện có' },
    { criteriaId: 'C07', criteriaName: 'Khả năng nhân rộng', maxScore: 10, weightPercentage: 10, evaluationLevel: 'practical', description: 'Khả năng áp dụng rộng rãi cho nhiều đơn vị' },
    { criteriaId: 'C08', criteriaName: 'Ngôn ngữ', maxScore: 10, weightPercentage: 10, evaluationLevel: 'form', description: 'Chất lượng diễn đạt, ngôn ngữ khoa học' },
    { criteriaId: 'C09', criteriaName: 'Hình thức', maxScore: 10, weightPercentage: 10, evaluationLevel: 'form', description: 'Trình bày, lỗi chính tả, format' },
];

export const SCORE_CLASSIFICATIONS = [
    { classificationId: 'R01', minScore: 90, maxScore: 100, rating: 'Xuất sắc', colorCode: '#10B981', recommendation: 'Sẵn sàng nộp cấp cao hơn' },
    { classificationId: 'R02', minScore: 80, maxScore: 89, rating: 'Tốt', colorCode: '#3B82F6', recommendation: 'Cần cải thiện nhỏ trước khi nộp' },
    { classificationId: 'R03', minScore: 70, maxScore: 79, rating: 'Khá', colorCode: '#F59E0B', recommendation: 'Cần cải thiện một số điểm quan trọng' },
    { classificationId: 'R04', minScore: 60, maxScore: 69, rating: 'Trung bình', colorCode: '#EF4444', recommendation: 'Cần cải thiện đáng kể' },
    { classificationId: 'R05', minScore: 0, maxScore: 59, rating: 'Yếu', colorCode: '#991B1B', recommendation: 'Cần làm lại nhiều phần' },
];

export const ISSUES_DATABASE = [
    {
        issueId: 'I001', issueCode: 'WEAK_THEORY_BASE', issueName: 'Cơ sở lý luận yếu',
        criteriaId: 'C02', severity: 'critical' as const, priority: 1,
        description: 'Phần cơ sở lý luận chỉ nói về chỉ đạo của lãnh đạo, thiếu các lý thuyết giáo dục được công nhận',
        detectionKeywords: ['lãnh đạo nhà trường', 'chỉ đạo', 'không có trích dẫn', 'thiếu lý thuyết'],
    },
    {
        issueId: 'I002', issueCode: 'MISSING_NEW_POINTS', issueName: 'Thiếu mục "Điểm mới của sáng kiến"',
        criteriaId: 'C06', severity: 'high' as const, priority: 2,
        description: 'Thiếu mục riêng biệt về điểm mới của sáng kiến trong phần Mở đầu',
        detectionKeywords: ['điểm mới', 'tính mới', 'sáng tạo'],
    },
    {
        issueId: 'I003', issueCode: 'SPELLING_ERRORS', issueName: 'Lỗi chính tả và đánh máy',
        criteriaId: 'C09', severity: 'medium' as const, priority: 3,
        description: 'Tồn tại nhiều lỗi chính tả và lỗi đánh máy trong văn bản',
        detectionKeywords: ['lỗi chính tả', 'lỗi đánh máy'],
    },
    {
        issueId: 'I004', issueCode: 'MISSING_REFERENCES', issueName: 'Thiếu danh mục tài liệu tham khảo',
        criteriaId: 'C02', severity: 'high' as const, priority: 2,
        description: 'Không có phần danh mục tài liệu tham khảo sau phần Kết luận',
        detectionKeywords: ['tài liệu tham khảo', 'danh mục', 'trích dẫn'],
    },
    {
        issueId: 'I005', issueCode: 'WEAK_SURVEY_METHOD', issueName: 'Phương pháp khảo sát chưa rõ ràng',
        criteriaId: 'C03', severity: 'medium' as const, priority: 3,
        description: 'Có bảng số liệu nhưng chưa nêu rõ phương pháp thu thập và công cụ khảo sát',
        detectionKeywords: ['khảo sát', 'phương pháp', 'thu thập dữ liệu'],
    },
    {
        issueId: 'I006', issueCode: 'MISSING_COMPARISON_TABLE', issueName: 'Thiếu bảng so sánh trước-sau',
        criteriaId: 'C03', severity: 'medium' as const, priority: 3,
        description: 'Có số liệu trước và sau nhưng chưa có bảng so sánh trực quan',
        detectionKeywords: ['so sánh', 'trước sau', 'kết quả'],
    },
    {
        issueId: 'I007', issueCode: 'MISSING_LIMITATIONS', issueName: 'Thiếu phần hạn chế và hướng phát triển',
        criteriaId: 'C01', severity: 'low' as const, priority: 4,
        description: 'Phần kết luận chưa có mục về hạn chế và hướng phát triển',
        detectionKeywords: ['hạn chế', 'hướng phát triển', 'khuyến nghị'],
    },
    {
        issueId: 'I008', issueCode: 'MISSING_APPLICATION_CONDITIONS', issueName: 'Thiếu điều kiện áp dụng cho giải pháp',
        criteriaId: 'C04', severity: 'low' as const, priority: 4,
        description: 'Các giải pháp chưa nêu rõ điều kiện cần thiết để áp dụng',
        detectionKeywords: ['điều kiện áp dụng', 'yêu cầu', 'chuẩn bị'],
    },
];

export const SOLUTIONS_DATABASE = [
    {
        solutionId: 'S001', issueId: 'I001', solutionType: 'rewrite' as const, actionType: 'replace_section',
        targetSection: 'Cơ sở lý luận', estimatedTime: '2-3 giờ', difficulty: 'high' as const, impactScore: 9,
        exampleContent: `1. CƠ SỞ LÝ LUẬN

1.1. Cơ sở pháp lý
- Nghị quyết số 29-NQ/TW ngày 04/11/2013 của Ban Chấp hành Trung ương về đổi mới căn bản, toàn diện giáo dục và đào tạo.
- Luật Giáo dục số 43/2019/QH14 ngày 14/06/2019.
- Thông tư số 32/2018/TT-BGDĐT ngày 26/12/2018 ban hành Chương trình giáo dục phổ thông 2018.

1.2. Cơ sở lý thuyết
- Lý thuyết kiến tạo (Constructivism) - Jean Piaget, Vygotsky
- Lý thuyết tải nhận thức (Cognitive Load Theory) - John Sweller
- Phương pháp dạy học tích cực

1.3. Liên hệ với sáng kiến
[Giải thích cách các lý thuyết hỗ trợ cho giải pháp của SKKN]`,
    },
    {
        solutionId: 'S002', issueId: 'I002', solutionType: 'add' as const, actionType: 'insert_section',
        targetSection: 'Phần Mở đầu', estimatedTime: '1-2 giờ', difficulty: 'medium' as const, impactScore: 8,
        exampleContent: `ĐIỂM MỚI CỦA SÁNG KIẾN

So với các phương pháp truyền thống, sáng kiến này có những điểm mới:
- Về phương pháp tiếp cận: [mô tả]
- Về công cụ hỗ trợ: [mô tả]
- Về phương pháp dạy học: [mô tả]
- Điểm khác biệt so với SKKN cùng chủ đề: [mô tả]`,
    },
    {
        solutionId: 'S003', issueId: 'I003', solutionType: 'fix' as const, actionType: 'correct_errors',
        targetSection: 'Toàn bộ văn bản', estimatedTime: '30 phút', difficulty: 'low' as const, impactScore: 3,
        exampleContent: `Sửa các lỗi chính tả phổ biến:
- "cáo" → "cao"
- "day" → "dạy"
- "thi sinh" → "thí sinh"
- "phát uy" → "phát huy"`,
    },
    {
        solutionId: 'S004', issueId: 'I004', solutionType: 'add' as const, actionType: 'insert_section',
        targetSection: 'Sau phần Kết luận', estimatedTime: '1-2 giờ', difficulty: 'medium' as const, impactScore: 7,
        exampleContent: `TÀI LIỆU THAM KHẢO

A. Văn bản pháp quy
[1]. Quốc hội (2019), Luật Giáo dục số 43/2019/QH14.
[2]. Bộ GD&ĐT (2018), Thông tư 32/2018/TT-BGDĐT.

B. Sách, giáo trình
[3]. [Tác giả] ([Năm]), [Tên sách], [NXB].

C. Tài liệu nghiên cứu
[4]. [Tác giả] ([Năm]), [Tên bài báo], [Tạp chí].`,
    },
    {
        solutionId: 'S005', issueId: 'I005', solutionType: 'enhance' as const, actionType: 'add_details',
        targetSection: 'Thực trạng', estimatedTime: '30 phút - 1 giờ', difficulty: 'low' as const, impactScore: 5,
        exampleContent: `* Phương pháp khảo sát:
- Thời gian: [Tháng/Năm]
- Đối tượng: [Số lượng] học sinh lớp [Tên lớp]
- Công cụ: [Bài kiểm tra/Phiếu khảo sát]
- Nội dung đánh giá: [Các kỹ năng/kiến thức]
- Phương pháp xử lý: [Thống kê mô tả/so sánh]`,
    },
    {
        solutionId: 'S006', issueId: 'I006', solutionType: 'enhance' as const, actionType: 'add_visual',
        targetSection: 'Kết quả thực hiện', estimatedTime: '30 phút', difficulty: 'low' as const, impactScore: 6,
        exampleContent: `Bảng so sánh kết quả trước và sau khi áp dụng giải pháp:
| Mức độ | TRƯỚC | % | SAU | % | Chênh lệch |
|--------|-------|---|-----|---|------------|
| Giỏi   | [X]   |[X]%| [X] |[X]%| [+/-]%    |
| Khá    | [X]   |[X]%| [X] |[X]%| [+/-]%    |`,
    },
    {
        solutionId: 'S007', issueId: 'I007', solutionType: 'add' as const, actionType: 'insert_subsection',
        targetSection: 'Kết luận', estimatedTime: '30 phút - 1 giờ', difficulty: 'low' as const, impactScore: 4,
        exampleContent: `* Hạn chế của sáng kiến:
- Mới thực nghiệm tại một đơn vị, cần mở rộng phạm vi.
- [Các hạn chế khác]

* Hướng phát triển:
- Mở rộng thực nghiệm sang các trường khác.
- [Các hướng phát triển khác]`,
    },
    {
        solutionId: 'S008', issueId: 'I008', solutionType: 'enhance' as const, actionType: 'add_details',
        targetSection: 'Cuối mỗi giải pháp', estimatedTime: '1 giờ', difficulty: 'low' as const, impactScore: 4,
        exampleContent: `* Điều kiện áp dụng:
- Về cơ sở vật chất: [Yêu cầu]
- Về thời gian: [Yêu cầu]
- Về năng lực GV: [Yêu cầu]
- Về đối tượng HS: [Yêu cầu]`,
    },
];

export const PRIORITY_MATRIX = [
    { level: 'urgent', symbol: '⭐⭐⭐', color: '#DC2626', label: 'Ưu tiên cao nhất', recommendation: 'Cần khắc phục ngay trước khi nộp SKKN' },
    { level: 'high', symbol: '⭐⭐', color: '#F59E0B', label: 'Ưu tiên cao', recommendation: 'Nên hoàn thành để nâng cao chất lượng' },
    { level: 'medium', symbol: '⭐', color: '#3B82F6', label: 'Ưu tiên trung bình', recommendation: 'Cải thiện nếu có thời gian' },
    { level: 'low', symbol: '', color: '#6B7280', label: 'Ưu tiên thấp', recommendation: 'Không bắt buộc nhưng nên làm' },
];

/**
 * Lấy phân loại điểm theo thang điểm
 */
export function classifyScore(score: number) {
    return SCORE_CLASSIFICATIONS.find(c => score >= c.minScore && score <= c.maxScore) || SCORE_CLASSIFICATIONS[SCORE_CLASSIFICATIONS.length - 1];
}

/**
 * Lấy giải pháp cho một vấn đề
 */
export function getSolutionsForIssue(issueId: string) {
    return SOLUTIONS_DATABASE.filter(s => s.issueId === issueId);
}
