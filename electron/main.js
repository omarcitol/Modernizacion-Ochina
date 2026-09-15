const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(headers, rows) {
  return [headers.map(csvEscape).join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\r\n');
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  db.initializeDatabase(app.getPath('userData'));
  ipcMain.handle('products:list', (_event, search) => db.listProducts(search));
  ipcMain.handle('auth:status', () => ({ configured: db.hasUsers() }));
  ipcMain.handle('auth:setup-admin', (_event, credentials) => db.setupAdmin(credentials));
  ipcMain.handle('auth:verify-pin', (_event, pin) => db.verifyPin(pin));
  ipcMain.handle('auth:login-user', (_event, credentials) => db.loginUser(credentials));
  ipcMain.handle('auth:logout-user', () => db.logoutUser());
  ipcMain.handle('users:list', () => db.listUsers());
  ipcMain.handle('users:save', (_event, user) => db.saveUser(user));
  ipcMain.handle('users:set-active', (_event, user) => db.setUserActive(user));
  ipcMain.handle('business:get', () => db.getBusinessConfig());
  ipcMain.handle('business:save', (_event, config) => db.saveBusinessConfig(config));
  ipcMain.handle('auth:update-admin-pin', (_event, data) => db.updateAdminPin(data));
  ipcMain.handle('auth:reset-admin-pin', (_event, data) => db.resetAdminPin(data.recoveryCode, data.newPin));
  ipcMain.handle('auth:regenerate-recovery', () => db.regenerateAdminRecovery());
  ipcMain.handle('products:save', (_event, product) => db.saveProduct(product));
  ipcMain.handle('products:pick-image', async () => {
    const result = await dialog.showOpenDialog({ title: 'Seleccionar imagen del producto', properties: ['openFile'], filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const filePath = result.filePaths[0];
    const extension = path.extname(filePath).toLowerCase();
    const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
    const buffer = fs.readFileSync(filePath);
    if (buffer.length > 1024 * 1024) throw new Error('La imagen debe pesar menos de 1 MB.');
    return { canceled: false, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
  });
  ipcMain.handle('products:archive', (_event, data) => db.archiveProduct(data.id, data.usuarioId));
  ipcMain.handle('sales:create', (_event, sale) => db.createSale(sale));
  ipcMain.handle('credit:list', () => db.listCreditCustomers());
  ipcMain.handle('credit:save-customer', (_event, customer) => db.saveCreditCustomer(customer));
  ipcMain.handle('credit:payment', (_event, payment) => db.createCreditPayment(payment));
  ipcMain.handle('sales:summary', () => db.getSalesSummary());
  ipcMain.handle('sales:report', (_event, range) => db.getSalesReport(range));
  ipcMain.handle('sales:receipt', (_event, saleId) => db.getSaleReceipt(saleId));
  ipcMain.handle('sales:cancel', (_event, data) => db.cancelSale(data));
  ipcMain.handle('inventory:export', () => db.getInventoryExport());
  ipcMain.handle('inventory:movements', (_event, productId) => db.listInventoryMovements(productId));
  ipcMain.handle('inventory:adjust', (_event, movement) => db.adjustInventory(movement));
  ipcMain.handle('inventory:receive', (_event, movement) => db.registerMerchandise(movement));
  ipcMain.handle('audit:list', (_event, limit) => db.getAuditLog(limit));
  ipcMain.handle('cash:current', () => db.getOpenCashSession());
  ipcMain.handle('cash:open', (_event, data) => db.openCashSession(data));
  ipcMain.handle('cash:close', (_event, data) => db.closeCashSession(data));
  ipcMain.handle('sales:export-csv', async (_event, range) => {
    const report = db.getSalesReport(range);
    const result = await dialog.showSaveDialog({ title: 'Exportar reporte de ventas', defaultPath: `ventas-${report.from}-${report.to}.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    const rows = report.recent.map((sale) => ({
      id: sale.id,
      fecha: sale.creadoEn,
      usuario: sale.usuario,
      metodo: sale.metodoPago === 'otro' ? (sale.metodoPagoOtro || 'Otro') : sale.metodoPago,
      moneda: sale.moneda,
      total: sale.moneda === 'BS' ? sale.totalBs : sale.total
    }));
    fs.writeFileSync(result.filePath, `\uFEFF${rowsToCsv(['id', 'fecha', 'usuario', 'metodo', 'moneda', 'total'], rows)}`, 'utf8');
    return { path: result.filePath };
  });
  ipcMain.handle('inventory:export-csv', async () => {
    const result = await dialog.showSaveDialog({ title: 'Exportar inventario', defaultPath: 'inventario.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    const rows = db.getInventoryExport();
    fs.writeFileSync(result.filePath, `\uFEFF${rowsToCsv(['nombre', 'codigo', 'precio', 'monedaPrecio', 'costo', 'monedaCosto', 'stock', 'unidad', 'activo', 'creado_en', 'actualizado_en'], rows)}`, 'utf8');
    return { path: result.filePath };
  });
  ipcMain.handle('backup:create', () => db.createBackup(app.getPath('userData')));
  ipcMain.handle('backup:export', async () => {
    const result = await dialog.showSaveDialog({ title: 'Exportar respaldo de Solutec POS', defaultPath: 'solutec-respaldo.sqlite', filters: [{ name: 'Respaldo SQLite', extensions: ['sqlite'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    return db.exportBackup(result.filePath, app.getPath('userData'));
  });
  ipcMain.handle('backup:restore', async (_event, usuarioId) => {
    const result = await dialog.showOpenDialog({ title: 'Restaurar respaldo de Solutec POS', properties: ['openFile'], filters: [{ name: 'Respaldo SQLite', extensions: ['sqlite', 'db'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    db.restoreBackup(result.filePaths[0], app.getPath('userData'), usuarioId);
    return { restored: true };
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  db.closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});
