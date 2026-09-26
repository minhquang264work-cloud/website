const $ = (sel) => document.querySelector(sel);
const fmt = (n) => n.toLocaleString('vi-VN') + 'đ';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let products = [];
let activeCategory = 'Tất cả';
let searchTerm = '';
let cart = loadCart(); // { [productId]: qty }

function loadCart() {
  try {
    const data = JSON.parse(localStorage.getItem('cart') || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}
function saveCart() {
  try { localStorage.setItem('cart', JSON.stringify(cart)); } catch { /* bỏ qua */ }
}

async function init() {
  const res = await fetch('/api/products');
  products = await res.json();
  renderFilters();
  renderProducts();
  renderCart();
}

function renderFilters() {
  const cats = ['Tất cả', ...new Set(products.map((p) => p.category))];
  $('#filters').innerHTML = cats
    .map((c) => `<button class="chip ${c === activeCategory ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join('');
}

function renderProducts() {
  const term = searchTerm.toLowerCase();
  const list = products.filter(
    (p) =>
      (activeCategory === 'Tất cả' || p.category === activeCategory) &&
      (!term || `${p.name} ${p.origin}`.toLowerCase().includes(term))
  );
  $('#empty').hidden = list.length > 0;
  $('#product-grid').innerHTML = list
    .map(
      (p) => `
    <article class="card" data-cat="${esc(p.category)}">
      <div class="card-img" aria-hidden="true">${p.emoji}</div>
      <div class="card-body">
        <span class="tag">${esc(p.category)}</span>
        <h3>${esc(p.name)}</h3>
        <span class="origin">📍 ${esc(p.origin)}</span>
        <p class="desc">${esc(p.desc)}</p>
        <div class="card-foot">
          <span class="price">${fmt(p.price)} <small>/ ${esc(p.unit)}</small></span>
          <button class="add-btn" data-add="${p.id}">+ Thêm</button>
        </div>
      </div>
    </article>`
    )
    .join('');
}

function cartLines() {
  return Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id)), qty }))
    .filter((l) => l.product && l.qty > 0);
}

function renderCart() {
  const lines = cartLines();
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.product.price, 0);
  $('#cart-count').textContent = count;
  $('#cart-total').textContent = fmt(total);
  $('#cart-foot').hidden = lines.length === 0;
  $('#cart-items').innerHTML = lines.length
    ? lines
        .map(
          ({ product: p, qty }) => `
      <div class="cart-item">
        <div class="ci-emoji">${p.emoji}</div>
        <div>
          <div class="ci-name">${esc(p.name)}</div>
          <div class="ci-price">${fmt(p.price)} / ${esc(p.unit)}</div>
          <div class="qty">
            <button data-dec="${p.id}" aria-label="Giảm">−</button>
            <span>${qty}</span>
            <button data-inc="${p.id}" aria-label="Tăng">+</button>
          </div>
        </div>
        <div>
          <strong>${fmt(p.price * qty)}</strong><br>
          <button class="ci-remove" data-remove="${p.id}">Xóa</button>
        </div>
      </div>`
        )
        .join('')
    : '<p class="cart-empty">🧺<br>Giỏ hàng đang trống.<br>Hãy chọn vài món nông sản tươi ngon nhé!</p>';
}

function changeQty(id, delta) {
  const next = (cart[id] || 0) + delta;
  if (next <= 0) delete cart[id];
  else cart[id] = Math.min(next, 100);
  saveCart();
  renderCart();
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1800);
}

function openDrawer(open) {
  $('#drawer').classList.toggle('open', open);
  $('#drawer').setAttribute('aria-hidden', String(!open));
  $('#overlay').hidden = !open;
}

// Sự kiện
$('#filters').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  activeCategory = btn.dataset.cat;
  renderFilters();
  renderProducts();
});
$('#search').addEventListener('input', (e) => {
  searchTerm = e.target.value.trim();
  renderProducts();
});
$('#product-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  const p = products.find((x) => x.id === Number(btn.dataset.add));
  changeQty(p.id, 1);
  toast(`Đã thêm ${p.name} vào giỏ`);
});
$('#cart-items').addEventListener('click', (e) => {
  const t = e.target;
  if (t.dataset.inc) changeQty(t.dataset.inc, 1);
  else if (t.dataset.dec) changeQty(t.dataset.dec, -1);
  else if (t.dataset.remove) changeQty(t.dataset.remove, -(cart[t.dataset.remove] || 0));
});
$('#open-cart').addEventListener('click', () => openDrawer(true));
$('#close-cart').addEventListener('click', () => openDrawer(false));
$('#overlay').addEventListener('click', () => openDrawer(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    openDrawer(false);
    $('#checkout-modal').hidden = true;
  }
});

$('#checkout-btn').addEventListener('click', () => {
  $('#form-error').textContent = '';
  $('#checkout-modal').hidden = false;
});
$('#cancel-checkout').addEventListener('click', () => ($('#checkout-modal').hidden = true));
$('#close-success').addEventListener('click', () => ($('#success-modal').hidden = true));

$('#checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  data.items = cartLines().map((l) => ({ id: l.product.id, qty: l.qty }));
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Đặt hàng thất bại');
    cart = {};
    saveCart();
    renderCart();
    form.reset();
    $('#checkout-modal').hidden = true;
    openDrawer(false);
    $('#success-text').textContent = `Mã đơn hàng ${body.id} · Tổng thanh toán ${fmt(body.total)}. Chúng tôi sẽ liên hệ xác nhận trong ít phút.`;
    $('#success-modal').hidden = false;
  } catch (err) {
    $('#form-error').textContent = err.message;
  } finally {
    submit.disabled = false;
  }
});

init();
