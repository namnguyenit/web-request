const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Cấu hình EJS
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Nếu chạy sau reverse proxy (nginx, v.v.) bật trust proxy để lấy IP thật
app.set('trust proxy', true);


// Lưu trữ log các yêu cầu (trong bộ nhớ)
let logs = [];

// Thiết lập file lưu trữ JSON trên đĩa
const DATA_DIR = path.join(__dirname, 'data');
const LOG_FILE = path.join(DATA_DIR, 'logs.json');

function ensureDataFile() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(LOG_FILE)) {
            fs.writeFileSync(LOG_FILE, '[]', 'utf8');
        }
    } catch (e) {
        console.error('Không thể tạo thư mục/file dữ liệu:', e);
    }
}

function loadLogsFromDisk() {
    try {
        ensureDataFile();
        const raw = fs.readFileSync(LOG_FILE, 'utf8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
            // Chuẩn hoá dữ liệu
            logs = arr.map(x => ({
                ip: String(x.ip || ''),
                value: String(x.value || ''),
                // Lưu ở dạng ISO string
                time: String(x.time || new Date().toISOString())
            }));
        }
    } catch (e) {
        console.error('Lỗi đọc dữ liệu từ file:', e);
        logs = [];
    }
}

async function saveLogsToDisk() {
    try {
        await fs.promises.writeFile(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (e) {
        console.error('Lỗi ghi dữ liệu ra file:', e);
    }
}

// Nạp dữ liệu lúc khởi động
loadLogsFromDisk();

// Helper lấy IP client
function getClientIp(req) {
    // Ưu tiên x-forwarded-for khi có proxy, fallback remoteAddress
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        // Lấy IP đầu tiên trong danh sách
        return String(xff).split(',')[0].trim();
    }
    // req.ip đã bị ảnh hưởng bởi trust proxy, nên cũng hữu ích
    return (req.ip || req.connection?.remoteAddress || '').replace('::ffff:', '');
}

// Route bắt request dạng /====giatri
app.get('/====:value', async (req, res) => {
    const value = req.params.value;
    const ip = getClientIp(req);
    const time = new Date().toISOString();
    logs.push({ ip, value, time });
    // In ra console để kiểm tra nhanh
    console.log(`[LOG] ${ip} -> ${value} @ ${new Date(time).toLocaleString()}`);
    await saveLogsToDisk();
    res.redirect('/');
});


// Trang chủ: hiển thị bảng logs
app.get('/', (req, res) => {
    res.render('index', {
        logs: logs.map((item, idx) => ({
            no: idx + 1,
            ip: item.ip,
            value: item.value,
            time: new Date(item.time).toLocaleString()
        }))
    });
});

// Xóa toàn bộ logs (đơn giản bằng GET, có thể đổi sang POST nếu cần)
app.get('/clear', async (req, res) => {
    logs = [];
    await saveLogsToDisk();
    res.redirect('/');
});

// Xuất dữ liệu thô JSON
app.get('/export.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(logs, null, 2));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server đang chạy, PORT=${port}`);
});
