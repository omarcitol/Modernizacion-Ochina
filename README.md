# Solutec POS

Sistema POS local-first para pequeños comercios en Venezuela.

## Estado actual

El prototipo de escritorio incluye:

- Electron con `contextIsolation` y `nodeIntegration` desactivado.
- SQLite local mediante `better-sqlite3`.
- Caja con productos y carrito.
- Inventario CRUD.
- Pagos en efectivo, pago móvil, transferencia, Zelle, Binance, divisas, fiado y método personalizado.
- Respaldos automáticos, exportación a archivo y restauración validada.
- Recuperación de PIN mediante código único del negocio.
- El administrador puede editar perfiles de trabajadores, cambiar su rol,
  permisos y PIN, y activar o desactivar usuarios sin borrar su historial.
- Configuración local del negocio con nombre comercial, RIF, dirección,
  teléfono y mensaje personalizado en comprobantes.
- Fiado básico con clientes por alias, saldos y abonos.
- Ventas en USD o Bs con tasa de cambio guardada por operación.
- Apertura y cierre de caja por turno, con diferencias separadas en USD y Bs.
- Movimientos de inventario con entradas, salidas por venta y ajustes auditados.
- Anulación controlada de ventas para dueño/encargado, con devolución de stock y auditoría.
- Reimpresión de comprobantes activos desde el historial de ventas.
- La base local valida permisos de sesión también dentro del proceso principal, no solo en la interfaz.
- Productos con categoría persistente y filtro rápido en la caja, inspirado en la referencia visual PC + móvil.
- Productos rápidos con icono, color y favorito persistentes para priorizar artículos de alta rotación.
- Fotos opcionales de productos en PNG, JPG o WebP. Se reducen a una miniatura
  WebP de 512 px antes de guardarse localmente y pueden quitarse al editar.
- Categorías de caja generadas automáticamente desde el inventario, con filtro especial de favoritos.
- Atajos de caja: `Ctrl/Cmd + K` o `/` enfoca el buscador y `F4` inicia el cobro.
- Compatible con lectores USB de códigos de barras que funcionan como teclado:
  enfoca el buscador, escanea el código y el producto se agrega al carrito al
  recibir Enter.
- El cierre de sesión limpia también la sesión autenticada del proceso principal, manteniendo la caja abierta.
- La caja muestra una alerta cuando existen productos con stock bajo (5 unidades o menos).
- Los productos a granel permiten vender cantidades variables directamente en el carrito: por ejemplo 65 g, 140 g, 250 g o 500 g, sin crear una presentación separada para cada peso.
- La tasa Bs/USD se define al abrir la caja por el dueño o encargado y queda guardada para todas las ventas del turno; el cajero no la modifica.
- Los precios de venta y totales monetarios se redondean a dos decimales.
- Cada producto puede fijar independientemente su precio de venta y costo en
  USD o Bs. Los precios fijados en Bs permanecen estables aunque cambie la
  tasa; durante la venta se conserva el equivalente calculado con la tasa de
  la caja.
- El método de pago **Otro** permite especificar una descripción (por ejemplo, cheque,
  criptomoneda o convenio) y la conserva en el comprobante, reportes y exportaciones.

Las imágenes de referencia visual del concepto PC + móvil se conservan en
`docs/design/pos-reference.png` y `docs/design/pos-reference-main.png`. Se
usarán como guía de diseño, no como dependencias de ejecución.
- Cambio de sesión sin cerrar la caja; las ventas quedan asociadas al usuario activo.
- El proceso principal valida la sesión autenticada antes de registrar o anular ventas.
- Interfaz Tailwind CSS.
- Roadmap de licencias, respaldos, sincronización y aplicación móvil.

## Ejecutar

```bash
npm install
npm start
npm run test:smoke
```

La base local se crea automáticamente en la carpeta de datos de Electron del usuario como `solutec-pos.sqlite`.

Para generar una carpeta ejecutable de Windows sin instalador:
```bash
npm run dist:dir
```

Los productos usan USD como referencia interna. Al cobrar, el operador puede
seleccionar USD o Bs e indicar la tasa Bs/USD. La venta conserva el total base,
la moneda seleccionada, la tasa utilizada y el equivalente en bolívares.

## Respaldos y cambio de equipo

El administrador puede entrar en **Usuarios y configuración** para exportar un respaldo
`.sqlite` a un USB, disco externo o carpeta segura. En una instalación nueva puede
usar **Restaurar respaldo** para recuperar productos, ventas, stock y usuarios. El
respaldo se valida antes de reemplazar la base activa y la sesión se cierra después
de una restauración exitosa.

La licencia del equipo y la base de datos son elementos separados. Restaurar un
respaldo no transfiere automáticamente una licencia.

## Alcance

La aplicación está diseñada para panaderías, empanaderías, bodegas, puestos de comida rápida y otros comercios pequeños. La operación de caja debe seguir funcionando sin internet; la sincronización móvil y los respaldos remotos se incorporarán como servicio conectado.

Consulta [ROADMAP.md](./ROADMAP.md) antes de ampliar el alcance.
