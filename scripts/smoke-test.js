const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');
const db = require('../electron/db');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

app.whenReady().then(() => {
  const tempPath = fs.mkdtempSync(path.join(os.tmpdir(), 'solutec-pos-smoke-'));
  try {
    db.initializeDatabase(tempPath);
    const admin = db.setupAdmin({ nombre: 'Prueba', pin: '1234' });
    const cashierId = db.saveUser({
      usuarioId: admin.id,
      nombre: 'Cajero',
      pin: '5678',
      rol: 'cajero',
      permisos: {}
    });
    assert(db.loginUser({ id: cashierId, pin: '5678' }).id === cashierId, 'El primer inicio de sesión falló.');
    db.logoutUser();
    assert(db.loginUser({ id: admin.id, pin: '1234' }).id === admin.id, 'No se pudo iniciar sesión después de cerrar la sesión anterior.');
    const productId = db.saveProduct({
      usuarioId: admin.id,
      nombre: 'Producto de prueba',
      codigo: 'SMOKE-001',
      precio: 2.5,
      monedaPrecio: 'USD',
      costo: 1,
      monedaCosto: 'USD',
      stock: 10,
      unidad: 'unidad',
      categoria: 'Bebidas',
      icono: 'P',
      color: 'cyan',
      favorito: true,
      imagen: 'data:image/png;base64,iVBORw0KGgo='
    });
    const savedProduct = db.listProducts('SMOKE-001').find((item) => item.id === productId);
    assert(savedProduct.imagen === 'data:image/png;base64,iVBORw0KGgo=', 'La imagen no persistió.');
    const received = db.registerMerchandise({
      productoId: productId,
      cantidad: 5,
      costo: 1.5,
      monedaCosto: 'USD',
      motivo: 'Proveedor de prueba',
      usuarioId: admin.id
    });
    assert(Number(received.stock) === 15, 'La entrada de mercancía no actualizó el stock.');
    const cash = db.openCashSession({
      usuarioId: admin.id,
      montoInicial: 20,
      montoInicialBs: 0,
      tasaCambio: 36.75
    });
    const sale = db.createSale({
      usuarioId: admin.id,
      cajaId: cash.id,
      items: [{ productoId: productId, cantidad: 2 }],
      metodoPago: 'efectivo',
      moneda: 'USD',
      tasaCambio: 36.75
    });
    const product = db.listProducts('SMOKE-001').find((item) => item.id === productId);
    assert(Number(product.stock) === 13, 'La venta no descontó el stock.');

    const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    const date = localNow.toISOString().slice(0, 10);
    const otherSale = db.createSale({
      usuarioId: admin.id,
      cajaId: cash.id,
      items: [{ productoId: productId, cantidad: 1 }],
      metodoPago: 'otro',
      metodoPagoOtro: 'Pago con convenio',
      moneda: 'USD',
      tasaCambio: 36.75
    });
    const otherReport = db.getSalesReport({ from: date, to: date });
    const otherPayment = otherReport.byPayment.find((row) => row.metodoPago === 'otro');
    assert(otherSale.id > sale.id, 'La segunda venta no fue creada.');
    assert(otherPayment?.metodoPagoOtro === 'Pago con convenio', 'El método personalizado no persistió.');

    const report = db.getSalesReport({ from: date, to: date });
    assert(Number(report.totals.ventas) === 2, 'El reporte no contó las ventas.');
    assert(report.daily.length === 1, 'El reporte diario no contiene la venta.');
    assert(report.topProducts.length === 1, 'El reporte de productos está vacío.');

    const closed = db.closeCashSession({
      usuarioId: admin.id,
      montoContado: 25,
      montoContadoBs: 0
    });
    assert(Number(closed.diferencia) === 0, 'El cierre de caja tiene una diferencia inesperada.');
    console.log(`Smoke test OK: venta #${sale.id}, stock restante ${product.stock}, cierre sin diferencia.`);
  } finally {
    db.closeDatabase();
    fs.rmSync(tempPath, { recursive: true, force: true });
  }
  app.quit();
}).catch((error) => {
  console.error(`Smoke test FAILED: ${error.message}`);
  app.exit(1);
});
