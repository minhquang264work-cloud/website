const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');

const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/products', (req, res) => {
  const { category, q } = req.query;
  let list = products;
  if (category) list = list.filter((p) => p.category === category);
  if (q) {
    const term = String(q).toLowerCase();
    list = list.filter((p) => `${p.name} ${p.origin}`.toLowerCase().includes(term));
  }
  res.json(list);
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  res.json(product);
});

app.post('/api/orders', (req, res) => {
  const { name, phone, address, note, items } = req.body || {};

  if (!name || !phone || !address) {
    return res.status(400).json({ error: 'Vui lòng nhập đủ họ tên, số điện thoại và địa chỉ.' });
  }
  if (!/^(0|\+84)\d{9,10}$/.test(String(phone).replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Giỏ hàng đang trống.' });
  }

  // Giá và tên luôn lấy từ server, không tin dữ liệu từ client
  const lines = [];
  for (const item of items) {
    const product = products.find((p) => p.id === Number(item.id));
    const qty = Number(item.qty);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 100) {
      return res.status(400).json({ error: 'Sản phẩm trong giỏ hàng không hợp lệ.' });
    }
    lines.push({ id: product.id, name: product.name, price: product.price, unit: product.unit, qty });
  }
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  const order = {
    id: 'NS' + Date.now().toString(36).toUpperCase(),
    createdAt: new Date().toISOString(),
    name: String(name).slice(0, 100),
    phone: String(phone).slice(0, 20),
    address: String(address).slice(0, 300),
    note: String(note || '').slice(0, 500),
    items: lines,
    total,
  };

  let orders = [];
  try {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    // chưa có file đơn hàng
  }
  orders.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));

  res.status(201).json({ id: order.id, total });
});

app.listen(PORT, () => {
  console.log(`Nông Sản Việt đang chạy tại http://localhost:${PORT}`);
});
