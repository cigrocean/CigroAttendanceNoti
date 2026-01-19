export const translations = {
  en: {
    // Generics
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    delete: "Delete",
    close: "Close",
    search: "Search",
    
    // Auth / Login
    signIn: "Sign In",
    signOut: "Sign Out",
    emailPrefix: "Email Prefix",
    emailDomain: "Domain",
    welcomeBack: "Welcome back, {name}!",
    accessDenied: "Access Denied",
    
    // Network Guard
    verifyingNetwork: "Checking Network...",
    newDeviceDetected: "New Device Detected",
    oneTimeAuthMessage: "You're at the office but office network IP has changed recently, you're the first client so please authorize one time for all the clients in this network",
    enterPassword: "Enter the Wi-Fi password of Cigro Litmers Endash (1-5) to authorize",
    passwordPlaceholder: "Password...",
    incorrectPassword: "Incorrect password",
    verifying: "Verifying...",
    authorizeDevice: "Authorize Device",
    unauthorizedLocationMessage: "You are not at the office location.",
    unauthorizedDefaultMessage: "You are not authorized to access this page.",
    status: "Status",
    distance: "Distance",
    retry: "Retry",
    locationUpdated: "Location updated: {dist}m away",
    locationRequired: "Location Access Required",
    checkSettings: "Please check your browser settings (lock icon) to allow location.",
    reloadPage: "Reload Page",
    requestLocation: "Request Location Access",
    checking: "Checking...",
    
    // Dashboard - Header
    goodMorning: "Good morning ☀️,",
    goodAfternoon: "Good afternoon 🌤️,",
    goodEvening: "Good evening 🌙,",
    
    // Dashboard - Main Card
    currentSession: "Current Session",
    checkInTime: "Check-in Time",
    workedTime: "Worked Time",
    officeHoursError: "Please check in/out during office hours (Check-in before 10AM, Check-out after 7PM)",
    
    // Actions
    checkIn: "Check In",
    checkOut: "Check Out",
    manualInput: "Manual Input",
    records: "Records",
    settings: "Settings",
    
    // Dialogs
    confirmCheckInTitle: "Confirm Check-in",
    confirmCheckInDesc: "Are you sure you want to check in now?",
    confirmCheckOutTitle: "Confirm Check-out",
    confirmCheckOutDesc: "Are you sure you want to check out now?",
    confirmSignOutDesc: "Are you sure you want to sign out? You will need to re-verify via email next time.",
    
    // Time/Date
    today: "Today",
    
    // Manual Input Dialog
    manualEntryTitle: "Manual Time Entry",
    manualEntryDesc: "Enter your check-in time manually if you missed it.",
    timeLabel: "Time (HH:mm)",
    setCheckIn: "Set Check-in",
    
    // Settings Dialog
    settingsTitle: "Settings",
    settingsDesc: "Manage your preferences and notifications.",
    dailyReminder: "Daily Reminder",
    enableReminder: "Enable Reminder",
    receiveReminders: "Receive daily reminders if you haven't checked in.",
    reminderTime: "Reminder Time",
    selectTime: "Select time",
    savedToCloud: "Saved to cloud",
    testWebhook: "Test Webhook",
    testWebhookDesc: "Click to send a test notification to Power Automate.",
    sending: "Sending...",
    clearCache: "Clear App Cache",
    clearCacheDesc: "Fix issues by clearing local storage.",
    cacheCleared: "Cache cleared!",
    
    // Credits
    vibeCodedBy: "Yes, this was 100% vibe-coded by, and is a legacy work of",
    checkAnotherWork: "Check another work — SwaggerNav",
    checkMeetingRooms: "Cigro Meeting Rooms",
    github: "GitHub",
    
    // Toasts
    checkInSuccess: "Check-in successful!",
    checkOutSuccess: "Checkout notification sent to Workflows!",
    validationFailed: "Validation service unreachable.",
    emailNotFound: "Access Denied: Email not found in Organization.",
    failedToSend: "Failed to send notification",
    
    // Admin / Records
    attendanceRecords: "Attendance Records",
    allRecords: "All check-in records from Google Sheets",
    searchByEmail: "Search by email...",
    refreshing: "Refreshing...",
    name: "Name",
    email: "Email",
    date: "Date",
    time: "Time",
    endTime: "End Time",
    
    // Dashboard Specifics
    welcomeTitle: "Welcome",
    enterEmailDesc: "Please enter your Email to continue",
    emailLabel: "Email (for notification)",
    officeCheckIn: "Office Check-in",
    sheet: "Google Sheet",
    currentTime: "Current Time",
    checkInClosed: "Check-in closed for the day",
    instantClosed: "Instant check-in closed after {time}",
    tooEarly: "Too early! Check-in opens at 8:00 AM.",
    useManualEntry: "Please use manual entry below.",
    manualEntryTrigger: "Use Manual Entry",
    autoCheckInLimit: "Auto check-in only available before {time}. Use Manual Entry.",
    checkInAt: "Checked in at {time}",
    confirmManual: "Confirm Manual Entry",
    confirmManualDesc: "Confirm checking in at {time}?",
    confirmInstant: "Confirm Instant Check-in",
    confirmInstantDesc: "Are you sure you want to check in now at {time}?",
    progress: "Progress",
    started: "Start",
    finished: "Finish",
    cancelReset: "Cancel / Reset Check-in",
    processing: "Processing...",
    deleteRecord: "Delete Record",
    deleteRecordDesc: "Are you sure? This will delete the record from Google Sheets.",
    disclaimerTitle: "Disclaimer",
    disclaimerText: "This is a personal efficiency tool, <strong>not an official HR platform</strong>. It <strong>does not sync with company attendance records</strong>, so you are <strong>still required</strong> to perform your official manual check-in.",
    loggedOut: "Logged out successfully",
    checkInCleared: "Check-in cleared and deleted from cloud",
    settingsSaved: "Settings saved successfully",
    savedToCloud: "Saved to cloud",
    
    // Language
    language: "Language",
    english: "English",
    vietnamese: "Vietnamese",
  },
  vi: {
    // Generics
    loading: "Đang tải...",
    save: "Lưu",
    cancel: "Hủy",
    confirm: "Xác nhận",
    delete: "Xóa",
    close: "Đóng",
    search: "Tìm kiếm",
    
    // Auth / Login
    signIn: "Đăng nhập",
    signOut: "Đăng xuất",
    emailPrefix: "Email (Prefix)",
    emailDomain: "Tên miền",
    welcomeBack: "Chào mừng trở lại, {name}!",
    accessDenied: "Từ chối truy cập",
    
    // Network Guard
    verifyingNetwork: "Đang kiểm tra mạng...",
    newDeviceDetected: "Phát hiện thiết bị mới",
    oneTimeAuthMessage: "Bạn đang ở văn phòng nhưng IP mạng văn phòng đã thay đổi gần đây. Bạn là client đầu tiên, vui lòng xác thực một lần cho tất cả mọi người trong mạng này.",
    enterPassword: "Nhập mật khẩu Wi-Fi của Cigro Litmers Endash (1-5) để xác thực",
    passwordPlaceholder: "Mật khẩu...",
    incorrectPassword: "Mật khẩu không đúng",
    verifying: "Đang xác thực...",
    authorizeDevice: "Xác thực thiết bị",
    unauthorizedLocationMessage: "Bạn không ở vị trí văn phòng.",
    unauthorizedDefaultMessage: "Bạn không có quyền truy cập trang này.",
    status: "Trạng thái",
    distance: "Khoảng cách",
    retry: "Thử lại",
    locationUpdated: "Đã cập nhật vị trí: cách {dist}m",
    locationRequired: "Yêu cầu quyền vị trí",
    checkSettings: "Vui lòng kiểm tra cài đặt trình duyệt (biểu tượng ổ khóa) để cho phép vị trí.",
    reloadPage: "Tải lại trang",
    requestLocation: "Yêu cầu quyền vị trí",
    checking: "Đang kiểm tra...",
    resetSettings: "Quyền bị chặn - Đặt lại cài đặt",

    // Dashboard - Header
    goodMorning: "Chào buổi sáng ☀️,",
    goodAfternoon: "Chào buổi chiều 🌤️,",
    goodEvening: "Chào buổi tối 🌙,",
    
    // Dashboard - Main Card
    currentSession: "Phiên làm việc",
    checkInTime: "Giờ Check-in",
    workedTime: "Thời gian làm việc",
    officeHoursError: "Vui lòng check-in/out trong giờ hành chính (Check-in trước 10h sáng, Check-out sau 7h tối)",
    
    // Actions
    checkIn: "Check In",
    checkOut: "Check Out",
    manualInput: "Nhập thủ công",
    records: "Lịch sử",
    settings: "Cài đặt",
    
    // Dialogs
    confirmCheckInTitle: "Xác nhận Check-in",
    confirmCheckInDesc: "Bạn có chắc chắn muốn check-in ngay bây giờ không?",
    confirmCheckOutTitle: "Xác nhận Check-out",
    confirmCheckOutDesc: "Bạn có chắc chắn muốn check-out ngay bây giờ không?",
    confirmSignOutDesc: "Bạn có chắc chắn muốn đăng xuất? Bạn sẽ cần xác thực lại email vào lần sau.",
    
    // Time/Date
    today: "Hôm nay",
    
    // Manual Input Dialog
    manualEntryTitle: "Nhập giờ thủ công",
    manualEntryDesc: "Nhập giờ check-in của bạn nếu bạn quên.",
    timeLabel: "Giờ (HH:mm)",
    setCheckIn: "Đặt Check-in",
    
    // Settings Dialog
    settingsTitle: "Cài đặt",
    settingsDesc: "Quản lý tùy chọn và thông báo của bạn.",
    dailyReminder: "Nhắc nhở hàng ngày",
    enableReminder: "Bật nhắc nhở",
    receiveReminders: "Nhận thông báo hàng ngày nếu bạn chưa check-in.",
    reminderTime: "Thời gian nhắc",
    selectTime: "Chọn giờ",
    savedToCloud: "Đã lưu lên đám mây",
    testWebhook: "Test Webhook",
    testWebhookDesc: "Nhấn để gửi thông báo thử nghiệm đến Power Automate.",
    sending: "Đang gửi...",
    clearCache: "Xóa bộ nhớ đệm",
    clearCacheDesc: "Sửa lỗi bằng cách xóa dữ liệu tạm.",
    cacheCleared: "Đã xóa cache!",
    
    // Credits
    vibeCodedBy: "Đúng vậy, 100% được vibe-code bởi, và là di sản của",
    checkAnotherWork: "Xem dự án khác — SwaggerNav",
    checkMeetingRooms: "Cigro Meeting Rooms",
    github: "GitHub",
    
    // Toasts
    checkInSuccess: "Check-in thành công!",
    checkOutSuccess: "Đã gửi thông báo Check-out đến Workflows!",
    validationFailed: "Không thể kết nối dịch vụ xác thực.",
    emailNotFound: "Từ chối: Email không tồn tại trong tổ chức.",
    failedToSend: "Gửi thông báo thất bại",
    
    // Admin / Records
    attendanceRecords: "Lịch sử chấm công",
    allRecords: "Tất cả bản ghi check-in từ Google Sheets",
    searchByEmail: "Tìm kiếm theo email...",
    refreshing: "Đang làm mới...",
    name: "Tên",
    email: "Email",
    date: "Ngày",
    time: "Giờ",
    endTime: "Giờ về",
    
    // Dashboard Specifics
    welcomeTitle: "Xin chào",
    enterEmailDesc: "Vui lòng nhập Email để tiếp tục",
    emailLabel: "Email (để nhận thông báo)",
    officeCheckIn: "Check-in Văn phòng",
    sheet: "Google Sheet",
    currentTime: "Thời gian hiện tại",
    checkInClosed: "Đã đóng check-in trong ngày",
    instantClosed: "Đóng check-in nhanh sau {time}",
    tooEarly: "Quá sớm! Check-in mở lúc 8:00 sáng.",
    useManualEntry: "Vui lòng nhập giờ thủ công bên dưới.",
    manualEntryTrigger: "Dùng nhập thủ công",
    autoCheckInLimit: "Check-in tự động chỉ mở trước {time}. Hãy dùng nhập thủ công.",
    checkInAt: "Đã check-in lúc {time}",
    confirmManual: "Xác nhận nhập tay",
    confirmManualDesc: "Xác nhận check-in lúc {time}?",
    confirmInstant: "Xác nhận Check-in Ngay",
    confirmInstantDesc: "Bạn có chắc muốn check-in ngay lúc {time} không?",
    progress: "Tiến độ",
    started: "Bắt đầu",
    finished: "Kết thúc",
    cancelReset: "Hủy / Đặt lại",
    processing: "Đang xử lý...",
    deleteRecord: "Xóa bản ghi",
    deleteRecordDesc: "Bạn có chắc không? Hành động này sẽ xóa dòng ghi nhận trên Google Sheet.",
    disclaimerTitle: "Lưu ý quy định",
    disclaimerText: "Đây là công cụ hỗ trợ cá nhân, <strong>KHÔNG PHẢI nền tảng nhân sự chính thức</strong>. Dữ liệu <strong>KHÔNG ĐỒNG BỘ với hệ thống công ty</strong>, bạn <strong>VẪN PHẢI thực hiện check-in/out chính thức</strong>.",
    loggedOut: "Đăng xuất thành công",
    checkInCleared: "Đã reset và xóa check-in khỏi hệ thống",
    settingsSaved: "Đã lưu cài đặt!",

    // Language
    language: "Ngôn ngữ",
    english: "Tiếng Anh",
    vietnamese: "Tiếng Việt",
  }
};

export const getTranslation = (key, lang = 'vi', params = {}) => {
  const dict = translations[lang] || translations['vi'];
  let text = dict[key] || key;
  
  // Simple parameter replacement {param}
  Object.keys(params).forEach(param => {
    text = text.replace(`{${param}}`, params[param]);
  });
  
  return text;
};
