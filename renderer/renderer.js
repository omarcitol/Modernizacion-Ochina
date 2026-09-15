const state = { products: [], creditCustomers: [], cart: [], payment: 'efectivo', mixed: false, mixedPayments: [{ metodoPago: 'efectivo', moneda: 'USD', monto: '' }, { metodoPago: 'pago_movil', moneda: 'BS', monto: '' }], currency: 'USD', rate: 1, category: 'Todos', editingId: null, authAction: null, authBusy: false, cashAction: null, adminReady: false, user: null, cash: null, business: null };
const $ = (selector) => document.querySelector(selector);
const money = (value) => `$${Number(value).toFixed(2)}`;
const bolivars = (value) => `Bs. ${Number(value).toFixed(2)}`;
const priceUsd = (product) => product.monedaPrecio === 'BS' ? Number(product.precio) / (Number(state.rate) || 1) : Number(product.precio);
const dualPrice = (product, quantity = 1) => {
  const amount = Number(product.precio) * quantity;
  const usd = priceUsd(product) * quantity;
  return product.monedaPrecio === 'BS'
    ? `${bolivars(amount)} · ${money(usd)}`
    : `${money(amount)} · ${bolivars(usd * (Number(state.rate) || 1))}`;
};
const themes = ['light', 'dark', 'aurora', 'neon'];
const savedTheme = themes.includes(localStorage.getItem('solutec-theme')) ? localStorage.getItem('solutec-theme') : 'dark';
let currentTheme = savedTheme;

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  $('#themeToggle').textContent = theme === 'light' ? '☾' : theme === 'dark' ? '✦' : theme === 'aurora' ? '◈' : '⚡';
  $('#themeToggle').title = theme === 'light'
    ? 'Activar tema nocturno'
    : theme === 'dark'
      ? 'Activar tema Aurora'
      : theme === 'aurora'
        ? 'Activar tema Aurora Neon'
        : 'Activar tema claro';
  localStorage.setItem('solutec-theme', theme);
}
async function loadAuditLog() {
  const entries = await window.posApi.audit.list(100);
  $('#auditRows').innerHTML = entries.map((entry) => `<tr class="border-b border-slate-100 last:border-0"><td class="px-5 py-4 text-slate-500">${escapeHtml(entry.creadoEn)}</td><td class="px-5 py-4">${escapeHtml(entry.usuario)}</td><td class="px-5 py-4 font-bold">${escapeHtml(entry.accion)} ${escapeHtml(entry.entidad)}</td><td class="px-5 py-4 text-slate-500">${escapeHtml(entry.detalle)}</td></tr>`).join('');
}
async function loadCashSession() {
  state.cash = await window.posApi.cash.current();
  const label = $('#cashStatus');
  if (state.cash) {
    state.rate = Number(state.cash.tasa_cambio) || 1;
    $('#saleRate').value = state.rate.toFixed(2);
  }
  async function loadBusinessConfig() {
    state.business = await window.posApi.business.get();
    if (!state.business) return;
    $('#businessName').value = state.business.nombre || '';
    $('#businessRif').value = state.business.rif || '';
    $('#businessAddress').value = state.business.direccion || '';
    $('#businessPhone').value = state.business.telefono || '';
    $('#businessTicketMessage').value = state.business.mensajeTicket || '';
  }
  if (label) label.textContent = state.cash ? `Caja abierta · ${state.cash.usuario} · Tasa ${Number(state.cash.tasa_cambio).toFixed(2)}` : 'Caja cerrada';
}

applyTheme(savedTheme);

function notify(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `pointer-events-none fixed bottom-6 right-6 z-20 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl transition-all ${isError ? 'bg-red-600' : 'bg-ink'}`;
  requestAnimationFrame(() => toast.classList.remove('translate-y-4', 'opacity-0'));
  setTimeout(() => toast.classList.add('translate-y-4', 'opacity-0'), 2800);
}

async function loadProducts() {
  state.products = await window.posApi.products.list($('#searchInput').value);
  const lowStock = state.products.filter((product) => Number(product.stock) <= 5);
  const lowStockNotice = $('#lowStockNotice');
  lowStockNotice.classList.toggle('hidden', lowStock.length === 0);
  lowStockNotice.textContent = lowStock.length ? `⚠ ${lowStock.length} producto${lowStock.length === 1 ? '' : 's'} con stock bajo` : '';
  renderProducts();
  renderInventory();
  const summary = await window.posApi.sales.summary();
  $('#todaySales').textContent = money(summary.total);
  $('#todayProfit').textContent = money(summary.ganancia);
  $('#profitCard').classList.toggle('hidden', state.user?.rol !== 'admin');
  $('#todayTransactions').textContent = summary.ventas;
}

async function handleBarcodeScan() {
  const input = $('#searchInput');
  const code = input.value.trim();
  if (!code) return;
  const matches = await window.posApi.products.list(code);
  const product = matches.find((item) => String(item.codigo || '').trim().toLowerCase() === code.toLowerCase());
  if (!product) {
    notify(`No existe un producto con el código ${code}.`, true);
    input.select();
    return;
  }
  addToCart(product.id);
  input.value = '';
  await loadProducts();
  input.focus();
}

function renderProducts() {
  const grid = $('#productGrid');
  const categories = [...new Set(state.products.map((product) => product.categoria || 'Otros'))].sort((a, b) => a.localeCompare(b));
  if (state.category !== 'Todos' && state.category !== 'Favoritos' && !categories.includes(state.category)) state.category = 'Todos';
  $('#categoryStrip').innerHTML = ['Todos', 'Favoritos', ...categories]
    .filter((category, index, list) => list.indexOf(category) === index)
    .map((category) => `<button class="category-chip ${state.category === category ? 'active' : ''}" data-category="${escapeHtml(category)}">${category === 'Favoritos' ? '★ Favoritos' : escapeHtml(category)}</button>`)
    .join('');
  const products = (state.category === 'Todos'
    ? state.products
    : state.category === 'Favoritos'
      ? state.products.filter((product) => Number(product.favorito) === 1)
      : state.products.filter((product) => product.categoria === state.category))
    .sort((a, b) => Number(b.favorito) - Number(a.favorito) || a.nombre.localeCompare(b.nombre));
  $('#emptyProducts').classList.toggle('hidden', products.length > 0);
  grid.innerHTML = products.map((product) => `
    <button class="product-tile panel group relative min-h-36 p-4 text-left hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md" data-add="${product.id}">
      ${product.imagen ? `<img src="${product.imagen}" alt="" class="mb-5 h-10 w-10 rounded-xl object-cover">` : `<span class="product-icon color-${product.color || 'cyan'} mb-5 grid h-10 w-10 place-items-center rounded-xl text-lg">${escapeHtml(product.icono || '◈')}</span>`}
      ${product.favorito ? '<span class="absolute right-3 top-3 text-amber-400">★</span>' : ''}
      <strong class="block truncate text-sm text-ink">${escapeHtml(product.nombre)}</strong>
      <span class="mt-1 block text-[10px] font-bold uppercase tracking-wider text-cyan-500">${escapeHtml(product.categoria || 'Otros')}</span>
      <span class="mt-1 block text-xs text-slate-400">${product.stock} ${product.unidad} disponibles</span>
      <span class="mt-3 block font-extrabold text-blue-600">${dualPrice(product)}</span>
    </button>`).join('');
}

function quantityStep(unit) {
  return unit === 'g' ? 1 : unit === 'kg' ? 0.01 : 1;
}

function initialQuantity(unit) {
  return unit === 'g' ? 100 : unit === 'kg' ? 0.1 : 1;
}

function unitLabel(unit) {
  return unit === 'g' ? 'gramos' : unit === 'kg' ? 'kg' : 'unidades';
}

function renderCart() {
  const total = state.cart.reduce((sum, item) => sum + priceUsd(item) * item.cantidad, 0);
  const displayTotal = state.currency === 'BS' ? total * state.rate : total;
  $('#cartTotal').dataset.amount = displayTotal.toFixed(2);
  $('#cartCount').textContent = `${state.cart.reduce((sum, item) => sum + item.cantidad, 0)} artículos`;
  $('#cartTotal').textContent = state.currency === 'BS' ? bolivars(displayTotal) : money(displayTotal);
  $('#cartTotalDual').textContent = `${money(total)} · ${bolivars(total * state.rate)}`;
  $('#checkoutBtn').textContent = `Cobrar ${state.currency === 'BS' ? bolivars(displayTotal) : money(displayTotal)}`;
  if (state.mixed) renderMixedPayments(total);
  if (state.payment === 'efectivo' && !$('#cashChangePanel').classList.contains('hidden')) updateCashChange();
  $('#checkoutBtn').disabled = state.cart.length === 0;
  $('#cartItems').innerHTML = state.cart.length ? state.cart.map((item) => `
    <div class="flex gap-3"><div class="min-w-0 flex-1"><p class="truncate text-sm font-bold">${escapeHtml(item.nombre)}</p><p class="text-xs text-slate-400">${dualPrice(item)} / ${unitLabel(item.unidad)}</p><div class="mt-2 flex items-center gap-2"><button class="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 font-bold" data-decrease="${item.id}">−</button><input class="w-16 rounded-lg border border-slate-200 py-1 text-center text-xs" data-quantity="${item.id}" type="number" min="${quantityStep(item.unidad)}" step="${quantityStep(item.unidad)}" value="${item.cantidad}"><button class="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 font-bold" data-increase="${item.id}">+</button><span class="text-[10px] text-slate-400">${unitLabel(item.unidad)}</span></div></div><div class="text-right"><p class="text-sm font-extrabold">${dualPrice(item, item.cantidad)}</p><button class="mt-2 text-xs text-slate-400 hover:text-red-500" data-remove="${item.id}">Quitar</button></div></div>`).join('') : '<div class="grid h-32 place-items-center text-center text-sm text-slate-400"><div><div class="mb-2 text-2xl">🛒</div>Tu carrito está vacío</div></div>';
}

function renderMixedPayments(total) {
  const methods = [['efectivo', 'Efectivo'], ['pago_movil', 'Pago móvil'], ['transferencia', 'Transferencia'], ['zelle', 'Zelle'], ['binance', 'Binance'], ['divisas', 'Divisas'], ['otro', 'Otro']];
  $('#mixedPaymentLines').innerHTML = state.mixedPayments.map((line, index) => `<div class="grid grid-cols-[1fr_58px_78px_20px] gap-1" data-mixed-line="${index}"><select class="field py-1 text-[10px]" data-mixed-method>${methods.map(([value, label]) => `<option value="${value}" ${line.metodoPago === value ? 'selected' : ''}>${label}</option>`).join('')}</select><select class="field py-1 text-[10px]" data-mixed-currency><option ${line.moneda === 'USD' ? 'selected' : ''}>USD</option><option ${line.moneda === 'BS' ? 'selected' : ''}>BS</option></select><input class="field py-1 text-[10px]" data-mixed-amount type="number" min="0" step="0.01" placeholder="Monto" value="${line.monto}"><button type="button" class="text-red-500" data-remove-mixed="${index}">×</button></div>`).join('');
  updateMixedPaymentSummary(total);
}

function updateMixedPaymentSummary(total) {
  const paid = state.mixedPayments.reduce((sum, line) => sum + (Number(line.monto) || 0) / (line.moneda === 'BS' ? Number(state.rate) : 1), 0);
  $('#mixedPaymentTotal').textContent = `Cubierto: ${money(paid)} / ${money(total)}`;
}

function renderInventory() {
  $('#emptyInventory').classList.toggle('hidden', state.products.length > 0);
  $('#inventoryRows').innerHTML = state.products.map((product) => `<tr class="border-b border-slate-100 last:border-0"><td class="px-5 py-4 font-bold">${escapeHtml(product.nombre)}<span class="block text-xs font-normal text-slate-400">${product.unidad}</span></td><td class="px-5 py-4 text-slate-500">${escapeHtml(product.codigo || '—')}</td><td class="px-5 py-4 font-bold">${dualPrice(product)}</td><td class="px-5 py-4 ${product.stock <= 5 ? 'text-amber-600' : 'text-slate-600'}">${Number(product.stock).toFixed(2)}</td><td class="px-5 py-4 text-right"><button class="mr-3 text-xs font-bold text-emerald-600" data-adjust="${product.id}">Ajustar</button><button class="mr-3 text-xs font-bold text-blue-600" data-edit="${product.id}">Editar</button><button class="text-xs font-bold text-red-500" data-archive="${product.id}">Eliminar</button></td></tr>`).join('');
}

async function loadInventoryMovements() {
  const movements = await window.posApi.products.movements();
  $('#movementRows').innerHTML = movements.map((movement) => `<tr class="border-b border-slate-100 last:border-0"><td class="px-5 py-4 text-slate-500">${escapeHtml(movement.creadoEn)}</td><td class="px-5 py-4 font-semibold">${escapeHtml(movement.producto)}</td><td class="px-5 py-4">${escapeHtml(movement.tipo)}</td><td class="px-5 py-4 font-bold">${movement.cantidad}</td><td class="px-5 py-4">${escapeHtml(movement.usuario)}</td><td class="px-5 py-4 text-slate-500">${escapeHtml(movement.motivo)}</td></tr>`).join('');
}

function addToCart(id) {
  const product = state.products.find((item) => item.id === Number(id));
  if (!product) return;
  const existing = state.cart.find((item) => item.id === product.id);
  if (existing) {
    if (existing.cantidad + 1 > product.stock) return notify('No hay stock suficiente.', true);
    existing.cantidad += 1;
  } else {
    const quantity = initialQuantity(product.unidad);
    if (quantity > product.stock) return notify('No hay stock suficiente.', true);
    state.cart.push({ ...product, cantidad: quantity });
  }
  renderCart();
}

function changeQuantity(id, quantity) {
  const item = state.cart.find((entry) => entry.id === Number(id));
  if (!item) return;
  const product = state.products.find((entry) => entry.id === item.id);
  if (!product || quantity <= 0) state.cart = state.cart.filter((entry) => entry.id !== item.id);
  else if (quantity > product.stock) notify('La cantidad supera el stock disponible.', true);
  else item.cantidad = quantity;
  renderCart();
}

function openModal(product) {
  state.editingId = product?.id || null;
  $('#modalTitle').textContent = product ? 'Editar producto' : 'Nuevo producto';
  $('#productId').value = product?.id || '';
  $('#productName').value = product?.nombre || '';
  $('#productCode').value = product?.codigo || '';
  $('#productCategory').value = product?.categoria || 'Otros';
  $('#productIcon').value = product?.icono || '◈';
  $('#productImage').value = product?.imagen || '';
  $('#productImageStatus').textContent = product?.imagen ? 'Imagen seleccionada' : 'Sin foto';
  $('#productColor').value = product?.color || 'cyan';
  $('#productFavorite').checked = Boolean(product?.favorito);
  $('#productUnit').value = product?.unidad || 'unidad';
  $('#productPrice').value = product?.precio ?? '';
  $('#productPriceCurrency').value = product?.monedaPrecio || 'USD';
  $('#productCost').value = product?.costo ?? 0;
  $('#productCostCurrency').value = product?.monedaCosto || 'USD';
  $('#productStock').value = product?.stock ?? '';
  $('#productModal').classList.replace('hidden', 'flex');
  $('#productName').focus();
}

function closeModal() { $('#productModal').classList.replace('flex', 'hidden'); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function openAuth(action) {
  state.authAction = action;
  state.authBusy = false;
  $('#adminName').value = '';
  $('#adminPin').value = '';
  $('#adminPin').disabled = false;
  $('#adminPin').readOnly = false;
  $('#adminPin').tabIndex = 0;
  $('#authModal').classList.replace('hidden', 'flex');
  $('#adminNameField').classList.toggle('hidden', action !== 'setup');
  $('#userSelectField').classList.toggle('hidden', action !== 'login');
  $('#authTitle').textContent = action === 'setup' ? 'Configura tu administrador' : 'Acceso de administrador';
  $('#authDescription').textContent = action === 'setup' ? 'Crea el PIN que protegerá inventario y configuración.' : 'Esta sección requiere autorización.';
  $('#adminPin').value = '';
  requestAnimationFrame(() => {
    $('#adminPin').disabled = false;
    $('#adminPin').readOnly = false;
    $('#adminPin').focus();
  });
}
async function openUserLogin() {
  const users = await window.posApi.users.list();
  const activeUsers = users.filter((user) => user.activo);
  if (!activeUsers.length) return openAuth('setup');
  $('#loginUserId').innerHTML = activeUsers.map((user) => `<option value="${user.id}">${escapeHtml(user.nombre)} · ${user.rol}</option>`).join('');
  $('#loginUserId').selectedIndex = 0;
  openAuth('login');
}
$('#loginUserId').addEventListener('change', () => {
  $('#adminPin').disabled = false;
  $('#adminPin').readOnly = false;
  $('#adminPin').focus();
});
$('#adminPin').addEventListener('click', () => {
  $('#adminPin').disabled = false;
  $('#adminPin').readOnly = false;
});
function renderUsers(users) {
  $('#userRows').innerHTML = users.map((user) => {
    const permissions = user.permisos?.all ? 'Todos' : Object.keys(user.permisos || {}).filter((key) => user.permisos[key]).join(', ') || 'Venta básica';
    const actions = user.rol === 'admin'
      ? '<span class="text-xs text-slate-400">Principal</span>'
      : `<button class="mr-3 text-xs font-bold text-blue-600" data-edit-user="${user.id}">Editar</button><button class="text-xs font-bold ${user.activo ? 'text-red-500' : 'text-emerald-600'}" data-toggle-user="${user.id}" data-active="${user.activo ? 1 : 0}">${user.activo ? 'Desactivar' : 'Activar'}</button>`;
    return `<tr class="border-b border-slate-100 last:border-0"><td class="px-5 py-4 font-bold">${escapeHtml(user.nombre)}</td><td class="px-5 py-4 text-slate-500">${user.rol}</td><td class="px-5 py-4 text-xs text-slate-500">${escapeHtml(permissions)}</td><td class="px-5 py-4 ${user.activo ? 'text-emerald-600' : 'text-slate-400'}">${user.activo ? 'Activo' : 'Inactivo'}</td><td class="px-5 py-4 text-right">${actions}</td></tr>`;
  }).join('');
}
function openUserModal(user = null) {
  $('#userModalTitle').textContent = user ? 'Editar perfil' : 'Nuevo perfil';
  $('#userId').value = user?.id || '';
  $('#userName').value = user?.nombre || '';
  $('#userRole').value = user?.rol || 'cajero';
  $('#userPin').value = '';
  $('#userPin').required = !user;
  $('#userPinHelp').textContent = user ? 'Opcional: déjalo vacío para conservar el PIN actual.' : 'Obligatorio al crear el perfil.';
  document.querySelectorAll('.permission-check').forEach((input) => { input.checked = Boolean(user?.permisos?.[input.value]); });
  $('#userModal').classList.replace('hidden', 'flex');
  $('#userName').focus();
}
async function loadCreditCustomers() {
  state.creditCustomers = await window.posApi.credit.list();
  $('#creditCustomerSelect').innerHTML = '<option value="">Selecciona cliente</option>' + state.creditCustomers.map((customer) => `<option value="${customer.id}">${escapeHtml(customer.nombre)} · ${money(customer.saldo)}</option>`).join('');
  $('#creditRows').innerHTML = state.creditCustomers.map((customer) => `<tr class="border-b border-slate-100 last:border-0"><td class="px-5 py-4 font-bold">${escapeHtml(customer.nombre)}</td><td class="px-5 py-4 text-slate-500">${escapeHtml(customer.nota || '—')}</td><td class="px-5 py-4 font-extrabold ${customer.saldo > 0 ? 'text-amber-600' : 'text-emerald-600'}">${money(customer.saldo)}</td><td class="px-5 py-4 text-right"><button class="action bg-emerald-50 text-emerald-700" data-credit-payment="${customer.id}">Registrar abono</button></td></tr>`).join('');
  $('#emptyCredit').classList.toggle('hidden', state.creditCustomers.length > 0);
}
function today() { return new Date().toISOString().slice(0, 10); }
function paymentLabel(value, other = '') { return value === 'otro' ? (other || 'Otro') : ({ efectivo: 'Efectivo', pago_movil: 'Pago móvil', transferencia: 'Transferencia', zelle: 'Zelle', binance: 'Binance', divisas: 'Divisas', fiado: 'Fiado' })[value] || value; }
async function loadSalesReport() {
  const report = await window.posApi.sales.report({ from: $('#reportFrom').value, to: $('#reportTo').value });
  $('#reportSales').textContent = report.totals.ventas;
  $('#reportUsd').textContent = money(report.totals.total_usd);
  $('#reportBs').textContent = bolivars(report.totals.total_bs);
  $('#reportProfit').textContent = money(report.totals.ganancia);
  $('#dailyReportRows').innerHTML = report.daily.length ? report.daily.map((row) => `<div class="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"><span class="font-semibold">${escapeHtml(row.fecha)} <small class="text-slate-400">(${row.ventas} ventas)</small></span><span class="font-bold">${money(row.totalUsd)}</span></div>`).join('') : '<p class="text-sm text-slate-400">No hay ventas en este período.</p>';
  $('#topProductsRows').innerHTML = report.topProducts.length ? report.topProducts.map((row, index) => `<div class="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"><span class="min-w-0 truncate font-semibold"><span class="mr-2 text-cyan-500">${index + 1}.</span>${escapeHtml(row.nombre)} <small class="text-slate-400">(${Number(row.cantidad).toFixed(row.unidad === 'unidad' ? 0 : 3)} ${escapeHtml(row.unidad)})</small></span><span class="ml-3 font-bold">${money(row.totalUsd)}</span></div>`).join('') : '<p class="text-sm text-slate-400">No hay productos vendidos.</p>';
  $('#paymentReportRows').innerHTML = report.byPayment.length ? report.byPayment.map((row) => `<div class="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"><span class="font-semibold">${escapeHtml(paymentLabel(row.metodoPago, row.metodoPagoOtro))} <small class="text-slate-400">(${row.ventas})</small></span><span class="font-bold">${money(row.totalUsd)}</span></div>`).join('') : '<p class="text-sm text-slate-400">No hay ventas en este período.</p>';
  $('#reportRows').innerHTML = report.recent.map((row) => `<tr class="border-b border-slate-100 last:border-0"><td class="px-5 py-4 font-bold">#${row.id}</td><td class="px-5 py-4 text-slate-500">${escapeHtml(row.creadoEn)}</td><td class="px-5 py-4">${escapeHtml(row.usuario)}</td><td class="px-5 py-4">${escapeHtml(paymentLabel(row.metodoPago, row.metodoPagoOtro))}</td><td class="px-5 py-4 font-bold">${row.moneda === 'BS' ? bolivars(row.totalBs) : money(row.total)}</td><td class="px-5 py-4 text-right"><button class="mr-3 text-xs font-bold text-blue-600" data-print-sale="${row.id}">Reimprimir</button><button class="text-xs font-bold text-red-500" data-cancel-sale="${row.id}">Anular</button></td></tr>`).join('');
}
function closeAuth() {
  $('#authModal').classList.replace('flex', 'hidden');
  state.authAction = null;
}
function can(permission) {
  return state.user?.rol === 'admin' || Boolean(state.user?.permisos?.all || state.user?.permisos?.[permission]);
}
async function requireAdmin(action) {
  if (state.adminReady) return true;
  openAuth(action);
  return false;
}
function showReceipt(result) {
  const lines = result.cart.map((item) => {
    const subtotalUsd = item.subtotal ?? priceUsd(item) * item.cantidad;
    const subtotal = result.moneda === 'BS' ? subtotalUsd * Number(result.tasaCambio || state.rate || 1) : subtotalUsd;
    return `${item.cantidad} x ${item.nombre}  ${result.moneda === 'BS' ? bolivars(subtotal) : money(subtotal)}`;
  });
  const shownTotal = result.moneda === 'BS' ? bolivars(result.totalBs) : money(result.total);
  const date = result.creadoEn ? new Date(`${result.creadoEn.replace(' ', 'T')}Z`).toLocaleString('es-VE') : new Date().toLocaleString('es-VE');
  const business = state.business || {};
  const header = [business.nombre || 'SOLUTEC POS', business.rif, business.direccion, business.telefono].filter(Boolean).join('\n');
  $('#receiptText').textContent = `${header}\nComprobante #${result.id}\n${date}\nUsuario: ${result.usuario || state.user?.nombre || 'Sin sesión'}\n\n${lines.join('\n')}\n\nTOTAL: ${shownTotal}${result.moneda === 'BS' ? `\nTasa: ${result.tasaCambio} Bs/USD` : ''}\nPago: ${paymentLabel(result.metodoPago || state.payment, result.metodoPagoOtro || '')}\n\n${business.mensajeTicket || 'Gracias por su compra'}`;
  $('#receiptModal').classList.replace('hidden', 'flex');
}

document.addEventListener('click', async (event) => {
  const category = event.target.closest('[data-category]');
  if (category) {
    state.category = category.dataset.category;
    document.querySelectorAll('[data-category]').forEach((button) => button.classList.toggle('active', button === category));
    renderProducts();
    return;
  }
  const add = event.target.closest('[data-add]');
  if (add) return addToCart(add.dataset.add);
  const increase = event.target.closest('[data-increase]');
  if (increase) {
    const item = state.cart.find((entry) => entry.id === Number(increase.dataset.increase));
    return changeQuantity(increase.dataset.increase, (item?.cantidad || 0) + quantityStep(item?.unidad || 'unidad'));
  }
  const decrease = event.target.closest('[data-decrease]');
  if (decrease) {
    const item = state.cart.find((entry) => entry.id === Number(decrease.dataset.decrease));
    return changeQuantity(decrease.dataset.decrease, (item?.cantidad || 0) - quantityStep(item?.unidad || 'unidad'));
  }
  const remove = event.target.closest('[data-remove]');
  if (remove) return changeQuantity(remove.dataset.remove, 0);
  const edit = event.target.closest('[data-edit]');
  if (edit) return openModal(state.products.find((item) => item.id === Number(edit.dataset.edit)));
  const adjust = event.target.closest('[data-adjust]');
  if (adjust) {
    if (!can('inventory')) return notify('No tienes permiso para ajustar inventario.', true);
    const tipo = prompt('Tipo de movimiento: entrada o salida', 'entrada');
    if (!tipo) return;
    const cantidad = prompt('Cantidad:');
    if (cantidad === null) return;
    const motivo = prompt('Motivo del movimiento:');
    if (motivo === null) return;
    try {
      await window.posApi.products.adjust({ productoId: Number(adjust.dataset.adjust), tipo: tipo.trim().toLowerCase(), cantidad, motivo, usuarioId: state.user?.id || null });
      await loadProducts();
      await loadInventoryMovements();
      notify('Movimiento registrado.');
    } catch (error) { notify(error.message, true); }
    return;
  }
  const cancelSale = event.target.closest('[data-cancel-sale]');
  if (cancelSale) {
    if (!['admin', 'encargado'].includes(state.user?.rol)) return notify('Solo el dueño o encargado puede anular ventas.', true);
    const motivo = prompt('Motivo de la anulación:');
    if (!motivo) return;
    try {
      await window.posApi.sales.cancel({ saleId: Number(cancelSale.dataset.cancelSale), usuarioId: state.user.id, motivo });
      await loadSalesReport();
      await loadProducts();
      notify('Venta anulada y stock devuelto.');
    } catch (error) { notify(error.message, true); }
    return;
  }
  const printSale = event.target.closest('[data-print-sale]');
  if (printSale) {
    try {
      const receipt = await window.posApi.sales.receipt(Number(printSale.dataset.printSale));
      showReceipt(receipt);
    } catch (error) { notify(error.message, true); }
    return;
  }
  const archive = event.target.closest('[data-archive]');
  if (archive && confirm('¿Eliminar este producto del inventario?')) {
    if (!can('inventory')) return notify('No tienes permiso para modificar el inventario.', true);
    await window.posApi.products.archive(archive.dataset.archive, state.user?.id || null);
    await loadProducts();
    notify('Producto eliminado.');
  }
  const view = event.target.closest('[data-view]');
  if (view) {
    const isInventory = view.dataset.view === 'inventory';
    const isSettings = view.dataset.view === 'settings';
    const isCredit = view.dataset.view === 'credit';
    const isReports = view.dataset.view === 'reports';
    if (isSettings && state.user?.rol !== 'admin') {
      const status = await window.posApi.auth.status();
      return status.configured ? openAuth('verify') : openAuth('setup');
    }
    if (isInventory && !can('inventory')) {
      const status = await window.posApi.auth.status();
      if (!status.configured) return openAuth('setup');
      return openAuth('verify');
    }
    if (isCredit && !can('fiado')) {
      const status = await window.posApi.auth.status();
      if (!status.configured) return openAuth('setup');
      return openAuth('verify');
    }
    if (isReports && !can('reports')) {
      const status = await window.posApi.auth.status();
      if (!status.configured) return openAuth('setup');
      return openAuth('verify');
    }
    $('#posView').classList.toggle('hidden', isInventory || isSettings || isCredit || isReports);
    $('#inventoryView').classList.toggle('hidden', !isInventory);
    $('#settingsView').classList.toggle('hidden', !isSettings);
    $('#creditView').classList.toggle('hidden', !isCredit);
    $('#reportsView').classList.toggle('hidden', !isReports);
    $('#pageTitle').textContent = isInventory ? 'Inventario' : isSettings ? 'Usuarios y configuración' : isCredit ? 'Fiados' : isReports ? 'Reportes de ventas' : 'Punto de venta';
    if (isSettings) {
      renderUsers(await window.posApi.users.list());
      await loadAuditLog();
      await loadCashSession();
      await loadBusinessConfig();
    }
    if (isInventory) await loadInventoryMovements();
    if (isCredit) await loadCreditCustomers();
    if (isReports) await loadSalesReport();
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === view));
  }
});

document.addEventListener('change', (event) => {
  const quantity = event.target.closest('[data-quantity]');
  if (quantity) changeQuantity(quantity.dataset.quantity, Number(quantity.value));
});

$('#searchInput').addEventListener('input', loadProducts);
$('#searchInput').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  handleBarcodeScan().catch((error) => notify(error.message, true));
});
document.addEventListener('keydown', (event) => {
  const target = event.target;
  const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName) || target?.isContentEditable;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    $('#searchInput').focus();
    $('#searchInput').select();
  } else if (event.key === '/' && !typing) {
    event.preventDefault();
    $('#searchInput').focus();
  } else if (event.key === 'F4' && !typing) {
    event.preventDefault();
    $('#checkoutBtn').click();
  }
});
$('#reportFrom').value = today();
$('#reportTo').value = today();
$('#loadReportBtn').addEventListener('click', () => loadSalesReport().catch((error) => notify(error.message, true)));
$('#exportReportBtn').addEventListener('click', async () => {
  if (!can('reports')) return notify('No tienes permiso para exportar reportes.', true);
  try {
    const result = await window.posApi.sales.exportCsv({ from: $('#reportFrom').value, to: $('#reportTo').value });
    if (!result.canceled) notify('Reporte exportado correctamente.');
  } catch (error) {
    notify(error.message, true);
  }
});
$('#exportInventoryBtn').addEventListener('click', async () => {
  if (!can('inventory')) return notify('No tienes permiso para exportar inventario.', true);
  try {
    const result = await window.posApi.products.exportCsv();
    if (!result.canceled) notify('Inventario exportado correctamente.');
  } catch (error) {
    notify(error.message, true);
  }
});
$('#sessionButton').addEventListener('click', async () => {
  if (state.user && confirm(`Cerrar sesión de ${state.user.nombre} y cambiar de usuario?`)) {
    try {
      await window.posApi.auth.logoutUser();
      state.user = null;
      state.adminReady = false;
      state.cashAction = null;
      $('#sessionButton').textContent = 'Iniciar sesión';
      notify('Sesión cerrada. La caja permanece abierta.');
    } catch (error) {
      return notify(error.message, true);
    }
  }
  if (!state.user) await openUserLogin();
});
$('#themeToggle').addEventListener('click', () => {
  applyTheme(themes[(themes.indexOf(currentTheme) + 1) % themes.length]);
});
$('#clearCart').addEventListener('click', () => { state.cart = []; renderCart(); });
$('#backupBtn').addEventListener('click', async () => { try { const result = await window.posApi.backup.create(); notify(`Respaldo creado: ${result.createdAt.slice(0, 10)}`); } catch (error) { notify(error.message, true); } });
$('#exportBackupBtn').addEventListener('click', async () => {
  if (state.user?.rol !== 'admin') return notify('Solo el dueño puede exportar respaldos.', true);
  try {
    const result = await window.posApi.backup.export();
    if (!result.canceled) notify('Respaldo exportado correctamente.');
  } catch (error) {
    notify(error.message, true);
  }
});
$('#restoreBackupBtn').addEventListener('click', async () => {
  if (state.user?.rol !== 'admin') return notify('Solo el dueño puede restaurar respaldos.', true);
  if (!confirm('La restauración reemplazará los datos actuales por los del respaldo. Se recomienda exportar un respaldo antes de continuar. ¿Deseas continuar?')) return;
  try {
    const result = await window.posApi.backup.restore(state.user.id);
    if (result.restored) {
      state.user = null;
      state.adminReady = false;
      $('#sessionButton').textContent = 'Iniciar sesión';
      notify('Respaldo restaurado. Inicia sesión nuevamente.');
      setTimeout(() => window.location.reload(), 900);
    }
  } catch (error) {
    notify(error.message, true);
  }
});
document.querySelectorAll('#closeReceipt, #closeReceiptButton').forEach((button) => button.addEventListener('click', () => $('#receiptModal').classList.replace('flex', 'hidden')));
$('#printReceipt').addEventListener('click', () => {
  document.body.classList.add('printing-receipt');
  window.print();
  window.setTimeout(() => document.body.classList.remove('printing-receipt'), 500);
});
function updateCashChange() {
  const total = state.currency === 'BS' ? Number($('#cartTotal').dataset.amount || 0) : Number($('#cartTotal').dataset.amount || 0);
  const received = Number($('#cashReceived').value);
  const change = received - total;
  $('#cashChange').textContent = state.currency === 'BS' ? bolivars(Math.max(0, change)) : money(Math.max(0, change));
  $('#cashChange').classList.toggle('text-red-600', received > 0 && change < 0);
}
document.querySelectorAll('.payment-btn').forEach((button) => button.addEventListener('click', async () => { state.payment = button.dataset.payment; document.querySelectorAll('.payment-btn').forEach((item) => item.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-600')); button.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-600'); $('#creditCustomerSelect').classList.toggle('hidden', state.payment !== 'fiado'); $('#otherPayment').classList.toggle('hidden', state.payment !== 'otro'); $('#cashChangePanel').classList.toggle('hidden', state.payment !== 'efectivo'); if (state.payment !== 'otro') $('#otherPayment').value = ''; if (state.payment === 'fiado') await loadCreditCustomers(); }));
$('#mixedPaymentToggle').addEventListener('click', () => {
  state.mixed = !state.mixed;
  $('#singlePaymentPanel').classList.toggle('hidden', state.mixed);
  $('#mixedPaymentPanel').classList.toggle('hidden', !state.mixed);
  $('#mixedPaymentToggle').classList.toggle('bg-blue-50', state.mixed);
  $('#cashChangePanel').classList.add('hidden');
  renderCart();
});
$('#addMixedPayment').addEventListener('click', () => {
  state.mixedPayments.push({ metodoPago: 'efectivo', moneda: 'USD', monto: '' });
  renderCart();
});
$('#mixedPaymentLines').addEventListener('input', (event) => {
  const row = event.target.closest('[data-mixed-line]');
  if (!row) return;
  const line = state.mixedPayments[Number(row.dataset.mixedLine)];
  if (event.target.matches('[data-mixed-method]')) line.metodoPago = event.target.value;
  if (event.target.matches('[data-mixed-currency]')) line.moneda = event.target.value;
  if (event.target.matches('[data-mixed-amount]')) {
    line.monto = event.target.value;
    updateMixedPaymentSummary(state.cart.reduce((sum, item) => sum + priceUsd(item) * item.cantidad, 0));
    return;
  }
  renderCart();
});
$('#mixedPaymentLines').addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-mixed]');
  if (!button || state.mixedPayments.length <= 2) return;
  state.mixedPayments.splice(Number(button.dataset.removeMixed), 1);
  renderCart();
});
$('#saleCurrency').addEventListener('change', () => { state.currency = $('#saleCurrency').value; $('#rateField').classList.toggle('opacity-50', state.currency !== 'BS'); renderCart(); });
$('#saleRate').readOnly = true;
$('#cashReceived').addEventListener('input', updateCashChange);
$('#checkoutBtn').addEventListener('click', async () => {
  try {
    if (!state.user) return notify('Inicia sesión antes de vender.', true);
    const cash = await window.posApi.cash.current();
    if (!cash) return notify('Abre una caja antes de registrar ventas.', true);
    const soldCart = [...state.cart];
    const metodoPagoOtro = $('#otherPayment').value.trim();
    const pagos = state.mixed
      ? state.mixedPayments.map((line) => ({ ...line, monto: Number(line.monto) }))
      : state.payment === 'efectivo'
        ? [{ metodoPago: 'efectivo', moneda: state.currency, monto: Number($('#cashReceived').value) }]
        : null;
    if (state.payment === 'otro' && !metodoPagoOtro) return notify('Especifica el método de pago.', true);
    if (!state.mixed && state.payment === 'efectivo') {
      const total = Number($('#cartTotal').dataset.amount || 0);
      const received = Number($('#cashReceived').value);
      if (!Number.isFinite(received) || received < total) return notify('El efectivo recibido no cubre el total.', true);
    }
    const result = await window.posApi.sales.create({ usuarioId: state.user.id, cajaId: cash.id, clienteFiadoId: $('#creditCustomerSelect').value ? Number($('#creditCustomerSelect').value) : null, moneda: state.currency, tasaCambio: state.rate, metodoPago: state.mixed ? 'otro' : state.payment, metodoPagoOtro, pagos, items: soldCart.map((item) => ({ productoId: item.id, cantidad: item.cantidad })) });
    showReceipt({ ...result, cart: soldCart, metodoPagoOtro });
    state.cart = [];
    state.mixed = false;
    state.mixedPayments = [{ metodoPago: 'efectivo', moneda: 'USD', monto: '' }, { metodoPago: 'pago_movil', moneda: 'BS', monto: '' }];
    $('#cashReceived').value = '';
    $('#cashChangePanel').classList.add('hidden');
    renderCart();
    await loadProducts();
    if (state.payment === 'fiado') await loadCreditCustomers();
    notify(`Venta #${result.id} registrada correctamente.`);
  } catch (error) {
    notify(error.message, true);
  }
});
$('#newProductBtn').addEventListener('click', () => {
  if (!can('inventory')) return notify('No tienes permiso para modificar el inventario.', true);
  openModal();
});
$('#receiveMerchandiseBtn').addEventListener('click', async () => {
  if (!can('inventory')) return notify('No tienes permiso para registrar mercancía.', true);
  const products = state.products;
  if (!products.length) return notify('Registra un producto antes de recibir mercancía.', true);
  const productText = products.map((product) => `${product.id}: ${product.nombre} (${product.stock} ${unitLabel(product.unidad)})`).join('\n');
  const productId = Number(prompt(`Selecciona el ID del producto:\n\n${productText}`));
  const product = products.find((item) => item.id === productId);
  if (!product) return notify('Producto no válido.', true);
  const cantidad = Number(prompt(`Cantidad recibida de ${product.nombre}:`, '1'));
  const costo = Number(prompt('Costo unitario del proveedor:', String(product.costo || 0)));
  const monedaCosto = (prompt('Moneda del costo: USD o BS', product.monedaCosto || 'USD') || '').trim().toUpperCase();
  if (!Number.isFinite(cantidad) || !Number.isFinite(costo) || !['USD', 'BS'].includes(monedaCosto)) return notify('Datos de mercancía inválidos.', true);
  const motivo = prompt('Proveedor o referencia (opcional):', '') || '';
  try {
    const result = await window.posApi.products.receive({ productoId: product.id, cantidad, costo, monedaCosto, motivo, usuarioId: state.user.id });
    await loadProducts();
    await loadInventoryMovements();
    notify(`Mercancía registrada. Stock: ${result.stock}; costo promedio: ${result.costo} ${result.monedaCosto}.`);
  } catch (error) {
    notify(error.message, true);
  }
});
async function optimizeProductImage(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
  });
  const maxSize = 512;
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.78);
}
$('#pickProductImage').addEventListener('click', async () => {
  try {
    const result = await window.posApi.products.pickImage();
    if (!result.canceled) {
      $('#productImage').value = await optimizeProductImage(result.dataUrl);
      $('#productImageStatus').textContent = 'Imagen seleccionada';
    }
  } catch (error) {
    notify(error.message, true);
  }
});
$('#removeProductImage').addEventListener('click', () => {
  $('#productImage').value = '';
  $('#productImageStatus').textContent = 'Sin foto';
});
$('#newCreditCustomerBtn').addEventListener('click', async () => {
  if (!can('fiado')) return notify('No tienes permiso para gestionar fiados.', true);
  const nombre = prompt('Nombre o alias del cliente:');
  if (!nombre) return;
  const nota = prompt('Nota opcional:') || '';
  try { await window.posApi.credit.saveCustomer({ nombre, nota, usuarioId: state.user?.id || null }); await loadCreditCustomers(); notify('Cliente de fiado guardado.'); } catch (error) { notify(error.message, true); }
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-credit-payment]');
  if (!button) return;
  const monto = prompt('Monto del abono:');
  if (monto === null) return;
  const metodoPago = prompt('Método: efectivo, pago_movil, transferencia, zelle, binance o divisas', 'efectivo');
  if (metodoPago === null) return;
  try {
    await window.posApi.credit.payment({ clienteId: Number(button.dataset.creditPayment), monto, metodoPago: metodoPago.trim().toLowerCase(), usuarioId: state.user?.id || null });
    await loadCreditCustomers();
    notify('Abono registrado.');
  } catch (error) { notify(error.message, true); }
});
$('#closeModal').addEventListener('click', closeModal);
$('#cancelModal').addEventListener('click', closeModal);
$('#productForm').addEventListener('submit', async (event) => { event.preventDefault(); if (!can('inventory')) return notify('No tienes permiso para modificar el inventario.', true); try { await window.posApi.products.save({ id: state.editingId, usuarioId: state.user?.id || null, nombre: $('#productName').value, codigo: $('#productCode').value, categoria: $('#productCategory').value, icono: $('#productIcon').value, imagen: $('#productImage').value, color: $('#productColor').value, favorito: $('#productFavorite').checked, unidad: $('#productUnit').value, precio: $('#productPrice').value, monedaPrecio: $('#productPriceCurrency').value, costo: $('#productCost').value, monedaCosto: $('#productCostCurrency').value, stock: $('#productStock').value }); closeModal(); await loadProducts(); notify('Producto guardado.'); } catch (error) { notify(error.message, true); } });
$('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.authBusy) return;
  const pin = $('#adminPin').value.trim();
  if (!/^\d{4,8}$/.test(pin)) {
    $('#adminPin').focus();
    return notify('Escribe un PIN de 4 a 8 dígitos.', true);
  }
  state.authBusy = true;
  try {
    if (state.authAction === 'setup') {
      state.user = await window.posApi.auth.setupAdmin({ nombre: $('#adminName').value, pin });
      state.adminReady = true;
      $('#sessionButton').textContent = state.user.nombre;
      alert(`Guarda este código de recuperación en un lugar seguro:\n\n${state.user.recoveryCode}\n\nNo se volverá a mostrar.`);
      notify('Administrador configurado.');
    } else if (state.authAction === 'login') {
      state.user = await window.posApi.auth.loginUser({ id: $('#loginUserId').value, pin });
      state.adminReady = state.user.rol !== 'cajero';
      $('#sessionButton').textContent = state.user.nombre;
      notify(`Sesión iniciada: ${state.user.nombre}`);
      closeAuth();
      return;
    } else {
      await window.posApi.auth.verifyPin(pin);
      notify('Acceso autorizado.');
    }
    state.adminReady = true;
    closeAuth();
    $('#inventoryView').classList.remove('hidden');
    $('#posView').classList.add('hidden');
    $('#pageTitle').textContent = 'Inventario';
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === 'inventory'));
  } catch (error) {
    notify(error.message, true);
  } finally {
    state.authBusy = false;
  }
});
$('#cancelAuth').addEventListener('click', closeAuth);
$('#forgotPin').addEventListener('click', () => { closeAuth(); $('#recoveryModal').classList.replace('hidden', 'flex'); $('#recoveryCode').focus(); });
$('#cancelRecovery').addEventListener('click', () => $('#recoveryModal').classList.replace('flex', 'hidden'));
$('#recoveryForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await window.posApi.auth.resetAdminPin($('#recoveryCode').value.trim(), $('#newAdminPin').value);
    $('#recoveryModal').classList.replace('flex', 'hidden');
    notify('PIN actualizado. Ya puedes iniciar sesión.');
  } catch (error) {
    notify(error.message, true);
  }
});
$('#newUserBtn').addEventListener('click', () => { if (state.user?.rol !== 'admin') return notify('Solo el dueño puede gestionar perfiles.', true); openUserModal(); });
$('#changePinBtn').addEventListener('click', async () => {
  if (state.user?.rol !== 'admin') return notify('Solo el dueño puede cambiar el PIN.', true);
  $('#newPinValue').value = '';
  $('#changePinModal').classList.replace('hidden', 'flex');
  setTimeout(() => $('#newPinValue').focus(), 0);
});
$('#cancelChangePin').addEventListener('click', () => $('#changePinModal').classList.replace('flex', 'hidden'));
$('#changePinForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await window.posApi.auth.updateAdminPin({ usuarioId: state.user.id, pin: $('#newPinValue').value });
    $('#changePinModal').classList.replace('flex', 'hidden');
    notify('PIN actualizado. Guarda el código de recuperación del negocio.');
  } catch (error) {
    notify(error.message, true);
  }
});
$('#recoveryCodeBtn').addEventListener('click', async () => {
  if (state.user?.rol !== 'admin') return notify('Solo el dueño puede regenerar el código.', true);
  if (!confirm('El código anterior dejará de funcionar. ¿Continuar?')) return;
  try {
    const code = await window.posApi.auth.regenerateRecovery();
    alert(`Guarda este nuevo código en un lugar seguro:\n\n${code}`);
  } catch (error) {
    notify(error.message, true);
  }
});
function openCashModal(action) {
  state.cashAction = action;
  const opening = action === 'open';
  $('#cashModalTitle').textContent = opening ? 'Abrir caja' : 'Cerrar caja';
  $('#cashModalDescription').textContent = opening ? 'Indica los montos iniciales y la tasa del día.' : 'Indica el efectivo contado al finalizar la jornada.';
  $('#cashUsdLabel').textContent = opening ? 'Monto inicial USD' : 'Monto contado USD';
  $('#cashBsLabel').textContent = opening ? 'Monto inicial Bs' : 'Monto contado Bs';
  $('#cashRateField').classList.toggle('hidden', !opening);
  $('#cashUsd').value = opening ? '0' : '';
  $('#cashBs').value = opening ? '0' : '';
  $('#cashRate').value = state.rate || '1';
  $('#cashModal').classList.replace('hidden', 'flex');
  setTimeout(() => $('#cashUsd').focus(), 0);
}
function closeCashModal() {
  $('#cashModal').classList.replace('flex', 'hidden');
  state.cashAction = null;
}
$('#openCashBtn').addEventListener('click', async () => {
  if (!state.user) return notify('Inicia sesión para abrir la caja.', true);
  if (!['admin', 'encargado'].includes(state.user.rol)) return notify('Solo el dueño o encargado puede abrir la caja.', true);
  openCashModal('open');
});
$('#closeCashBtn').addEventListener('click', async () => {
  if (!state.user) return notify('Inicia sesión para cerrar la caja.', true);
  if (!['admin', 'encargado'].includes(state.user.rol)) return notify('Solo el dueño o encargado puede cerrar la caja.', true);
  if (!state.cash) return notify('No hay una caja abierta para cerrar.', true);
  openCashModal('close');
});
$('#cancelCash').addEventListener('click', closeCashModal);
$('#cashForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    if (state.cashAction === 'open') {
      await window.posApi.cash.open({ usuarioId: state.user.id, montoInicial: $('#cashUsd').value, montoInicialBs: $('#cashBs').value, tasaCambio: $('#cashRate').value });
      await loadCashSession();
      notify('Caja abierta con la tasa del día.');
    } else {
      const result = await window.posApi.cash.close({ usuarioId: state.user.id, montoContado: $('#cashUsd').value, montoContadoBs: $('#cashBs').value });
      await loadCashSession();
      alert(`Caja cerrada.\n\nUSD esperado: $${Number(result.esperado).toFixed(2)}\nUSD contado: $${Number(result.montoContado).toFixed(2)}\nDiferencia USD: $${Number(result.diferencia).toFixed(2)}\n\nBs esperado: ${bolivars(result.esperadoBs)}\nBs contado: ${bolivars(result.montoContadoBs)}\nDiferencia Bs: ${bolivars(result.diferenciaBs)}`);
    }
    closeCashModal();
  } catch (error) { notify(error.message, true); }
});
$('#cancelUser').addEventListener('click', () => $('#userModal').classList.replace('flex', 'hidden'));
document.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit-user]');
  if (editButton) {
    if (state.user?.rol !== 'admin') return notify('Solo el dueño puede gestionar perfiles.', true);
    const user = (await window.posApi.users.list()).find((item) => item.id === Number(editButton.dataset.editUser));
    if (user) openUserModal(user);
    return;
  }
  const toggleButton = event.target.closest('[data-toggle-user]');
  if (toggleButton) {
    if (state.user?.rol !== 'admin') return notify('Solo el dueño puede gestionar perfiles.', true);
    const active = toggleButton.dataset.active === '1';
    if (!confirm(`${active ? '¿Desactivar' : '¿Activar'} este usuario?`)) return;
    try {
      await window.posApi.users.setActive({ id: Number(toggleButton.dataset.toggleUser), activo: !active, usuarioId: state.user.id });
      renderUsers(await window.posApi.users.list());
      await loadAuditLog();
      notify(`Usuario ${active ? 'desactivado' : 'activado'}.`);
    } catch (error) {
      notify(error.message, true);
    }
  }
});
$('#userForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const editing = Boolean($('#userId').value);
    const permisos = Object.fromEntries([...document.querySelectorAll('.permission-check:checked')].map((input) => [input.value, true]));
    await window.posApi.users.save({ id: $('#userId').value ? Number($('#userId').value) : null, usuarioId: state.user?.id, nombre: $('#userName').value, rol: $('#userRole').value, pin: $('#userPin').value, permisos });
    $('#userModal').classList.replace('flex', 'hidden');
    $('#userForm').reset();
    renderUsers(await window.posApi.users.list());
    notify(editing ? 'Perfil actualizado.' : 'Perfil creado.');
  } catch (error) {
    notify(error.message, true);
  }
});
$('#businessForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.user?.rol !== 'admin') return notify('Solo el dueño puede modificar los datos del negocio.', true);
  try {
    state.business = await window.posApi.business.save({
      usuarioId: state.user.id,
      nombre: $('#businessName').value,
      rif: $('#businessRif').value,
      direccion: $('#businessAddress').value,
      telefono: $('#businessPhone').value,
      mensajeTicket: $('#businessTicketMessage').value
    });
    notify('Datos comerciales guardados.');
    await loadAuditLog();
  } catch (error) {
    notify(error.message, true);
  }
});

Promise.all([loadProducts(), loadBusinessConfig()]).catch((error) => notify(error.message, true));
renderCart();
setInterval(async () => {
  try {
    await window.posApi.backup.create();
  } catch (error) {
    notify(`No se pudo crear el respaldo: ${error.message}`, true);
  }
}, 15 * 60 * 1000);
