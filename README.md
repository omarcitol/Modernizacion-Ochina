# Propuesta de Modernización de OCHINA (Arquitectura SPA)

## Descripción
Proyecto de modernización de la interfaz de usuario para la Oficina Coordinadora de Hidrografía y Navegación (OCHINA). Se implementa una **Arquitectura de Aplicación de una sola página (SPA)** para mejorar la velocidad de carga, la experiencia de usuario (UX) y la adaptabilidad a dispositivos móviles.

## Tecnologías utilizadas
* HTML5 (Estructura semántica)
* CSS3 (Diseño responsivo corporativo)
* JavaScript (Lógica de navegación dinámica)

## Estado de la Fase 1
* [x] Estructura base de navegación (SPA).
* [x] Lógica de visualización de secciones (Show/Hide).
* [x] Identidad visual institucional aplicada.

## Fase 2: Mejora de la sección de contacto

Se ha implementado un formulario semántico en la sección `contacto` con los campos:
* Nombre Completo
* Correo Electrónico
* Asunto
* Mensaje

El formulario incluye validación en `main.js` mediante la función `enviarFormulario(event)` para evitar el envío de campos vacíos, mostrar alertas de error y presentar un mensaje de éxito en la propia página.

### Justificación UX

Este diseño mejora la usabilidad y reduce la carga cognitiva en comparación con los formularios tradicionales porque usa una estructura clara y secuencial de campos, etiquetas visibles y un diseño con elementos bien espaciados. El uso de un `select` para el asunto evita errores de clasificación, mientras que el estilo limpio y responsive ayuda a que el usuario complete el formulario con confianza en cualquier dispositivo.

### Instrucciones de prueba

1. Abre `index.html` en el navegador.
2. Navega a la sección `Contacto`.
3. Completa el formulario y haz clic en `Enviar`.
4. Revisa la consola del navegador para ver los datos enviados.
5. Observa el mensaje de éxito que aparece en la página.
<img width="734" height="592" alt="fase2 1" src="https://github.com/user-attachments/assets/c6060287-e412-4eb0-9c24-7e8fdf14ba11" />
