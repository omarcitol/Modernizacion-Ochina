# ROADMAP NEMOTRON: Plan de acción para Solutec POS

Este roadmap está basado exclusivamente en la información proporcionada por el usuario y sigue su estructura de fases recomendada. No modifica el existing ROADMAP.md.

## FASE 1 — TERMINAR VERSION COMERCIAL DE PC
*Objetivo: Convertir el prototipo funcional en un producto listo para venta y uso en comercios reales.*

### 1. Gestión completa de usuarios (PRIORIDAD MÁXIMA)
- [ ] Editar nombre de usuario en interfaz
- [ ] Cambiar PIN de trabajadores
- [ ] Cambiar rol de usuario
- [ ] Activar y desactivar usuarios
- [ ] Impedir desactivar al último administrador
- [ ] Confirmar acciones importantes (modales de confirmación)
- [ ] Auditar cada cambio (quién, qué, cuándo, desde dónde)
- [ ] Validación de permisos en proceso principal para todas las operaciones sensibles

### 2. Configuración del negocio
- [ ] Pantalla para configurar:
  - Nombre comercial
  - RIF
  - Dirección
  - Teléfono
  - Logo (subida y vista previa)
  - Mensaje del ticket
  - Datos de pago móvil
  - Cuenta bancaria
  - Moneda principal
- [ ] Estos datos deben aparecer automáticamente en todos los comprobantes

### 3. Imágenes de productos
- [ ] Sistema de subida de fotos (límite de tamaño y formato: JPG/PNG < 2MB)
- [ ] Guardado en carpeta local `/assets/productos/` con nombres únicos
- [ ] Generación automática de miniaturas (150x150px) para vista en caja
- [ ] Mostrar imagen en cuadrícula de productos rápidos y buscador
- [ ] Mantener sistema de iconos/colores como fallback para productos sin foto
- [ ] Edición y eliminación de imágenes asociadas a productos

### 4. Categorías administrables
- [ ] Pantalla independiente para gestión de categorías
- [ ] Crear nuevas categorías
- [ ] Editar nombre, color e icono de categorías existentes
- [ ] Ordenar categorías (arrastrar y soltar o campos de peso)
- [ ] Desactivar categorías (sin eliminar, para mantener historial)
- [ ] Validación: impedir eliminación de categorías con productos asociados
- [ ] Sincronización automática con filtro rápido en caja y productos rápidos

### 5. Dashboard profesional
- [ ] Ventas del día (monto y cantidad)
- [ ] Ventas del mes y año (con comparación mensual/anual)
- [ ] Ganancias brutas y netas
- [ ] Top 10 productos más vendidos (por cantidad y por monto)
- [ ] Distribución de métodos de pago (gráfica de pastel)
- [ ] Alertas de stock bajo (lista con productos y niveles)
- [ ] Total fiado pendiente de cobro
- [ ] Comparación entre períodos (semana actual vs anterior, etc.)
- [ ] Gráficas de tendencia (ventas diarias del mes)
- [ ] Ultimo cierre de caja y estado actual

### 6. Inventario profesional normalizado por peso
- [ ] Definir unidad base por producto (ej: gramos para productos a granel)
- [ ] Almacenar todas las cantidades en unidad base en BD
- [ ] Compra: registrar en cualquier unidad (kg, g, lb) con conversión automática a unidad base
- [ ] Venta: permitir cualquier presentación (saco, caja, unidad, gramos) con cálculo de stock
- [ ] Ejemplo de flujo:
  - Producto: Maní
  - Unidad base: gramos
  - Compra: 100 kg → stock += 100,000 g
  - Venta: 65 g → stock -= 65 g → stock restante: 99,935 g
- [ ] Reportes de inventario en unidad base y unidades de presentación
- [ ] Alertas configurables por unidad de venta (ej: alertar cuando < 5 unidades o < 500 g)

### 7. Instalador tradicional
- [ ] Solucionar error de enlaces simbólicos en electron-builder (configuración de Windows)
- [ ] Generar instalador .exe tradicional (no solo portable)
- [ ] Incluir verificación de requisitos mínimos (Windows 10+, espacio en disco)
- [ ] Opción de instalación por usuario o para todos los usuarios
- [ ] Crear acceso directo en escritorio y menú de inicio
- [ ] Probar instalación limpia en máquina virtual limpia
- [ ] Probar actualización desde versión anterior sin pérdida de datos
- [ ] Incluir desinstalador limpio que preserve datos de usuario

### 8. Pruebas comerciales exhaustivas
- [ ] Instalación nueva en máquina limpia
- [ ] Actualización preservando datos existentes
- [ ] Restauración de respaldo desde archivo
- [ ] Operaciones con cajero sin permisos específicos
- [ ] Cambio de tasa de caja durante turno
- [ ] Ventas exclusivamente en USD
- [ ] Ventas exclusivamente en Bs
- [ ] Ventas con precios fijados en Bs (ignora tasa de caja)
- [ ] Ventas con precios fijados en USD (ignora tasa de caja)
- [ ] Venta por gramos y otras unidades variables
- [ ] Anulación de ventas con devolución de stock
- [ ] Cierre de caja con diferencias en USD y Bs
- [ ] Corte de caja con reporte de diferencias
- [ ] Intento de login con usuario desactivado
- [ ] Operaciones con base de datos dañada seguida de restauración
- [ ] Simulación de corte de energía durante operación crítica

### 9. Pulido y usabilidad
- [ ] Atajos de teclado consistentes en todas las pantallas
- [ ] Tooltips explicativos en iconos y botones
- [ ] Validación de formularios en tiempo real
- [ ] Mensajes de error amigables y accionables
- [ ] Estado de carga en operaciones lentas (sincronización, reportes)
- [ ] Confirmación de salida sin guardar cambios
- [ ] Diseño responsivo para diferentes resoluciones de pantalla
- [ ] Accesibilidad básica (navegación con tab, contraste mínimo)

## FASE 2 — PREPARAR SINCRONIZACIÓN EN LA NUBE
*Objetivo: Habilitar sincronización opcional con la nube manteniendo funcionamiento offline-first.*

### 1. Cuenta y comercio
- [ ] Registro del comercio en Supabase (o similar)
- [ ] Generación de ID único del negocio (UUID)
- [ ] Creación de usuario propietario inicial
- [ ] Sistema para vincular usuarios adicionales al comercio
- [ ] Inicio de sesión remoto con credenciales de nube
- [ ] Recuperación de cuenta vía email
- [ ] Cambio de contraseña y actualización de perfil

### 2. Sistema de sincronización
- [ ] Cola de operaciones pendientes (IndexedDB o similar)
- [ ] Detección automática de conectividad a internet
- [ ] Envío de operaciones cuando vuelva conexión
- [ ] Reintentos exponenciales con límite
- [ ] Identificadores únicos globales (UUID v4) para todas las entidades
- [ ] Estrategia para evitar duplicación de ventas (timestamp + ID comercio)
- [ ] Algoritmo de resolución de conflictos (último escribe wins o merge inteligente)
- [ ] Panel de estado de sincronización (conectado, sincronizando, error)
- [ ] Registro detallado de errores de sincronización para auditoría

### 3. Seguridad en la nube
- [ ] Tokens de sesión JWT con expiración y refresh
- [ ] Cifrado TLS 1.3 para todas las comunicaciones
- [ ] Políticas de Row Level Security (RLS) en Supabase por comercio_id
- [ ] Separación estricta de datos entre negocios (comercio_id como 필수)
- [ ] Sistema de revocación de dispositivos comprometidos
- [ ] Protección de respaldos locales contra acceso no autorizado
- [ ] Auditoría de acceso a datos sensibles (usuarios, configuración)

### 4. Entidades a sincronizar (fase inicial)
- [ ] Maestros: productos, categorías, usuarios, configuración del negocio
- [ ] Transacciones: ventas, aperturas/cierres de caja, fiados, abonos
- [ ] Referencias: métodos de pago, impuestos, tasas de cambio históricas
- [ ] Excluir inicialmente: sesiones activas, tokens temporales, cache de UI

### 5. Mecanismos de sincronización específicos
- [ ] Sincronización de productos: creación, edición, archivado, stock
- [ ] Sincronización de ventas: venta completa con pagos y detalles
- [ ] Sincronización de caja: aperturas, cortes, movimientos de fondo
- [ ] Sincronización de usuarios: creación, rol, estado activo/inactivo
- [ ] Sincronización de fiados: creación, abonos, estados de deuda
- [ ] Estrategia de sincronización diferencial (solo cambios desde última sync)

### 6. Experiencia de usuario con nube
- [ ] Indicador claro de estado online/offline en barra de estado
- [ ] Notificaciones cuando se recupera conexión después de estar offline
- [ ] Alertas cuando falla sincronización después de varios reintentos
- [ ] Opción para forzar sincronización manual
- [ ] Visualización de operaciones pendientes en cola
- [ ] Historial de sincronizaciones exitosas/fallidas

### 7. Preparación del backend
- [ ] Crear proyecto Supabase con:
  - Base de datos PostgreSQL
  - Auth integrado
  - Storage para logos y fotos de productos
  - Funciones Edge para lógica de negocio compleja
- [ ] Diseñar esquema de tablas con índices apropiados
- [ ] Implementar RLS policies para aislamiento por comercio_id
- [ ] Configurar webhooks para eventos críticos (opcional)
- [ ] Documentar API para consumo futuro de APK y otros clientes

### 8. Pruebas de sincronización
- [ ] Simular pérdida de conexión durante operación crítica
- [ ] Probar reconexión y envío de cola pendiente
- [ ] Probar resolución de conflictos en escenarios controlados
- [ ] Verificar integridad de datos después de múltiples ciclos sync/offline
- [ ] Probar comportamiento con conexiones lentas e intermitentes
- [ ] Validar que funcionamiento offline nunca se bloquea por falta de nube

### 9. Documentación y entrenamiento
- [ ] Guía de configuración inicial con nube
- [ ] Procedimientos para recuperación ante fallos de sincronización
- [ ] Mejores prácticas para uso en entornos con conectividad inestable
- [ ] FAQ sobre seguridad y privacidad de datos en la nube

## FASE 3 — CREAR LA APK ANDROID
*Objetivo: App gerencial para monitoreo y administración remota (no caja completa).*

### 1. Primera versión de la APK (Dashboard gerencial)
- [ ] Login seguro del dueño con autenticación de nube
- [ ] Selección de comercio (si tiene múltiples)
- [ ] Dashboard con:
  - Ventas del día, mes, año
  - Ganancia neta del período
  - Métodos de pago distribuidos
  - Top 5 productos más vendidos
  - Lista de productos con stock bajo
  - Total fiado pendiente
  - Últimos 5 cierres de caja
  - Ventas recientes (última hora)
- [ ] Alertas importantes en tiempo real:
  - Venta grande (umbral configurable)
  - Stock bajo en producto crítico
  - Diferencia significativa en cierre de caja
  - Usuario desactivado intentando acceder
  - Fallo de sincronización persistente
- [ ] Notificaciones push para alertas críticas (cuando tenga conexión)

### 2. Funcionalidades de administración remota
- [ ] Consultar inventario completo con filtros
- [ ] Editar precios de productos (con aprobación opcional)
- [ ] Cambiar tasa de caja activa (solo para dueño/encargado)
- [ ] Consultar lista de usuarios y sus roles
- [ ] Ver reportes avanzados de ventas por categoría/método de pago
- [ ] Anular ventas recientes con requerimiento de autorización doble
- [ ] Acceso a historial de fiados y gestión de cobros
- [ ] Ver y filtrar movimientos de caja por tipo y fecha

### 3. Preparación técnica para APK
- [ ] Elegir stack: React Native con Expo (recomendado por velocidad)
- [ ] Configurar entorno de desarrollo para Android
- [ ] Crear proyecto base con navegación y estado global
- [ ] Implementar autenticación con Supabase Auth
- [ ] Diseñar componentes UI reutilizables (tarjetas, listas, gráficos)
- [ ] Integrar con APIs de sincronización del backend
- [ ] Manejo de estado offline-local en la app (cache temporal)
- [ ] Optimización para rendimiento en dispositivos de gama media

### 4. Publicación y mantenimiento
- [ ] Crear cuenta de desarrollador en Google Play Console
- [ ] Generar firmas de aplicación y configurar release
- [ ] Preparar lista de tiendas para distribución interna (si aplica)
- [ ] Establecer canal de beta testing con comercios piloto
- [ ] Definir proceso de actualización OTA
- [ ] Crear política de privacidad y términos de servicio
- [ ] Preparar recursos de soporte (FAQ, tutoriales en video)
- [ ] Plan de monitoreo de crashes y errores en producción

## FASE 4 — COMERCIALIZACIÓN
*Objetivo: Convertir el sistema en un negocio sostenible.*

### 1. Modelo de licencias y precios
- [ ] Definir planes de pago (ej: Básico, Profesional, Empresarial)
- [ ] Establecer precios mensuales/anuales por comercio
- [ ] Considerar opciones de licencia perpetua + soporte anual
- [ ] Diseñar períodos de prueba gratuita (7-15 días)
- [ ] Implementar sistema de activación por licencia clave
- [ ] Considerar descuentos por pago anual o múltiples comercios

### 2. Infraestructura de soporte y operaciones
- [ ] Crear sistema de tickets para atención al cliente
- [ ] Documentar procedimientos de recuperación ante fallos críticos
- [ ] Establecer SLA de respuesta según plan contratado
- [ ] Crear base de conocimiento con tutoriales y guías
- [ ] Capacitar equipo de soporte en funcionalidades del POS
- [ ] Preparar procedimientos de instalación en sitio

### 3. Actualizaciones y mantenimiento
- [ ] Establecer ciclo de lanzamientos (mensual o bimestral)
- [ ] Crear canal de comunicación de actualizaciones (email, app)
- [ ] Implementar sistema de actualizaciones silenciosas para mejoras menores
- [ ] Requerir intervención manual para actualizaciones que afecten BD
- [ ] Mantener repositorio de versiones anteriores para rollback
- [ ] Notificar con anticipación sobre cambios que requieran acción del usuario

### 4. Cumplimiento y expansión de mercado
- [ ] Elaborar política de privacidad alineada con leyes locales
- [ ] Preparar términos de servicio claros y justos
- [ ] Investigar requisitos específicos para comercios en Venezuela
- [ ] Considerar adaptación para otros países con similares necesidades
- [ ] Explorar integraciones con contadores populares localmente
- [ ] Evaluar oportunidades de venta indirecta mediante distribuidores

## ESTIMACIÓN DE TIEMPO REALISTA
*Basada en trabajo constante y enfoque en una fase a la vez.*

| Etapa | Tiempo aproximado | Comentario clave |
|-------|-------------------|------------------|
| **Terminar PC comercial** | 2 a 4 semanas | Enfocado en las 9 áreas de Fase 1 |
| **Pruebas y estabilización** | 1 a 2 semanas | Incluye las 9 pruebas comerciales de Fase 1 |
| **Backend y sincronización** | 2 a 4 semanas | Las 9 áreas de Fase 2 |
| **APK gerencial inicial** | 3 a 5 semanas | Las 4 áreas de Fase 3 (versión básica) |
| **Pruebas PC + nube + APK** | 2 a 3 semanas | Pruebas integradas de todas las fases |
| **Primera versión vendible** | **2 a 3 meses** | Objetivo: producto listo para primeros clientes pagos |

## ESTADO ACTUAL ESTIMADO (Según su autoevaluación)
```text
Versión PC offline funcional: 70% - 80%
Versión PC comercial completa: 50% - 60%   ← OBJETIVO INMEDIATO DE FASE 1
Sincronización en la nube: 10% - 20%
APK Android: 0% - 10%
```

## PRÓXIMOS PASOS INMEDIATOS (Basado en su prioridad declarada)
1. **Enfocarse exclusivamente en Gestión completa de usuarios** (Fase 1, punto 1) antes de avanzar a otros puntos de la Fase 1.
2. **No iniciar trabajo en Fase 2 o 3 hasta completar al menos el 80% de la Fase 1.**
3. **Utilizar este roadmap como guía de seguimiento semanal** marcando progreso en cada checkbox.
4. **Reevaluar estimaciones cada dos semanas** basado en velocidad real de avance.

---
*Este roadmap es un documento vivo. Actualícelo conforme avance el proyecto y surjan nuevos aprendizajes. Manténgalo visible como referencia constante de prioridades.*