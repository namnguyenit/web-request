# web-request

Một web server Node.js nhỏ để nhận request dạng `/====giatri`, log lại IP, giá trị và thời gian, và hiển thị dưới dạng bảng (EJS). Dữ liệu được lưu bền vững vào file JSON.

## Chạy dự án

```cmd
npm install
npm start
```

Server chạy tại: http://localhost:3000

## Gửi dữ liệu
- Truy cập đường dẫn: `http://localhost:3000/====<giatri>` (ví dụ: `http://localhost:3000/====abc123`)
- Mỗi request sẽ được ghi lại gồm:
  - Địa chỉ IP client
  - Giá trị (sau 4 dấu bằng)
  - Thời gian nhận

## Xem log
- Mở: `http://localhost:3000/`
- Có bảng hiển thị các bản ghi (STT, IP, Giá trị, Thời gian)
- Nút "Làm mới" để reload, "Xóa log" để xóa toàn bộ log
- Có thể tải dữ liệu thô: `http://localhost:3000/export.json`

## Lưu dữ liệu bền vững (JSON)
- File dữ liệu: `data/logs.json`
- Định dạng: mảng các object `{ ip: string, value: string, time: string(ISO) }`
- Mỗi lần có request mới hoặc xoá dữ liệu, file sẽ được cập nhật. Khi server khởi động lại sẽ nạp dữ liệu từ file này.

## Lưu ý
- Mặc định dùng file JSON để lưu bền vững. Nếu cần mở rộng có thể chuyển sang DB (ví dụ SQLite) sau này.
- Lấy IP:
  - Ưu tiên header `x-forwarded-for` nếu chạy sau reverse proxy
  - Fallback `req.ip`/`remoteAddress`. Dạng `::ffff:127.0.0.1` sẽ được rút gọn thành `127.0.0.1`.
