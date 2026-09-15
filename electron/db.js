const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

let database;
let databasePath;
let activeUserId = null;

function initializeDatabase(userDataPath) {
  databasePath = path.join(userDataPath, 'solutec-pos.sqlite');
  database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      codigo TEXT UNIQUE,
      precio REAL NOT NULL CHECK (precio >= 0),
      moneda_precio TEXT NOT NULL DEFAULT 'USD' CHECK (moneda_precio IN ('USD', 'BS')),
      costo REAL NOT NULL DEFAULT 0 CHECK (costo >= 0),
      moneda_costo TEXT NOT NULL DEFAULT 'USD' CHECK (moneda_costo IN ('USD', 'BS')),
      stock REAL NOT NULL DEFAULT 0 CHECK (stock >= 0),
      unidad TEXT NOT NULL DEFAULT 'unidad' CHECK (unidad IN ('unidad', 'kg', 'g')),
      categoria TEXT NOT NULL DEFAULT 'Otros',
      icono TEXT NOT NULL DEFAULT '◈',
      imagen TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT 'cyan',
      favorito INTEGER NOT NULL DEFAULT 0 CHECK (favorito IN (0, 1)),
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL NOT NULL CHECK (total >= 0),
      ganancia REAL NOT NULL DEFAULT 0 CHECK (ganancia >= 0),
      metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'pago_movil', 'transferencia', 'zelle', 'binance', 'divisas', 'fiado', 'otro')),
      metodo_pago_otro TEXT NOT NULL DEFAULT '',
      cliente_fiado_id INTEGER REFERENCES clientes_fiado(id),
      moneda TEXT NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD', 'BS')),
      tasa_cambio REAL NOT NULL DEFAULT 1 CHECK (tasa_cambio > 0),
      total_bs REAL NOT NULL DEFAULT 0 CHECK (total_bs >= 0),
      usuario_id INTEGER REFERENCES usuarios(id),
      caja_id INTEGER REFERENCES sesiones_caja(id),
      estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'anulada')),
      anulada_en TEXT,
      anulada_por INTEGER REFERENCES usuarios(id),
      motivo_anulacion TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS detalle_ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL CHECK (cantidad > 0),
      precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
      subtotal REAL NOT NULL CHECK (subtotal >= 0)
    );

    CREATE TABLE IF NOT EXISTS pagos_venta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      metodo_pago TEXT NOT NULL,
      metodo_pago_otro TEXT NOT NULL DEFAULT '',
      moneda TEXT NOT NULL CHECK (moneda IN ('USD', 'BS')),
      monto REAL NOT NULL CHECK (monto > 0),
      monto_usd REAL NOT NULL CHECK (monto_usd > 0),
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('admin', 'encargado', 'cajero')),
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      permisos TEXT NOT NULL DEFAULT '{}',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS configuracion_negocio (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nombre TEXT NOT NULL DEFAULT 'Solutec POS',
      rif TEXT NOT NULL DEFAULT '',
      direccion TEXT NOT NULL DEFAULT '',
      telefono TEXT NOT NULL DEFAULT '',
      mensaje_ticket TEXT NOT NULL DEFAULT 'Gracias por su compra',
      actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clientes_fiado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      nota TEXT NOT NULL DEFAULT '',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS abonos_fiado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_fiado_id INTEGER NOT NULL REFERENCES clientes_fiado(id),
      monto REAL NOT NULL CHECK (monto > 0),
      metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'pago_movil', 'transferencia', 'zelle', 'binance', 'divisas')),
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      accion TEXT NOT NULL,
      entidad TEXT NOT NULL,
      entidad_id INTEGER,
      detalle TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
      cantidad REAL NOT NULL CHECK (cantidad > 0),
      stock_anterior REAL NOT NULL CHECK (stock_anterior >= 0),
      stock_nuevo REAL NOT NULL CHECK (stock_nuevo >= 0),
      motivo TEXT NOT NULL DEFAULT '',
      venta_id INTEGER REFERENCES ventas(id),
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sesiones_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_apertura_id INTEGER NOT NULL REFERENCES usuarios(id),
      monto_inicial REAL NOT NULL DEFAULT 0 CHECK (monto_inicial >= 0),
      monto_inicial_bs REAL NOT NULL DEFAULT 0 CHECK (monto_inicial_bs >= 0),
      abierta_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cerrada_en TEXT,
      monto_contado REAL,
      monto_contado_bs REAL,
      esperado REAL,
      esperado_bs REAL,
      diferencia REAL,
      diferencia_bs REAL,
      tasa_cambio REAL NOT NULL DEFAULT 1 CHECK (tasa_cambio > 0),
      estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada'))
    );
  `);
  database.prepare(`INSERT OR IGNORE INTO configuracion_negocio (id) VALUES (1)`).run();
  const salesTableSql = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ventas'").get()?.sql || '';
  const legacySalesExists = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ventas_legacy'").get();
  const repairLegacyReferences = ['detalle_ventas', 'movimientos_inventario'].some((table) => {
    const sql = database.prepare('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?').get('table', table)?.sql || '';
    return sql.includes('ventas_legacy');
  });
  if (repairLegacyReferences) {
    database.pragma('foreign_keys = OFF');
    database.transaction(() => {
      database.exec(`
        CREATE TABLE detalle_ventas_repair (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
          producto_id INTEGER NOT NULL REFERENCES productos(id),
          cantidad REAL NOT NULL CHECK (cantidad > 0),
          precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
          subtotal REAL NOT NULL CHECK (subtotal >= 0)
        );
        INSERT INTO detalle_ventas_repair SELECT * FROM detalle_ventas;
        DROP TABLE detalle_ventas;
        ALTER TABLE detalle_ventas_repair RENAME TO detalle_ventas;
        CREATE TABLE movimientos_inventario_repair (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          producto_id INTEGER NOT NULL REFERENCES productos(id),
          usuario_id INTEGER REFERENCES usuarios(id),
          tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
          cantidad REAL NOT NULL CHECK (cantidad > 0),
          stock_anterior REAL NOT NULL CHECK (stock_anterior >= 0),
          stock_nuevo REAL NOT NULL CHECK (stock_nuevo >= 0),
          motivo TEXT NOT NULL DEFAULT '',
          venta_id INTEGER REFERENCES ventas(id),
          creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO movimientos_inventario_repair SELECT * FROM movimientos_inventario;
        DROP TABLE movimientos_inventario;
        ALTER TABLE movimientos_inventario_repair RENAME TO movimientos_inventario;
      `);
    })();
    database.pragma('foreign_keys = ON');
  }
  if (legacySalesExists && salesTableSql.includes("'fiado'") && salesTableSql.includes("'zelle'") && salesTableSql.includes("'otro'") && salesTableSql.includes('cliente_fiado_id')) {
    database.exec('DROP TABLE ventas_legacy');
  }
  if (!salesTableSql.includes("'fiado'") || !salesTableSql.includes("'zelle'") || !salesTableSql.includes("'otro'") || !salesTableSql.includes('cliente_fiado_id')) {
    database.pragma('foreign_keys = OFF');
    database.transaction(() => {
      database.exec(`
        CREATE TABLE ventas_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          total REAL NOT NULL CHECK (total >= 0),
          ganancia REAL NOT NULL DEFAULT 0 CHECK (ganancia >= 0),
          metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'pago_movil', 'transferencia', 'zelle', 'binance', 'divisas', 'fiado', 'otro')),
          metodo_pago_otro TEXT NOT NULL DEFAULT '',
          cliente_fiado_id INTEGER REFERENCES clientes_fiado(id),
          moneda TEXT NOT NULL DEFAULT 'USD',
          tasa_cambio REAL NOT NULL DEFAULT 1,
          total_bs REAL NOT NULL DEFAULT 0,
          usuario_id INTEGER REFERENCES usuarios(id),
          creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO ventas_new (id, total, ganancia, metodo_pago, metodo_pago_otro, cliente_fiado_id, usuario_id, creado_en)
        SELECT id, total, ganancia, metodo_pago, '', NULL, usuario_id, creado_en FROM ventas;
        DROP TABLE ventas;
        ALTER TABLE ventas_new RENAME TO ventas;
      `);
    })();
    database.pragma('foreign_keys = ON');
  }
  const saleCurrencyColumns = database.prepare('PRAGMA table_info(ventas)').all();
  if (!saleCurrencyColumns.some((column) => column.name === 'moneda')) database.exec("ALTER TABLE ventas ADD COLUMN moneda TEXT NOT NULL DEFAULT 'USD'");
  if (!saleCurrencyColumns.some((column) => column.name === 'tasa_cambio')) database.exec('ALTER TABLE ventas ADD COLUMN tasa_cambio REAL NOT NULL DEFAULT 1');
  if (!saleCurrencyColumns.some((column) => column.name === 'total_bs')) database.exec('ALTER TABLE ventas ADD COLUMN total_bs REAL NOT NULL DEFAULT 0');
  if (!saleCurrencyColumns.some((column) => column.name === 'caja_id')) database.exec('ALTER TABLE ventas ADD COLUMN caja_id INTEGER REFERENCES sesiones_caja(id)');
  if (!saleCurrencyColumns.some((column) => column.name === 'estado')) database.exec("ALTER TABLE ventas ADD COLUMN estado TEXT NOT NULL DEFAULT 'activa'");
  if (!saleCurrencyColumns.some((column) => column.name === 'anulada_en')) database.exec('ALTER TABLE ventas ADD COLUMN anulada_en TEXT');
  if (!saleCurrencyColumns.some((column) => column.name === 'anulada_por')) database.exec('ALTER TABLE ventas ADD COLUMN anulada_por INTEGER');
  if (!saleCurrencyColumns.some((column) => column.name === 'motivo_anulacion')) database.exec("ALTER TABLE ventas ADD COLUMN motivo_anulacion TEXT NOT NULL DEFAULT ''");
  if (!saleCurrencyColumns.some((column) => column.name === 'metodo_pago_otro')) database.exec("ALTER TABLE ventas ADD COLUMN metodo_pago_otro TEXT NOT NULL DEFAULT ''");
  const cashColumns = database.prepare('PRAGMA table_info(sesiones_caja)').all();
  if (!cashColumns.some((column) => column.name === 'monto_inicial_bs')) database.exec('ALTER TABLE sesiones_caja ADD COLUMN monto_inicial_bs REAL NOT NULL DEFAULT 0');
  if (!cashColumns.some((column) => column.name === 'monto_contado_bs')) database.exec('ALTER TABLE sesiones_caja ADD COLUMN monto_contado_bs REAL');
  if (!cashColumns.some((column) => column.name === 'esperado_bs')) database.exec('ALTER TABLE sesiones_caja ADD COLUMN esperado_bs REAL');
  if (!cashColumns.some((column) => column.name === 'diferencia_bs')) database.exec('ALTER TABLE sesiones_caja ADD COLUMN diferencia_bs REAL');
  if (!cashColumns.some((column) => column.name === 'tasa_cambio')) database.exec('ALTER TABLE sesiones_caja ADD COLUMN tasa_cambio REAL NOT NULL DEFAULT 1');
  const paymentTableSql = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'abonos_fiado'").get()?.sql || '';
  if (!paymentTableSql.includes("'zelle'")) {
    database.pragma('foreign_keys = OFF');
    database.transaction(() => {
      database.exec(`
        ALTER TABLE abonos_fiado RENAME TO abonos_fiado_legacy;
        CREATE TABLE abonos_fiado (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cliente_fiado_id INTEGER NOT NULL REFERENCES clientes_fiado(id),
          monto REAL NOT NULL CHECK (monto > 0),
          metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'pago_movil', 'transferencia', 'zelle', 'binance', 'divisas')),
          usuario_id INTEGER REFERENCES usuarios(id),
          creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO abonos_fiado (id, cliente_fiado_id, monto, metodo_pago, usuario_id, creado_en)
        SELECT id, cliente_fiado_id, monto, metodo_pago, usuario_id, creado_en FROM abonos_fiado_legacy;
        DROP TABLE abonos_fiado_legacy;
      `);
    })();
    database.pragma('foreign_keys = ON');
  }
  const userTableSql = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'").get()?.sql || '';
  if (!userTableSql.includes("'encargado'")) {
    database.pragma('foreign_keys = OFF');
    database.transaction(() => {
      database.exec(`
        ALTER TABLE usuarios RENAME TO usuarios_legacy;
        CREATE TABLE usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          rol TEXT NOT NULL CHECK (rol IN ('admin', 'encargado', 'cajero')),
          pin_hash TEXT NOT NULL,
          pin_salt TEXT NOT NULL,
          permisos TEXT NOT NULL DEFAULT '{}',
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO usuarios (id, nombre, rol, pin_hash, pin_salt, activo, creado_en)
        SELECT id, nombre, rol, pin_hash, pin_salt, activo, creado_en FROM usuarios_legacy;
        DROP TABLE usuarios_legacy;
      `);
    })();
    database.pragma('foreign_keys = ON');
  }
  const userColumns = database.prepare('PRAGMA table_info(usuarios)').all();
  if (!userColumns.some((column) => column.name === 'permisos')) {
    database.exec("ALTER TABLE usuarios ADD COLUMN permisos TEXT NOT NULL DEFAULT '{}'");
  }
  if (!userColumns.some((column) => column.name === 'recuperacion_hash')) {
    database.exec("ALTER TABLE usuarios ADD COLUMN recuperacion_hash TEXT NOT NULL DEFAULT ''");
    database.exec("ALTER TABLE usuarios ADD COLUMN recuperacion_salt TEXT NOT NULL DEFAULT ''");
  }
  const saleColumns = database.prepare('PRAGMA table_info(ventas)').all();
  if (!saleColumns.some((column) => column.name === 'ganancia')) {
    database.exec('ALTER TABLE ventas ADD COLUMN ganancia REAL NOT NULL DEFAULT 0 CHECK (ganancia >= 0)');
  }
  if (!saleColumns.some((column) => column.name === 'usuario_id')) {
    database.exec('ALTER TABLE ventas ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)');
  }
  database.exec(`CREATE TABLE IF NOT EXISTS pagos_venta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    metodo_pago TEXT NOT NULL,
    metodo_pago_otro TEXT NOT NULL DEFAULT '',
    moneda TEXT NOT NULL CHECK (moneda IN ('USD', 'BS')),
    monto REAL NOT NULL CHECK (monto > 0),
    monto_usd REAL NOT NULL CHECK (monto_usd > 0),
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  database.exec(`INSERT INTO pagos_venta (venta_id, metodo_pago, metodo_pago_otro, moneda, monto, monto_usd)
    SELECT v.id, v.metodo_pago, v.metodo_pago_otro, v.moneda,
      CASE WHEN v.moneda = 'BS' THEN v.total_bs ELSE v.total END, v.total
    FROM ventas v
    WHERE NOT EXISTS (SELECT 1 FROM pagos_venta p WHERE p.venta_id = v.id)`);
  const productColumns = database.prepare('PRAGMA table_info(productos)').all();
  if (!productColumns.some((column) => column.name === 'categoria')) {
    database.exec("ALTER TABLE productos ADD COLUMN categoria TEXT NOT NULL DEFAULT 'Otros'");
  }
  if (!productColumns.some((column) => column.name === 'icono')) database.exec("ALTER TABLE productos ADD COLUMN icono TEXT NOT NULL DEFAULT '◈'");
  if (!productColumns.some((column) => column.name === 'imagen')) database.exec("ALTER TABLE productos ADD COLUMN imagen TEXT NOT NULL DEFAULT ''");
  if (!productColumns.some((column) => column.name === 'color')) database.exec("ALTER TABLE productos ADD COLUMN color TEXT NOT NULL DEFAULT 'cyan'");
  if (!productColumns.some((column) => column.name === 'favorito')) database.exec('ALTER TABLE productos ADD COLUMN favorito INTEGER NOT NULL DEFAULT 0');
  if (!productColumns.some((column) => column.name === 'costo')) {
    database.exec('ALTER TABLE productos ADD COLUMN costo REAL NOT NULL DEFAULT 0 CHECK (costo >= 0)');
  }
  if (!productColumns.some((column) => column.name === 'moneda_precio')) database.exec("ALTER TABLE productos ADD COLUMN moneda_precio TEXT NOT NULL DEFAULT 'USD'");
  if (!productColumns.some((column) => column.name === 'moneda_costo')) database.exec("ALTER TABLE productos ADD COLUMN moneda_costo TEXT NOT NULL DEFAULT 'USD'");

  return databasePath;
}

function assertDatabase() {
  if (!database) throw new Error('La base de datos no ha sido inicializada.');
  return database;
}

function recordAudit({ usuarioId = null, accion, entidad, entidadId = null, detalle = '' }) {
  assertDatabase().prepare(`
    INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (?, ?, ?, ?, ?)
  `).run(usuarioId || null, String(accion), String(entidad), entidadId || null, String(detalle));
}

function getBusinessConfig() {
  return assertDatabase().prepare(`
    SELECT nombre, rif, direccion, telefono, mensaje_ticket AS mensajeTicket
    FROM configuracion_negocio WHERE id = 1
  `).get();
}

function saveBusinessConfig(input) {
  const db = assertDatabase();
  requireActiveUser(input.usuarioId, ['admin']);
  const values = {
    nombre: String(input.nombre || '').trim(),
    rif: String(input.rif || '').trim(),
    direccion: String(input.direccion || '').trim(),
    telefono: String(input.telefono || '').trim(),
    mensajeTicket: String(input.mensajeTicket || '').trim()
  };
  if (!values.nombre || values.nombre.length > 120) throw new Error('El nombre comercial es obligatorio y debe tener máximo 120 caracteres.');
  if (values.rif.length > 40 || values.direccion.length > 180 || values.telefono.length > 40 || values.mensajeTicket.length > 120) {
    throw new Error('Uno de los datos del negocio supera el límite permitido.');
  }
  db.prepare(`
    UPDATE configuracion_negocio
    SET nombre = ?, rif = ?, direccion = ?, telefono = ?, mensaje_ticket = ?, actualizado_en = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(values.nombre, values.rif, values.direccion, values.telefono, values.mensajeTicket);
  recordAudit({ usuarioId: input.usuarioId, accion: 'actualizar', entidad: 'configuracion_negocio', detalle: 'Datos comerciales actualizados' });
  return getBusinessConfig();
}

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: crypto.scryptSync(String(pin), salt, 64).toString('hex')
  };
}

function hasUsers() {
  return assertDatabase().prepare('SELECT EXISTS (SELECT 1 FROM usuarios WHERE activo = 1) AS configured').get().configured === 1;
}

function setupAdmin({ nombre, pin }) {
  const db = assertDatabase();
  if (hasUsers()) throw new Error('El administrador ya está configurado.');
  const cleanName = String(nombre || '').trim();
  if (!cleanName || !/^\d{4,8}$/.test(String(pin))) throw new Error('Usa un nombre y un PIN de 4 a 8 dígitos.');
  const credentials = hashPin(pin);
  const recoveryCode = crypto.randomBytes(5).toString('hex').toUpperCase();
  const recovery = hashPin(recoveryCode);
  const result = db.prepare(`
    INSERT INTO usuarios (nombre, rol, pin_hash, pin_salt, permisos, recuperacion_hash, recuperacion_salt)
    VALUES (?, 'admin', ?, ?, ?, ?, ?)
  `).run(cleanName, credentials.hash, credentials.salt, JSON.stringify({ all: true }), recovery.hash, recovery.salt);
  activeUserId = Number(result.lastInsertRowid);
  return { id: result.lastInsertRowid, nombre: cleanName, rol: 'admin', recoveryCode };
}

function listUsers() {
  return assertDatabase().prepare(`
    SELECT id, nombre, rol, permisos, activo, creado_en
    FROM usuarios
    ORDER BY rol, nombre COLLATE NOCASE
  `).all().map((user) => ({ ...user, permisos: JSON.parse(user.permisos || '{}') }));
}

function saveUser(input) {
  const db = assertDatabase();
  requireActiveUser(input.usuarioId, ['admin']);
  const nombre = String(input.nombre || '').trim();
  const pin = String(input.pin || '');
  const rol = input.rol === 'encargado' ? 'encargado' : 'cajero';
  const permisos = input.permisos && typeof input.permisos === 'object' ? input.permisos : {};
  if (!nombre) throw new Error('El nombre del usuario es obligatorio.');
  if (input.id) {
    const existing = db.prepare('SELECT id, rol, activo FROM usuarios WHERE id = ?').get(Number(input.id));
    if (!existing) throw new Error('El usuario no existe.');
    if (existing.rol === 'admin') throw new Error('El administrador principal se gestiona desde su propia configuración.');
    if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('El PIN debe tener entre 4 y 8 dígitos.');
    if (pin) {
      const credentials = hashPin(pin);
      db.prepare(`
        UPDATE usuarios
        SET nombre = ?, rol = ?, pin_hash = ?, pin_salt = ?, permisos = ?
        WHERE id = ?
      `).run(nombre, rol, credentials.hash, credentials.salt, JSON.stringify(permisos), Number(input.id));
    } else {
      db.prepare('UPDATE usuarios SET nombre = ?, rol = ?, permisos = ? WHERE id = ?')
        .run(nombre, rol, JSON.stringify(permisos), Number(input.id));
    }
    recordAudit({ usuarioId: input.usuarioId, accion: 'actualizar', entidad: 'usuario', entidadId: Number(input.id), detalle: `Perfil actualizado: ${nombre}` });
    return Number(input.id);
  }
  if (!/^\d{4,8}$/.test(pin)) throw new Error('El PIN debe tener entre 4 y 8 dígitos.');
  const credentials = hashPin(pin);
  const result = db.prepare(`
    INSERT INTO usuarios (nombre, rol, pin_hash, pin_salt, permisos)
    VALUES (?, ?, ?, ?, ?)
  `).run(nombre, rol, credentials.hash, credentials.salt, JSON.stringify(permisos));
  recordAudit({ usuarioId: input.usuarioId, accion: 'crear', entidad: 'usuario', entidadId: result.lastInsertRowid, detalle: `Perfil creado: ${nombre}` });
  return result.lastInsertRowid;
}

function setUserActive({ id, activo, usuarioId }) {
  const db = assertDatabase();
  requireActiveUser(usuarioId, ['admin']);
  const userId = Number(id);
  const existing = db.prepare('SELECT id, nombre, rol, activo FROM usuarios WHERE id = ?').get(userId);
  if (!existing) throw new Error('El usuario no existe.');
  if (existing.rol === 'admin') throw new Error('El administrador principal no se puede desactivar.');
  if (userId === Number(usuarioId)) throw new Error('No puedes desactivar tu propia sesión.');
  const nextActive = activo ? 1 : 0;
  db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(nextActive, userId);
  recordAudit({ usuarioId, accion: nextActive ? 'activar' : 'desactivar', entidad: 'usuario', entidadId: userId, detalle: `Perfil ${nextActive ? 'activado' : 'desactivado'}: ${existing.nombre}` });
  return { id: userId, activo: nextActive };
}

function updateAdminPin({ usuarioId, pin }) {
  const db = assertDatabase();
  requireActiveUser(usuarioId, ['admin']);
  if (!/^\d{4,8}$/.test(String(pin))) throw new Error('El PIN debe tener entre 4 y 8 dígitos.');
  const credentials = hashPin(pin);
  const result = db.prepare(`
    UPDATE usuarios SET pin_hash = ?, pin_salt = ? WHERE rol = 'admin' AND activo = 1
  `).run(credentials.hash, credentials.salt);
  if (result.changes !== 1) throw new Error('No existe un administrador activo.');
}

function resetAdminPin(recoveryCode, newPin) {
  const db = assertDatabase();
  if (!/^\d{4,8}$/.test(String(newPin))) throw new Error('El nuevo PIN debe tener entre 4 y 8 dígitos.');
  const admin = db.prepare("SELECT id, recuperacion_hash, recuperacion_salt FROM usuarios WHERE rol = 'admin' AND activo = 1").get();
  if (!admin || !admin.recuperacion_hash) throw new Error('No hay código de recuperación configurado.');
  const candidate = hashPin(recoveryCode, admin.recuperacion_salt).hash;
  if (!crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(admin.recuperacion_hash, 'hex'))) {
    throw new Error('Código de recuperación incorrecto.');
  }

  const credentials = hashPin(newPin);
  db.prepare('UPDATE usuarios SET pin_hash = ?, pin_salt = ? WHERE id = ?').run(credentials.hash, credentials.salt, admin.id);
}

function regenerateAdminRecovery() {
  const db = assertDatabase();
  const admin = db.prepare("SELECT id FROM usuarios WHERE rol = 'admin' AND activo = 1").get();
  if (!admin) throw new Error('No existe un administrador activo.');
  const recoveryCode = crypto.randomBytes(5).toString('hex').toUpperCase();
  const recovery = hashPin(recoveryCode);
  db.prepare('UPDATE usuarios SET recuperacion_hash = ?, recuperacion_salt = ? WHERE id = ?')
    .run(recovery.hash, recovery.salt, admin.id);
  return recoveryCode;
}

function verifyPin(pin, requiredRole = 'admin') {
  const user = assertDatabase().prepare(`
    SELECT id, nombre, rol, pin_hash, pin_salt
    FROM usuarios
    WHERE activo = 1 AND rol = ? LIMIT 1
  `).get(requiredRole);
  if (!user) throw new Error('No existe un usuario administrador configurado.');
  const candidate = hashPin(pin, user.pin_salt).hash;
  if (!crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(user.pin_hash, 'hex'))) {
    throw new Error('PIN incorrecto.');
  }
  activeUserId = user.id;

  return { id: user.id, nombre: user.nombre, rol: user.rol };
}

function loginUser({ id, pin }) {
  const user = assertDatabase().prepare(`
    SELECT id, nombre, rol, pin_hash, pin_salt, permisos
    FROM usuarios WHERE id = ? AND activo = 1
  `).get(Number(id));
  if (!user) throw new Error('Usuario no disponible.');
  const candidate = hashPin(pin, user.pin_salt).hash;
  if (!crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(user.pin_hash, 'hex'))) {
    throw new Error('PIN incorrecto.');
  }
  activeUserId = user.id;

  return { id: user.id, nombre: user.nombre, rol: user.rol, permisos: JSON.parse(user.permisos || '{}') };
}

function logoutUser() {
  activeUserId = null;
  return true;
}

function requireActiveUser(usuarioId, allowedRoles = null) {
  const id = Number(usuarioId);
  if (!Number.isInteger(id) || id <= 0 || activeUserId !== id) throw new Error('La sesión de usuario no es válida.');
  const user = assertDatabase().prepare('SELECT id, rol, activo FROM usuarios WHERE id = ?').get(id);
  if (!user || !user.activo) throw new Error('El usuario ya no está activo.');
  if (allowedRoles && !allowedRoles.includes(user.rol)) throw new Error('El usuario no tiene permiso para esta acción.');
  return user;
}

function requirePermission(usuarioId, permission, allowedRoles = null) {
  const user = requireActiveUser(usuarioId, allowedRoles);
  if (user.rol === 'admin') return user;
  const stored = assertDatabase().prepare('SELECT permisos FROM usuarios WHERE id = ?').get(user.id);
  const permissions = JSON.parse(stored?.permisos || '{}');
  if (!permissions.all && !permissions[permission]) throw new Error('El usuario no tiene permiso para esta acción.');
  return user;
}

function listProducts(search = '') {
  const db = assertDatabase();
  const term = `%${String(search).trim()}%`;
  return db.prepare(`
    SELECT id, nombre, codigo, precio, moneda_precio AS monedaPrecio, costo, moneda_costo AS monedaCosto, stock, unidad, categoria, icono, imagen, color, favorito
    FROM productos
    WHERE activo = 1 AND (nombre LIKE ? OR COALESCE(codigo, '') LIKE ?)
    ORDER BY nombre COLLATE NOCASE
  `).all(term, term);
}

function saveProduct(input) {
  const db = assertDatabase();
  requirePermission(input.usuarioId, 'inventory');
  const nombre = String(input.nombre || '').trim();
  const codigo = String(input.codigo || '').trim() || null;
  const precio = Math.round(Number(input.precio) * 100) / 100;
  const monedaPrecio = input.monedaPrecio === 'BS' ? 'BS' : 'USD';
  const costo = Math.round(Number(input.costo ?? 0) * 100) / 100;
  const monedaCosto = input.monedaCosto === 'BS' ? 'BS' : 'USD';
  const stock = Number(input.stock);
  const unidad = input.unidad;
  const categoria = String(input.categoria || 'Otros').trim();
  const icono = String(input.icono || '◈').trim().slice(0, 4) || '◈';
  const imagen = String(input.imagen || '').trim();
  const color = String(input.color || 'cyan').trim();
  const favorito = input.favorito ? 1 : 0;

  if (!nombre) throw new Error('El nombre del producto es obligatorio.');
  if (!Number.isFinite(precio) || precio < 0) throw new Error('El precio debe ser un número mayor o igual a cero.');
  if (!Number.isFinite(costo) || costo < 0) throw new Error('El costo debe ser un número mayor o igual a cero.');
  if (!Number.isFinite(stock) || stock < 0) throw new Error('El stock debe ser un número mayor o igual a cero.');
  if (!categoria || categoria.length > 40) throw new Error('La categoría no es válida.');
  if (imagen && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(imagen)) throw new Error('La imagen del producto no es válida.');
  if (imagen.length > 1400000) throw new Error('La imagen es demasiado grande. Usa una imagen menor de 1 MB.');
  if (!['cyan', 'amber', 'rose', 'violet', 'blue'].includes(color)) throw new Error('El color del producto no es válido.');
  if (!['unidad', 'kg', 'g'].includes(unidad)) throw new Error('Unidad de inventario no válida.');

  if (input.id) {
    db.prepare(`
      UPDATE productos
      SET nombre = ?, codigo = ?, precio = ?, moneda_precio = ?, costo = ?, moneda_costo = ?, stock = ?, unidad = ?, categoria = ?, icono = ?, imagen = ?, color = ?, favorito = ?, actualizado_en = CURRENT_TIMESTAMP
      WHERE id = ? AND activo = 1
    `).run(nombre, codigo, precio, monedaPrecio, costo, monedaCosto, stock, unidad, categoria, icono, imagen, color, favorito, Number(input.id));
    recordAudit({ usuarioId: input.usuarioId, accion: 'actualizar', entidad: 'producto', entidadId: Number(input.id), detalle: `Producto: ${nombre}` });
    return Number(input.id);
  }

  const result = db.prepare(`
    INSERT INTO productos (nombre, codigo, precio, moneda_precio, costo, moneda_costo, stock, unidad, categoria, icono, imagen, color, favorito)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nombre, codigo, precio, monedaPrecio, costo, monedaCosto, stock, unidad, categoria, icono, imagen, color, favorito);
  recordAudit({ usuarioId: input.usuarioId, accion: 'crear', entidad: 'producto', entidadId: result.lastInsertRowid, detalle: `Producto: ${nombre}` });
  return result.lastInsertRowid;
}

function archiveProduct(id, usuarioId = null) {
  requirePermission(usuarioId, 'inventory');
  assertDatabase().prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(Number(id));
  recordAudit({ usuarioId, accion: 'archivar', entidad: 'producto', entidadId: Number(id), detalle: 'Producto retirado del inventario' });
}

function createSale({ items, metodoPago, metodoPagoOtro = '', pagos = null, clienteFiadoId = null, moneda = 'USD', tasaCambio = null, usuarioId = null, cajaId = null }) {
  const db = assertDatabase();
  requireActiveUser(usuarioId);
  if (!Array.isArray(items) || items.length === 0) throw new Error('El carrito está vacío.');
  const otherPayment = String(metodoPagoOtro || '').trim().slice(0, 80);
  const isMixed = Array.isArray(pagos) && pagos.length > 0;
  if (!['efectivo', 'pago_movil', 'transferencia', 'zelle', 'binance', 'divisas', 'fiado', 'otro'].includes(metodoPago) && !isMixed) throw new Error('Método de pago no válido.');
  if (metodoPago === 'otro' && !otherPayment && !isMixed) throw new Error('Especifica el método de pago.');
  if (!['USD', 'BS'].includes(moneda)) throw new Error('Moneda no válida.');
  if (metodoPago === 'fiado' && !Number.isInteger(Number(clienteFiadoId))) throw new Error('Selecciona el cliente del fiado.');
  if (metodoPago === 'fiado') requirePermission(usuarioId, 'fiado');
  const activeCash = getOpenCashSession();
  if (!activeCash) throw new Error('Abre una caja antes de registrar ventas.');
  const dailyRate = Number(tasaCambio ?? activeCash.tasa_cambio);
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) throw new Error('La tasa de cambio diaria no es válida.');
  const activeCashId = Number(cajaId || activeCash.id);
  if (activeCashId !== Number(activeCash.id)) throw new Error('La sesión de caja ya no está activa.');

  const transaction = db.transaction(() => {
    const getProduct = db.prepare('SELECT id, precio, moneda_precio AS monedaPrecio, costo, moneda_costo AS monedaCosto, stock FROM productos WHERE id = ? AND activo = 1');
    const updateStock = db.prepare('UPDATE productos SET stock = stock - ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?');
    const insertDetail = db.prepare(`
      INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);

    const normalized = items.map((item) => {
      const product = getProduct.get(Number(item.productoId));
      const cantidad = Number(item.cantidad);
      if (!product || !Number.isFinite(cantidad) || cantidad <= 0) throw new Error('Producto o cantidad inválida.');
      if (product.stock < cantidad) throw new Error(`Stock insuficiente para el producto #${product.id}.`);
      const precioUsd = product.monedaPrecio === 'BS' ? product.precio / dailyRate : product.precio;
      const costoUsd = product.monedaCosto === 'BS' ? product.costo / dailyRate : product.costo;
      return { ...product, cantidad, precioUsd, subtotal: precioUsd * cantidad, ganancia: (precioUsd - costoUsd) * cantidad };
    });
    const total = normalized.reduce((sum, item) => sum + item.subtotal, 0);
    const ganancia = normalized.reduce((sum, item) => sum + item.ganancia, 0);
    if (metodoPago === 'fiado') {
      const customer = db.prepare('SELECT id FROM clientes_fiado WHERE id = ? AND activo = 1').get(Number(clienteFiadoId));
      if (!customer) throw new Error('Cliente de fiado no disponible.');
    }
    const rate = Math.round(dailyRate * 100) / 100;
    const roundedTotal = Math.round(total * 100) / 100;
    const totalBs = Math.round(roundedTotal * rate * 100) / 100;
    const normalizedPayments = isMixed
      ? pagos.map((payment) => {
        const method = String(payment.metodoPago || '').trim();
        const currency = String(payment.moneda || '').toUpperCase();
        const amount = Number(payment.monto);
        const other = String(payment.metodoPagoOtro || '').trim().slice(0, 80);
        if (!['efectivo', 'pago_movil', 'transferencia', 'zelle', 'binance', 'divisas', 'fiado', 'otro'].includes(method) || !['USD', 'BS'].includes(currency) || !Number.isFinite(amount) || amount <= 0) {
          throw new Error('Línea de pago mixta inválida.');
        }
        if (method === 'otro' && !other) throw new Error('Especifica el método de pago.');
        if (method === 'fiado') throw new Error('Fiado no se puede combinar en un pago mixto.');
        return { metodoPago: method, metodoPagoOtro: other, moneda: currency, monto: Math.round(amount * 100) / 100, montoUsd: Math.round((currency === 'BS' ? amount / rate : amount) * 100) / 100 };
      })
      : [{ metodoPago, metodoPagoOtro: otherPayment, moneda, monto: moneda === 'BS' ? totalBs : roundedTotal, montoUsd: roundedTotal }];
    if (isMixed && normalizedPayments.length < 2) throw new Error('Agrega al menos dos líneas para usar pago mixto.');
    const paidUsd = normalizedPayments.reduce((sum, payment) => sum + payment.montoUsd, 0);
    const changeUsd = Math.round((paidUsd - roundedTotal) * 100) / 100;
    if (paidUsd + 0.005 < roundedTotal) throw new Error('Los pagos no cubren el total de la venta.');
    if (changeUsd > 0 && !normalizedPayments.some((payment) => payment.metodoPago === 'efectivo')) throw new Error('El vuelto solo puede entregarse en efectivo.');
    if (changeUsd > 0) {
      const cash = normalizedPayments.find((payment) => payment.metodoPago === 'efectivo');
      const changeInCashCurrency = cash.moneda === 'BS' ? changeUsd * rate : changeUsd;
      cash.monto = Math.round((cash.monto - changeInCashCurrency) * 100) / 100;
      cash.montoUsd = Math.round((cash.montoUsd - changeUsd) * 100) / 100;
      if (cash.monto <= 0 || cash.montoUsd <= 0) throw new Error('El efectivo recibido no puede ser menor que el vuelto.');
    }
    const saleMethod = isMixed ? 'otro' : metodoPago;
    const saleOther = isMixed ? 'Pago mixto' : otherPayment;
    const sale = db.prepare('INSERT INTO ventas (total, ganancia, metodo_pago, metodo_pago_otro, cliente_fiado_id, moneda, tasa_cambio, total_bs, usuario_id, caja_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(roundedTotal, Math.round(ganancia * 100) / 100, saleMethod, saleOther, metodoPago === 'fiado' ? Number(clienteFiadoId) : null, moneda, rate, totalBs, usuarioId || null, activeCashId);
    const insertPayment = db.prepare('INSERT INTO pagos_venta (venta_id, metodo_pago, metodo_pago_otro, moneda, monto, monto_usd) VALUES (?, ?, ?, ?, ?, ?)');
    normalizedPayments.forEach((payment) => insertPayment.run(sale.lastInsertRowid, payment.metodoPago, payment.metodoPagoOtro, payment.moneda, payment.monto, payment.montoUsd));
    recordAudit({ usuarioId, accion: 'crear', entidad: 'venta', entidadId: sale.lastInsertRowid, detalle: `Total ${roundedTotal} ${moneda}; método ${metodoPago === 'otro' ? otherPayment : metodoPago}` });
    normalized.forEach((item) => {
      const updated = updateStock.run(item.cantidad, item.id, item.cantidad);
      if (updated.changes !== 1) throw new Error('El stock cambió mientras se procesaba la venta.');
      insertDetail.run(sale.lastInsertRowid, item.id, item.cantidad, item.precioUsd, item.subtotal);
      db.prepare(`
        INSERT INTO movimientos_inventario (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, venta_id)
        VALUES (?, ?, 'salida', ?, ?, ?, ?, ?)
      `).run(item.id, usuarioId || null, item.cantidad, item.stock, item.stock - item.cantidad, 'Venta', sale.lastInsertRowid);
    });
    return { id: sale.lastInsertRowid, total: roundedTotal, moneda, tasaCambio: rate, totalBs, pagos: normalizedPayments, vueltoUsd: changeUsd, metodoPago: saleMethod, metodoPagoOtro: saleOther };
  });

  return transaction();
}

function listCreditCustomers() {
  const db = assertDatabase();
  return db.prepare(`
    SELECT c.id, c.nombre, c.nota,
      COALESCE((SELECT SUM(v.total) FROM ventas v WHERE v.cliente_fiado_id = c.id AND v.estado = 'activa'), 0) -
      COALESCE((SELECT SUM(a.monto) FROM abonos_fiado a WHERE a.cliente_fiado_id = c.id), 0) AS saldo
    FROM clientes_fiado c
    WHERE c.activo = 1
    ORDER BY c.nombre COLLATE NOCASE
  `).all();
}

function saveCreditCustomer({ id, nombre, nota = '', usuarioId = null }) {
  const db = assertDatabase();
  requirePermission(usuarioId, 'fiado');
  const cleanName = String(nombre || '').trim();
  if (!cleanName) throw new Error('El nombre o alias del cliente es obligatorio.');
  if (id) {
    db.prepare('UPDATE clientes_fiado SET nombre = ?, nota = ? WHERE id = ? AND activo = 1').run(cleanName, String(nota), Number(id));
    recordAudit({ usuarioId, accion: 'actualizar', entidad: 'cliente_fiado', entidadId: Number(id), detalle: `Cliente: ${cleanName}` });
    return Number(id);
  }
  const result = db.prepare('INSERT INTO clientes_fiado (nombre, nota) VALUES (?, ?)').run(cleanName, String(nota));
  recordAudit({ usuarioId, accion: 'crear', entidad: 'cliente_fiado', entidadId: result.lastInsertRowid, detalle: `Cliente: ${cleanName}` });
  return result.lastInsertRowid;
}

function createCreditPayment({ clienteId, monto, metodoPago, usuarioId = null }) {
  const db = assertDatabase();
  requirePermission(usuarioId, 'fiado');
  const amount = Number(monto);
  if (!Number.isInteger(Number(clienteId)) || !Number.isFinite(amount) || amount <= 0) throw new Error('Cliente y monto de abono inválidos.');
  if (!['efectivo', 'pago_movil', 'transferencia', 'zelle', 'binance', 'divisas'].includes(metodoPago)) throw new Error('Método de abono no válido.');
  const customer = listCreditCustomers().find((item) => item.id === Number(clienteId));
  if (!customer) throw new Error('Cliente de fiado no disponible.');
  if (amount > Number(customer.saldo) + 0.005) throw new Error('El abono no puede superar el saldo pendiente.');
  const result = db.prepare('INSERT INTO abonos_fiado (cliente_fiado_id, monto, metodo_pago, usuario_id) VALUES (?, ?, ?, ?)')
    .run(Number(clienteId), amount, metodoPago, usuarioId || null);
  recordAudit({ usuarioId, accion: 'crear', entidad: 'abono_fiado', entidadId: result.lastInsertRowid, detalle: `Monto ${amount}; método ${metodoPago}` });
  return result.lastInsertRowid;
}

function getAuditLog(limit = 100) {
  return assertDatabase().prepare(`
    SELECT a.id, a.accion, a.entidad, a.entidad_id AS entidadId, a.detalle,
      a.creado_en AS creadoEn, COALESCE(u.nombre, 'Sistema') AS usuario
    FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
    ORDER BY a.id DESC LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 100, 1), 500));
}

function getOpenCashSession() {
  return assertDatabase().prepare(`
    SELECT c.*, COALESCE(u.nombre, 'Desconocido') AS usuario
    FROM sesiones_caja c LEFT JOIN usuarios u ON u.id = c.usuario_apertura_id
    WHERE c.estado = 'abierta' ORDER BY c.id DESC LIMIT 1
  `).get() || null;
}

function openCashSession({ usuarioId, montoInicial = 0, montoInicialBs = 0, tasaCambio = 1 }) {
  const db = assertDatabase();
  requireActiveUser(usuarioId, ['admin', 'encargado']);
  const amount = Number(montoInicial);
  const amountBs = Number(montoInicialBs);
  const rate = Math.round(Number(tasaCambio) * 100) / 100;
  if (!Number.isInteger(Number(usuarioId)) || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(amountBs) || amountBs < 0 || !Number.isFinite(rate) || rate <= 0) throw new Error('Usuario, monto inicial o tasa inválida.');
  if (getOpenCashSession()) throw new Error('Ya existe una caja abierta.');
  const result = db.prepare('INSERT INTO sesiones_caja (usuario_apertura_id, monto_inicial, monto_inicial_bs, tasa_cambio) VALUES (?, ?, ?, ?)').run(Number(usuarioId), amount, amountBs, rate);
  recordAudit({ usuarioId, accion: 'abrir', entidad: 'caja', entidadId: result.lastInsertRowid, detalle: `Inicial USD: ${amount}; inicial Bs: ${amountBs}; tasa: ${rate}` });
  return getOpenCashSession();
}

function closeCashSession({ usuarioId, montoContado, montoContadoBs = 0 }) {
  const db = assertDatabase();
  requireActiveUser(usuarioId, ['admin', 'encargado']);
  const session = getOpenCashSession();
  const counted = Number(montoContado);
  const countedBs = Number(montoContadoBs);
  if (!session) throw new Error('No hay una caja abierta.');
  if (!Number.isInteger(Number(usuarioId)) || !Number.isFinite(counted) || counted < 0 || !Number.isFinite(countedBs) || countedBs < 0) throw new Error('Usuario o monto contado inválido.');
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN p.moneda = 'USD' THEN p.monto ELSE 0 END), 0) AS efectivo_usd,
      COALESCE(SUM(CASE WHEN p.moneda = 'BS' THEN p.monto ELSE 0 END), 0) AS efectivo_bs
    FROM pagos_venta p JOIN ventas v ON v.id = p.venta_id
    WHERE p.metodo_pago = 'efectivo' AND v.caja_id = ? AND v.estado = 'activa'
  `).get(session.id);
  const expected = Number(session.monto_inicial) + Number(totals.efectivo_usd);
  const expectedBs = Number(session.monto_inicial_bs) + Number(totals.efectivo_bs);
  const difference = counted - expected;
  const differenceBs = countedBs - expectedBs;
  db.prepare(`
    UPDATE sesiones_caja SET cerrada_en = CURRENT_TIMESTAMP, monto_contado = ?, monto_contado_bs = ?, esperado = ?, esperado_bs = ?, diferencia = ?, diferencia_bs = ?, estado = 'cerrada'
    WHERE id = ? AND estado = 'abierta'
  `).run(counted, countedBs, expected, expectedBs, difference, differenceBs, session.id);
  recordAudit({ usuarioId, accion: 'cerrar', entidad: 'caja', entidadId: session.id, detalle: `USD esperado: ${expected}; contado: ${counted}; diferencia: ${difference}; Bs esperado: ${expectedBs}; contado: ${countedBs}; diferencia: ${differenceBs}` });
  return { ...session, montoContado: counted, montoContadoBs: countedBs, esperado: expected, esperadoBs: expectedBs, diferencia: difference, diferenciaBs: differenceBs };
}

function getSalesSummary() {
  const db = assertDatabase();
  return db.prepare(`
    SELECT
      COUNT(*) AS ventas,
      COALESCE(SUM(total), 0) AS total,
      COALESCE(SUM(ganancia), 0) AS ganancia
    FROM ventas
    WHERE estado = 'activa' AND date(creado_en, 'localtime') = date('now', 'localtime')
  `).get();
}

function getSalesReport({ from, to } = {}) {
  const db = assertDatabase();
  const start = String(from || new Date().toISOString().slice(0, 10));
  const end = String(to || start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    throw new Error('Rango de fechas inválido.');
  }
  const where = `v.estado = 'activa' AND date(v.creado_en, 'localtime') BETWEEN date(?) AND date(?)`;
  const totals = db.prepare(`
    SELECT COUNT(*) AS ventas,
      COALESCE(SUM(v.total), 0) AS total_usd,
      COALESCE(SUM(v.total_bs), 0) AS total_bs,
      COALESCE(SUM(v.ganancia), 0) AS ganancia
    FROM ventas v WHERE ${where}
  `).get(start, end);
  const byPayment = db.prepare(`
    SELECT p.metodo_pago AS metodoPago, p.metodo_pago_otro AS metodoPagoOtro, COUNT(DISTINCT p.venta_id) AS ventas,
      COALESCE(SUM(p.monto_usd), 0) AS totalUsd,
      COALESCE(SUM(CASE WHEN p.moneda = 'BS' THEN p.monto ELSE 0 END), 0) AS totalBs
    FROM pagos_venta p JOIN ventas v ON v.id = p.venta_id WHERE ${where}
    GROUP BY p.metodo_pago, p.metodo_pago_otro ORDER BY totalUsd DESC
  `).all(start, end);
  const recent = db.prepare(`
    SELECT     v.id, v.total, v.total_bs AS totalBs, v.moneda, v.metodo_pago AS metodoPago, v.metodo_pago_otro AS metodoPagoOtro,
      v.creado_en AS creadoEn, COALESCE(u.nombre, 'Sin sesión') AS usuario
    FROM ventas v LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE ${where} ORDER BY v.id DESC LIMIT 100
  `).all(start, end);
  const daily = db.prepare(`
    SELECT date(v.creado_en, 'localtime') AS fecha, COUNT(*) AS ventas,
      COALESCE(SUM(v.total), 0) AS totalUsd,
      COALESCE(SUM(v.ganancia), 0) AS ganancia
    FROM ventas v WHERE ${where}
    GROUP BY date(v.creado_en, 'localtime') ORDER BY fecha
  `).all(start, end);
  const topProducts = db.prepare(`
    SELECT p.nombre, p.unidad, COALESCE(SUM(d.cantidad), 0) AS cantidad,
      COALESCE(SUM(d.subtotal), 0) AS totalUsd
    FROM detalle_ventas d
    JOIN ventas v ON v.id = d.venta_id
    JOIN productos p ON p.id = d.producto_id
    WHERE ${where}
    GROUP BY d.producto_id ORDER BY cantidad DESC, totalUsd DESC LIMIT 10
  `).all(start, end);
  return { from: start, to: end, totals, byPayment, recent, daily, topProducts };
}

function getSaleReceipt(saleId) {
  const db = assertDatabase();
  const sale = db.prepare(`
    SELECT v.id, v.total, v.total_bs AS totalBs, v.moneda,
      v.tasa_cambio AS tasaCambio, v.metodo_pago AS metodoPago, v.metodo_pago_otro AS metodoPagoOtro,
      v.creado_en AS creadoEn, COALESCE(u.nombre, 'Sin sesión') AS usuario
    FROM ventas v
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.id = ? AND v.estado = 'activa'
  `).get(Number(saleId));
  if (!sale) throw new Error('Venta no disponible para reimpresión.');
  const cart = db.prepare(`
    SELECT d.producto_id AS id, p.nombre, d.cantidad,
      d.precio_unitario AS precio, d.subtotal
    FROM detalle_ventas d
    JOIN productos p ON p.id = d.producto_id
    WHERE d.venta_id = ?
    ORDER BY d.id
  `).all(Number(saleId));
  const pagos = db.prepare(`SELECT metodo_pago AS metodoPago, metodo_pago_otro AS metodoPagoOtro, moneda, monto, monto_usd AS montoUsd FROM pagos_venta WHERE venta_id = ? ORDER BY id`).all(Number(saleId));
  return { ...sale, cart, pagos };
}

function cancelSale({ saleId, usuarioId, motivo }) {
  const db = assertDatabase();
  const cleanReason = String(motivo || '').trim();
  if (!Number.isInteger(Number(saleId)) || !Number.isInteger(Number(usuarioId)) || !cleanReason) {
    throw new Error('Venta, usuario y motivo son obligatorios.');
  }
  requireActiveUser(usuarioId, ['admin', 'encargado']);
  const transaction = db.transaction(() => {
    const sale = db.prepare("SELECT id, estado, usuario_id FROM ventas WHERE id = ?").get(Number(saleId));
    if (!sale) throw new Error('Venta no encontrada.');
    if (sale.estado !== 'activa') throw new Error('La venta ya está anulada.');
    const details = db.prepare('SELECT producto_id, cantidad FROM detalle_ventas WHERE venta_id = ?').all(sale.id);
    const getStock = db.prepare('SELECT stock FROM productos WHERE id = ?');
    const updateStock = db.prepare('UPDATE productos SET stock = stock + ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?');
    const insertMovement = db.prepare(`
      INSERT INTO movimientos_inventario (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, venta_id)
      VALUES (?, ?, 'entrada', ?, ?, ?, ?, ?)
    `);
    for (const detail of details) {
      const current = getStock.get(detail.producto_id);
      if (!current) throw new Error('Producto de la venta no disponible para devolver stock.');
      updateStock.run(detail.cantidad, detail.producto_id);
      insertMovement.run(detail.producto_id, usuarioId, detail.cantidad, current.stock, current.stock + detail.cantidad, `Anulación de venta #${sale.id}`, sale.id);
    }
    db.prepare("UPDATE ventas SET estado = 'anulada', anulada_en = CURRENT_TIMESTAMP, anulada_por = ?, motivo_anulacion = ? WHERE id = ? AND estado = 'activa'")
      .run(Number(usuarioId), cleanReason, sale.id);
    recordAudit({ usuarioId, accion: 'anular', entidad: 'venta', entidadId: sale.id, detalle: cleanReason });
  });
  transaction();
}

function getInventoryExport() {
  return assertDatabase().prepare(`
    SELECT nombre, COALESCE(codigo, '') AS codigo, precio, moneda_precio AS monedaPrecio, costo, moneda_costo AS monedaCosto, stock, unidad, activo, creado_en, actualizado_en
    FROM productos
    ORDER BY nombre COLLATE NOCASE
  `).all();
}

function listInventoryMovements(productId = null) {
  const params = [];
  let filter = '';
  if (productId) {
    filter = 'WHERE m.producto_id = ?';
    params.push(Number(productId));
  }
  return assertDatabase().prepare(`
    SELECT m.id, m.producto_id AS productoId, p.nombre AS producto, m.venta_id AS ventaId,
      m.tipo, m.cantidad, m.stock_anterior AS stockAnterior,
      m.stock_nuevo AS stockNuevo, m.motivo, m.creado_en AS creadoEn,
      COALESCE(u.nombre, 'Sistema') AS usuario
    FROM movimientos_inventario m
    JOIN productos p ON p.id = m.producto_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    ${filter}
    ORDER BY m.id DESC LIMIT 200
  `).all(...params);
}

function adjustInventory({ productoId, tipo, cantidad, motivo, usuarioId }) {
  const db = assertDatabase();
  requirePermission(usuarioId, 'inventory');
  const amount = Number(cantidad);
  if (!['entrada', 'salida'].includes(tipo) || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Tipo o cantidad de movimiento inválidos.');
  }

  const product = db.prepare('SELECT id, stock FROM productos WHERE id = ? AND activo = 1').get(Number(productoId));
  if (!product) throw new Error('Producto no disponible.');
  const nextStock = tipo === 'entrada' ? product.stock + amount : product.stock - amount;
  if (nextStock < 0) throw new Error('La salida supera el stock disponible.');
  const transaction = db.transaction(() => {
    db.prepare('UPDATE productos SET stock = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?').run(nextStock, product.id);
    const result = db.prepare(`
      INSERT INTO movimientos_inventario (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(product.id, usuarioId || null, tipo, amount, product.stock, nextStock, String(motivo || '').trim() || 'Ajuste manual');
    recordAudit({ usuarioId, accion: 'ajustar', entidad: 'inventario', entidadId: product.id, detalle: `${tipo} ${amount}; motivo: ${String(motivo || '').trim() || 'Ajuste manual'}` });
    return result.lastInsertRowid;
  });
  return transaction();
}

function registerMerchandise({ productoId, cantidad, costo, monedaCosto = 'USD', motivo, usuarioId }) {
  const db = assertDatabase();
  requirePermission(usuarioId, 'inventory');
  const amount = Number(cantidad);
  const unitCost = Number(costo);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
    throw new Error('Cantidad y costo de mercancía inválidos.');
  }
  const product = db.prepare('SELECT id, stock, costo, moneda_costo AS monedaCosto FROM productos WHERE id = ? AND activo = 1').get(Number(productoId));
  if (!product) throw new Error('Producto no disponible.');
  const nextStock = Number(product.stock) + amount;
  const normalizedCurrency = monedaCosto === 'BS' ? 'BS' : 'USD';
  const averageCost = product.monedaCosto === normalizedCurrency && nextStock > 0
    ? ((Number(product.stock) * Number(product.costo)) + (amount * unitCost)) / nextStock
    : unitCost;
  const transaction = db.transaction(() => {
    db.prepare('UPDATE productos SET stock = ?, costo = ?, moneda_costo = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?')
      .run(nextStock, Math.round(averageCost * 100) / 100, normalizedCurrency, product.id);
    db.prepare(`
      INSERT INTO movimientos_inventario (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
      VALUES (?, ?, 'entrada', ?, ?, ?, ?)
    `).run(product.id, usuarioId, amount, product.stock, nextStock, String(motivo || '').trim() || `Mercancía recibida; costo ${unitCost} ${normalizedCurrency}`);
    recordAudit({ usuarioId, accion: 'registrar', entidad: 'mercancia', entidadId: product.id, detalle: `Entrada ${amount}; costo ${unitCost} ${normalizedCurrency}` });
  });
  transaction();
  return { stock: nextStock, costo: Math.round(averageCost * 100) / 100, monedaCosto: normalizedCurrency };
}

function createBackup(userDataPath) {
  const db = assertDatabase();
  db.pragma('wal_checkpoint(TRUNCATE)');
  const backupDirectory = path.join(userDataPath, 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDirectory, `solutec-pos-${stamp}.sqlite`);
  fs.copyFileSync(databasePath, backupPath);
  const backups = fs.readdirSync(backupDirectory)
    .filter((file) => file.endsWith('.sqlite'))
    .sort()
    .reverse();
  backups.slice(10).forEach((file) => fs.unlinkSync(path.join(backupDirectory, file)));
  return { path: backupPath, createdAt: new Date().toISOString() };
}

function exportBackup(destinationPath, userDataPath) {
  const backup = createBackup(userDataPath);
  fs.copyFileSync(backup.path, destinationPath);
  return { path: destinationPath, createdAt: backup.createdAt };
}

function restoreBackup(sourcePath, userDataPath) {
  if (!sourcePath || path.resolve(sourcePath) === path.resolve(databasePath)) {
    throw new Error('Selecciona un archivo de respaldo diferente a la base activa.');
  }
  if (!fs.existsSync(sourcePath)) throw new Error('El archivo de respaldo no existe.');

  const candidate = new Database(sourcePath, { readonly: true });
  try {
    const integrity = candidate.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error('El respaldo no superó la verificación de integridad.');
    const requiredTables = ['productos', 'ventas', 'detalle_ventas', 'usuarios'];
    const tables = candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
    if (!requiredTables.every((table) => tables.includes(table))) {
      throw new Error('El archivo no parece ser un respaldo válido de Solutec POS.');
    }
  } finally {
    candidate.close();
  }

  const activeBackup = `${databasePath}.before-restore-${Date.now()}.sqlite`;
  dbCloseForRestore();
  for (const suffix of ['-wal', '-shm']) {
    const sidecarPath = `${databasePath}${suffix}`;
    if (fs.existsSync(sidecarPath)) fs.unlinkSync(sidecarPath);
  }
  fs.copyFileSync(databasePath, activeBackup);
  try {
    fs.copyFileSync(sourcePath, databasePath);
    initializeDatabase(userDataPath);
  } catch (error) {
    if (fs.existsSync(activeBackup)) fs.copyFileSync(activeBackup, databasePath);
    for (const suffix of ['-wal', '-shm']) {
      const sidecarPath = `${databasePath}${suffix}`;
      if (fs.existsSync(sidecarPath)) fs.unlinkSync(sidecarPath);
    }
    initializeDatabase(userDataPath);
    throw error;
  } finally {
    if (fs.existsSync(activeBackup)) fs.unlinkSync(activeBackup);
  }
}

function dbCloseForRestore() {
  if (database) {
    database.pragma('wal_checkpoint(TRUNCATE)');
    database.close();
  }
  database = undefined;
  activeUserId = null;
}

function closeDatabase() {
  dbCloseForRestore();
  activeUserId = null;
}

module.exports = { initializeDatabase, hasUsers, setupAdmin, verifyPin, loginUser, logoutUser, listUsers, saveUser, setUserActive, getBusinessConfig, saveBusinessConfig, updateAdminPin, resetAdminPin, regenerateAdminRecovery, listProducts, saveProduct, archiveProduct, createSale, cancelSale, listCreditCustomers, saveCreditCustomer, createCreditPayment, getAuditLog, getOpenCashSession, openCashSession, closeCashSession, listInventoryMovements, adjustInventory, registerMerchandise, getSalesSummary, getSalesReport, getSaleReceipt, getInventoryExport, createBackup, exportBackup, restoreBackup, closeDatabase };
