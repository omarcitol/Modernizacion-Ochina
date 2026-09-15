# Solutec POS - Roadmap maestro

## Objetivo del producto

Construir un sistema POS local-first para bodegas, ventas de empanadas, minimarkets y comercios pequeños:

- La PC vende y administra inventario sin internet.
- SQLite conserva los datos localmente.
- La sincronización es opcional y ocurre cuando vuelve internet.
- El dueño puede consultar ventas e inventario desde Android.
- La licencia puede limitarse a un equipo por comercio.
- Un problema de nube, licencia o conexión nunca debe borrar ni detener las ventas locales.

## Arquitectura objetivo

```text
apps/
├── desktop/       Electron + React + TypeScript + SQLite
├── mobile/        Android (Capacitor o React Native)
└── api/           Supabase (Postgres + Auth + Edge Functions)
packages/
├── domain/        Modelos y reglas compartidas
├── validation/    Validaciones compartidas
├── ui/            Componentes visuales compartidos
└── sync-engine/   Cola y sincronización offline/online
```

La base actualmente creada en `electron/` y `renderer/` se considera un prototipo inicial. Antes de la versión comercial se migrará a esta estructura y a TypeScript.

## Principios que no se deben romper

1. **Local-first:** vender no depende de internet, Supabase ni del celular.
2. **Sin pérdida de datos:** cada venta se confirma primero en SQLite.
3. **Sin secretos en el cliente:** la clave privada de licencias nunca se incluye en Electron ni APK.
4. **Sin clave universal:** cada comercio recibe una licencia distinta.
5. **Sin bloqueo agresivo:** una caída de internet no bloquea la caja.
6. **Migrable:** los datos se pueden exportar y el backend no debe ser imprescindible para leer la base local.
7. **Medible:** sincronización, errores, licencias y cuotas deben mostrar estado visible.
8. **Responsabilidad clara:** el contrato debe distinguir licencia, soporte, respaldo remoto y recuperación ante daños físicos.
9. **Control sin fricción:** el cajero debe poder vender rápido, mientras las acciones sensibles requieren autorización del dueño.

## Roadmap por fases

### Fase 0 - Decisiones y base técnica (2-3 días)

- Renombrar la solución a `sistema_pos_solutec`.
- Convertir el proyecto a workspace.
- Elegir React + TypeScript + Vite.
- Definir modelos de comercio, usuario, producto, venta y sincronización.
- Configurar lint, formato, pruebas y builds existentes.
- Crear migraciones versionadas de SQLite.

**Terminado cuando:** el proyecto instala, compila y abre la ventana de Electron con una estructura reproducible.

### Fase 1 - POS local comercial (8-12 días)

- Inicio de sesión local y selección de comercio.
- Caja con buscador rápido.
- Productos por nombre, código de barras y favoritos.
- Carrito con cantidades decimales para kg/g.
- Efectivo, pago móvil y divisas.
- Tasa de cambio configurable.
- Métodos configurables: efectivo Bs/USD, pago móvil, Zelle, Binance Pay/cripto y otros definidos por el comercio.
- Moneda de referencia configurable en USD, con conversión visible a bolívares.
- Registro opcional de EUR u otra divisa, sin asumir que tendrá tasa automática.
- Moneda, monto recibido, referencia y observación por pago.
- Validación transaccional de stock.
- Anulación controlada de venta.
- Comprobante interno imprimible y reimpresión.
- Numeración interna de ventas y cierre de caja.
- Atajos de teclado para PC.
- Manejo de errores sin perder el carrito.

**Terminado cuando:** una tienda puede vender todo un día sin internet, reiniciar la aplicación y conservar ventas e inventario.

### Facturación y comprobantes

- El MVP emitirá un comprobante interno del POS con número, fecha, comercio, productos, cantidades, precios, moneda, método de pago y total.
- Después de cobrar, el cajero podrá imprimir el comprobante en una impresora térmica, guardarlo como PDF o compartirlo por WhatsApp/Telegram si el equipo lo permite.
- El cliente siempre podrá ver el detalle de su compra en pantalla antes de finalizar y el negocio podrá reimprimir el comprobante desde el historial.
- El comprobante tendrá una leyenda clara como "Comprobante interno - no sustituye factura fiscal" mientras no exista integración fiscal validada.
- El comprobante interno no debe presentarse como factura fiscal si no cumple los requisitos vigentes en Venezuela.
- La facturación fiscal, impresoras fiscales, numeración autorizada, datos del contribuyente y requisitos del SENIAT se evaluarán como módulo separado con asesoría contable/legal.
- Las ventas podrán registrar uno o varios métodos de pago si el comercio lo necesita, por ejemplo parte en efectivo y parte en pago móvil.
- Cada método podrá guardar referencia de operación, banco o billetera y monto recibido.

### Fase 2 - Inventario, caja y reportes locales (6-8 días)

- CRUD de productos y categorías.
- Movimientos de inventario.
- Compras y ajustes manuales con auditoría.
- Apertura y cierre de caja.
- Reporte diario, mensual y anual.
- Totales por método de pago.
- Totales separados por moneda y método de pago.
- Tasa utilizada en cada venta para conservar el contexto histórico.
- Productos más vendidos.
- Alertas de bajo stock.
- Exportación CSV/Excel y respaldo local.
- Usuarios locales con roles mínimos: dueño/administrador y cajero.
- PIN del administrador para acciones sensibles.
- Registro de auditoría de anulaciones, descuentos, cambios de precio, ajustes de stock y eliminaciones.
- Eliminación lógica de productos: no borrar físicamente productos usados en ventas.

**Terminado cuando:** el dueño puede operar y revisar el negocio sin nube.

### Fase 3 - Respaldos y recuperación (4-6 días)

- Copia automática local rotativa, sin bloquear la caja.
- Exportación manual a un archivo portable y validado.
- Selector de carpeta o USB para respaldos externos.
- Aviso visible de último respaldo local, último respaldo remoto y ventas pendientes.
- Sincronización automática de operaciones pendientes al recuperar internet.
- Restauración guiada en una PC nueva.
- Verificación de integridad antes de restaurar.
- Prueba periódica de restauración en el entorno de desarrollo.
- No considerar un backup válido hasta comprobar que puede restaurarse.
- Política de retención documentada, por ejemplo: copias locales de los últimos 30 días y datos remotos mientras el servicio esté activo.

**Planes de respaldo:**

- **Solutec Local:** copia automática dentro de la PC y exportación manual a USB. No incluye protección contra daño o robo del mismo disco.
- **Solutec Conectado:** sincronización y respaldo remoto automático mientras el mantenimiento esté activo. Si el servicio se suspende, la PC conserva los datos y la cola pendiente, pero no promete nuevas copias remotas.

**Terminado cuando:** una PC nueva puede restaurar un comercio desde un respaldo válido y el sistema muestra claramente la fecha de la última copia.

### Fase 4 - Licencias por equipo (3-5 días)

- Crear herramienta privada `solutec-license-manager`.
- Generar claves únicas por comercio.
- Firmar licencias con Ed25519.
- La app contiene únicamente la clave pública.
- Generar una huella estable del equipo.
- Activar una licencia para un equipo.
- Transferencia manual por cambio de PC.
- Estados: activa, suspendida, revocada y reemplazada.
- Pantalla de licencia y contacto de soporte.

**Flujo de generación:** el cliente envía un código de equipo; tú generas la licencia desde tu herramienta privada y le entregas un archivo/código firmado.

**Terminado cuando:** copiar el ejecutable y el archivo de licencia a otra PC no permite activarlo como el equipo autorizado.

### Fase 5 - Supabase Free y sincronización (8-12 días)

- Crear un único proyecto Supabase.
- Tablas multi-comercio con aislamiento por `comercio_id`.
- Auth para dueño y usuarios.
- Cola local de cambios pendientes.
- Sincronización por lotes y con reintentos.
- Idempotencia para no duplicar ventas.
- Cursor de sincronización.
- Estados: pendiente, sincronizado y error.
- Resumen diario para reportes eficientes.
- Supabase nunca será necesario para cobrar localmente.

**Política de servicio:** si el cliente no tiene mantenimiento o la nube está pausada/al límite, la PC sigue funcionando. Se desactivan únicamente sincronización, respaldo remoto y consulta móvil hasta reactivar el servicio.

**Terminado cuando:** una venta hecha offline aparece una sola vez en la nube al volver internet.

### Fase 6 - Aplicación Android (8-12 días)

- Login del dueño o encargado autorizado.
- Selección de comercio.
- Ventas del día, mes y año.
- Totales por método de pago.
- Gráficos sencillos.
- Productos más vendidos.
- Bajo stock.
- Última sincronización y estado del servicio.
- Pantallas claras para celular.
- Cache de última información disponible.
- Aplicación de consulta, no una segunda caja.
- Sin crear, editar o eliminar productos desde el celular en el MVP.
- Sin eliminar ni modificar ventas desde el celular en el MVP.
- Las acciones administrativas permanecen en la PC para reducir errores y complejidad.

**Terminado cuando:** el dueño puede revisar sus indicadores desde Android y recibe un estado claro si la PC está offline.

### Fase 7 - Instaladores, seguridad y piloto (6-10 días)

- Instalador Windows.
- Actualizaciones controladas.
- Firma del instalador cuando sea posible.
- Respaldos automáticos y restauración probada.
- Pruebas de apagado durante una venta.
- Pruebas de stock concurrente.
- Pruebas de licencia copiada.
- Pruebas de sincronización duplicada/interrumpida.
- Piloto con 2-3 comercios.
- Manual de instalación y soporte.

**Terminado cuando:** el piloto opera una semana real sin pérdida de datos y cada fallo tiene recuperación documentada.

## Estimación de tiempo

| Entregable | Tiempo estimado |
|---|---:|
| POS local demostrable | 16-23 días hábiles |
| Respaldos y recuperación | 4-6 días hábiles adicionales |
| Licencia por equipo | 3-5 días hábiles adicionales |
| Supabase y sincronización | 8-12 días hábiles adicionales |
| Android con estadísticas | 8-12 días hábiles adicionales |
| Instaladores y piloto | 6-10 días hábiles adicionales |
| **MVP comercial completo** | **45-68 días hábiles** |

La estimación supone requisitos estables, pruebas continuas y que no se incluyan facturación fiscal, impresoras fiscales, multi-sucursal ni contabilidad avanzada en el primer lanzamiento.

## Costos iniciales

### Obligatorio para comenzar: $0

- Electron, React, TypeScript, SQLite y Tailwind: código abierto.
- Supabase Free: desarrollo y primeros clientes dentro de sus límites.
- Herramienta privada de licencias: se desarrolla dentro del proyecto.
- Licencias locales: no requieren un servidor para generarse.

### Costos opcionales o posteriores

- Supabase Pro: aproximadamente $25/mes cuando la disponibilidad y el volumen lo justifiquen.
- Google Play Console: pago único de registro, sujeto al precio vigente de Google.
- Dominio web: opcional.
- Certificado de firma para Windows: opcional y depende del proveedor.
- Cuenta de correo/SMS/WhatsApp: opcional según el canal de soporte.

No se debe prometer que Supabase Free es ilimitado. El plan puede tener límites o pausas por inactividad. Antes de vender la nube como servicio hay que monitorear cuotas y contratar Pro cuando el ingreso recurrente lo cubra.

## Política de respaldo, daños y responsabilidad

### Qué debe hacer el producto

- Guardar cada venta localmente antes de mostrarla como exitosa.
- Crear copias locales automáticas.
- Avisar si la copia local o remota está atrasada.
- No ocultar ventas pendientes de sincronización.
- Permitir exportar un respaldo manual.
- Permitir restaurar en otra PC con licencia transferida.
- Mantener la PC operativa si internet, Supabase o el servicio móvil no están disponibles.

### Qué cubre cada plan

**Licencia PC (pago único):**

- Uso de la versión adquirida en un equipo autorizado.
- Operación local de caja, inventario y reportes.
- Copias automáticas dentro del mismo equipo.
- Exportación manual para que el cliente guarde el archivo fuera de la PC.
- No incluye respaldo remoto ni recuperación automática ante daño, robo o pérdida del disco.

**Servicio conectado (mantenimiento mensual):**

- Sincronización con Supabase mientras el servicio esté activo.
- Respaldo remoto de los cambios sincronizados.
- Consulta desde el APK.
- Ayuda razonable para restaurar en una PC nueva.
- Avisos de última sincronización y ventas pendientes.

### Casos que no deben prometerse como garantía

- Daño físico, robo, formateo o pérdida del disco antes de que una venta se sincronice o se copie fuera del equipo.
- Uso del sistema después de desactivar copias o ignorar alertas de respaldo.
- Fallos de Windows, virus, cortes eléctricos, hardware defectuoso o manipulación de terceros.
- Datos que el cliente nunca registró o que eliminó de forma confirmada.
- Servicios externos fuera del control de Solutec.

### Cuándo podría ser responsabilidad de Solutec

Podría existir responsabilidad de soporte si se demuestra un defecto del software, por ejemplo:

- La aplicación confirmó una venta pero no la guardó en SQLite.
- El sistema dañó datos por una migración defectuosa.
- El respaldo remoto marcado como correcto no puede restaurarse por un error de Solutec.
- Una actualización oficial sobrescribió o corrompió la base sin crear copia previa.

Para reducir estos casos se requieren transacciones, pruebas, registros de auditoría, copias previas a actualizaciones y restauraciones verificadas.

La garantía legal exacta debe revisarse con un profesional del país donde se venda el producto. El contrato no debe intentar eliminar derechos legales del cliente; debe explicar con claridad el alcance técnico del servicio.

### Procedimiento ante PC o disco dañado

1. El cliente conserva o entrega el último respaldo disponible.
2. Se instala Solutec en una PC nueva.
3. Se valida o transfiere la licencia del comercio.
4. Se restaura la copia local o remota.
5. Se verifica el saldo de inventario y la última venta.
6. Se reanuda la sincronización.
7. Se documentan operaciones que quedaron pendientes.

Si no existe respaldo externo ni sincronización remota, no se debe prometer recuperación de datos perdidos.

### Reglas de comunicación al cliente

La pantalla debe mostrar:

```text
Última copia local: fecha y hora
Última copia remota: fecha y hora o "no contratado"
Ventas pendientes: cantidad
Estado del servicio móvil: activo o suspendido
```

El contrato y la capacitación deben indicar que **un respaldo dentro del mismo disco no protege contra la destrucción de ese disco**. Para clientes sin mantenimiento se recomienda exportar a USB o disco externo con una frecuencia definida.

## Modelo comercial inicial

### Solutec Local

- Instalación: $20.
- Sistema para PC: $20.
- Total inicial: $40.
- Sin mensualidad obligatoria.
- Ventas, inventario y reportes locales.
- Soporte y actualizaciones mayores se cotizan según el servicio ofrecido.

### Solutec Conectado

- Instalación: $20.
- Sistema para PC: $20.
- Aplicación móvil: $20.
- Total inicial: $60.
- Mantenimiento/sincronización: $20 mensuales.
- Incluye estadísticas móviles, respaldo remoto, sincronización y soporte.

La mensualidad debe describirse como servicio de nube, sincronización y soporte; no como requisito para que la caja local siga funcionando.

### Alcance del APK en el MVP

El APK será deliberadamente simple:

- Acceso exclusivo del dueño o encargado autorizado.
- Resumen de ventas y ganancia bruta estimada.
- Ventas del día, semana, mes y año.
- Totales por efectivo, pago móvil y divisas.
- Productos más vendidos.
- Inventario y alertas de bajo stock.
- Fecha de la última sincronización.
- Estado de la PC y de las ventas pendientes.
- Cache de la última información recibida.

El APK no será una segunda caja. El cajero seguirá trabajando en la PC y el dueño administrará productos, precios, usuarios y anulaciones desde el área protegida de la PC. En fases futuras se puede añadir edición remota, pero no forma parte del primer lanzamiento.

## Política comercial recomendada para comenzar

### Comercio objetivo del MVP

Solutec POS se enfocará inicialmente en negocios pequeños que necesitan vender rápido sin pagar una plataforma empresarial:

- Panaderías pequeñas.
- Empanaderías y puestos de comida rápida.
- Hamburgueserías y ventas de comida para llevar.
- Bodegas y minimarkets pequeños.
- Dulcerías, kioscos y emprendimientos con un punto de venta.

No se intentará cubrir en el primer lanzamiento supermercados, farmacias, restaurantes grandes ni comercios que requieran facturación fiscal avanzada, múltiples sucursales, mesas, comandas, recetas, lotes o integraciones empresariales. Esos segmentos requieren otros módulos, hardware, soporte y validaciones legales.

### Pagos y comprobantes del MVP

El cajero podrá registrar:

- Efectivo en bolívares.
- Efectivo en dólares.
- Pago móvil.
- Transferencia bancaria.
- Zelle.
- Binance Pay u otra billetera digital configurada.
- Pago mixto, por ejemplo USD + Bs o efectivo + pago móvil.

Cada pago puede guardar monto, moneda, referencia, banco o billetera y observación. El sistema conservará la tasa usada en la venta para que los reportes históricos no cambien si luego cambia la tasa.

El producto emitirá inicialmente un **comprobante interno/ticket**, no una promesa de factura fiscal. Antes de ofrecer facturación fiscal se debe validar con un contador y revisar la normativa venezolana vigente, requisitos del SENIAT, numeración, datos del contribuyente e impresoras fiscales.

Los precios iniciales pueden ser promocionales, pero no deben comunicar que el sistema completo vale $20. El mayor costo será la instalación, carga inicial, capacitación, soporte y responsabilidad sobre los datos.

### Precio de lanzamiento para los primeros 5-10 comercios

**Solutec Local (PC):**

- Instalación y configuración: $20.
- Licencia POS para un equipo: $40-$60.
- Total recomendado inicial: **$60-$80**.
- Sin mensualidad obligatoria.

**Solutec Conectado (PC + APK):**

- Instalación y configuración de PC: $20.
- Licencia POS: $40-$60.
- Configuración del APK y vinculación: $20.
- Total recomendado inicial: **$80-$100**.
- Servicio conectado, respaldo remoto y soporte básico: **$15-$20 mensuales**.

Si el mercado no acepta esos importes durante el piloto, se puede ofrecer una promoción limitada de:

```text
PC: $40 iniciales
PC + APK: $60 iniciales
Servicio conectado: $20 mensuales
```

La promoción debe indicar que aplica solo a los primeros clientes y que el precio normal será diferente. No conviene incluir visitas ilimitadas, carga ilimitada de productos, cambios de equipo ilimitados ni soporte presencial ilimitado por $20.

### Servicios que deben cobrarse aparte

- Carga inicial grande de productos.
- Visita adicional al comercio.
- Reinstalación por formateo o daño de Windows.
- Cambio o transferencia de equipo.
- Configuración de impresora, lector o cajón.
- Recuperación desde un respaldo del cliente.
- Capacitación presencial adicional.
- Desarrollo de funciones personalizadas.
- Nueva sucursal o caja adicional.

### Recomendación de venta

Para los primeros comercios puede usarse un precio de validación a cambio de obtener:

- Permiso para observar el uso real.
- Reportes de errores.
- Testimonio si el cliente queda satisfecho.
- Permiso para mejorar la interfaz.
- Pago claro, aunque sea promocional.

No ofrecer el producto gratis indefinidamente: un cliente que no paga suele valorar menos el soporte y genera expectativas difíciles de sostener.

### Regla de sostenibilidad

El ingreso mensual del servicio conectado debe cubrir Supabase, soporte y un margen para incidencias. Antes de pagar infraestructura, calcular:

```text
clientes conectados × mensualidad
    - nube
    - comisiones
    - transporte/soporte
    - impuestos y otros gastos
    = margen real
```

El precio definitivo debe revisarse después de 5-10 instalaciones reales, midiendo horas de instalación, consultas de soporte, cantidad de productos cargados y volumen de sincronización.

## Seguridad operativa para el comercio

El sistema no puede garantizar que un empleado nunca robe, pero sí puede reducir oportunidades y dejar evidencia verificable.

### Roles mínimos

**Dueño/administrador:**

- Crear y desactivar usuarios.
- Cambiar precios y costos.
- Ajustar inventario.
- Anular o devolver ventas.
- Ver ganancias y reportes.
- Exportar y restaurar respaldos.
- Configurar métodos de pago y tasa.
- Ver auditoría.

**Cajero:**

- Abrir caja según la configuración.
- Buscar productos y registrar ventas.
- Cobrar con métodos autorizados.
- Consultar únicamente lo necesario para vender.
- No eliminar productos.
- No cambiar costos ni precios sin autorización.
- No borrar ventas.

### PIN y autorización

- Cada usuario debe tener una cuenta local y un PIN propio; nunca compartir el PIN del dueño.
- Las acciones sensibles deben solicitar PIN de administrador o una aprobación explícita.
- No guardar PIN en texto plano; usar un hash resistente con saltos.
- Aplicar bloqueo temporal tras intentos fallidos repetidos.
- Permitir cambiar el PIN desde la cuenta del dueño.
- El PIN no debe ser una clave maestra incluida en el ejecutable.

### Eliminación y auditoría

- Los productos no se eliminan físicamente si aparecen en ventas; se desactivan mediante `activo = 0`.
- Un producto desactivado conserva su historial y puede restaurarse por un administrador.
- Las ventas confirmadas no se borran; una anulación genera un movimiento compensatorio y exige motivo.
- Registrar usuario, fecha, equipo, acción, registro afectado, motivo y valores relevantes.
- Registrar especialmente descuentos, anulaciones, devoluciones, cambios de precio, ajustes de stock, aperturas y cierres de caja.
- El dueño debe poder exportar la auditoría.

### Controles para detectar faltantes

- Inventario inicial y conteos periódicos.
- Reporte de movimientos manuales.
- Diferencia entre caja esperada y caja declarada.
- Productos más vendidos frente a variación de stock.
- Alertas por anulaciones o descuentos inusuales.
- Historial de última sesión y usuario.

Estos controles sirven para evidenciar y detectar irregularidades; no sustituyen supervisión, cámaras, políticas internas ni asesoría legal.

## Criterios para pasar de Free a Pro

Contratar Pro cuando ocurra cualquiera de estos casos:

- Hay clientes que dependen diariamente de las estadísticas móviles.
- El proyecto se pausa o se acerca a una cuota.
- La mensualidad de los clientes conectados cubre holgadamente el costo.
- Se necesita una disponibilidad más consistente.
- El tamaño, transferencia o funciones superan el margen seguro del plan gratuito.

La actualización del plan no borra los datos del mismo proyecto. La aplicación debe seguir reteniendo la copia local y reenviar cambios pendientes de forma idempotente.

## Riesgos y controles

| Riesgo | Control |
|---|---|
| PC sin internet | SQLite y cola local |
| Supabase caído | La caja no depende de Supabase |
| Licencia copiada | Firma digital + huella del equipo |
| Disco dañado | Respaldo local y remoto si está conectado |
| Venta duplicada | Idempotency key por operación |
| Dos equipos con el mismo producto | Movimientos y reglas de sincronización |
| Cliente cambia de PC | Transferencia manual de licencia |
| Cuota Free agotada | Aviso, cola local y activación del servicio |
| Robo de credenciales | Auth, sesiones revocables y mínimo privilegio |

## Primera meta de lanzamiento

No lanzar el MVP hasta cumplir:

- 3 comercios piloto.
- 7 días de operación real.
- 0 ventas perdidas en pruebas.
- Restauración de respaldo verificada.
- Licencia copiada rechazada en otra PC.
- Venta offline sincronizada una sola vez.
- Android muestra fecha de última sincronización.
- El POS continúa vendiendo con Supabase detenido.

## Alcance congelado del MVP

### Sí entra

- Aplicación Windows local-first.
- Caja rápida para pequeños comercios.
- Productos, categorías, precios, costos y stock.
- Unidades unidad, kg y g.
- USD como referencia, conversión a Bs y registro de otras divisas.
- Efectivo, pago móvil, transferencia, Zelle, Binance Pay y pagos mixtos.
- Comprobante interno, impresión/PDF/reimpresión cuando el equipo lo permita.
- Fiado básico: nombre o alias del cliente, venta pendiente, abonos y saldo.
- Usuarios mínimos: administrador y cajero.
- PIN para acciones sensibles.
- Inventario protegido y eliminación lógica.
- Auditoría básica.
- Reportes locales.
- Backups locales y exportación a USB.
- Licencia por equipo.
- APK de consulta para dueño/encargado.
- Supabase y sincronización como servicio conectado opcional.

### No entra en el primer lanzamiento

- CRM, puntos o tarjetas de fidelidad.
- Fichas completas de clientes y campañas.
- Proveedores y compras avanzadas.
- Gastos y contabilidad completa.
- Mesas, comandas o cocina.
- Multi-sucursal.
- Múltiples cajas simultáneas.
- Edición de productos desde el celular.
- Facturación fiscal certificada.
- Integración con impresoras fiscales.
- Integración con bancos o confirmación automática de pagos.
- Nómina, delivery o tienda en línea.
- Inteligencia artificial.

Estas funciones podrán evaluarse después de observar el uso real y recibir solicitudes repetidas de varios comercios. No se deben añadir al MVP por anticipación.

### Fiado básico incluido en el MVP

El fiado es una excepción necesaria para algunos comercios pequeños, pero se implementará sin convertirlo en un módulo de clientes complejo:

- En el cobro se podrá elegir **Contado** o **Fiado**.
- Para fiado se solicitará un nombre o alias obligatorio; teléfono y nota serán opcionales.
- La venta queda registrada y descuenta inventario como cualquier otra venta.
- El saldo pendiente aparece en una lista simple de cuentas.
- El administrador puede registrar abonos parciales o liquidar una cuenta.
- Cada abono guarda fecha, monto, método de pago y usuario.
- El cajero no podrá editar saldos ni borrar deudas.
- El administrador podrá anular una cuenta solo con motivo y auditoría.
- Reportes: total fiado pendiente, cuentas vencidas según fecha configurada y movimientos por cliente.

No habrá inicialmente contactos sincronizados, campañas, puntos, crédito automático, intereses ni evaluación de riesgo. El sistema debe mostrar que el fiado es una deuda registrada y no dinero cobrado.
