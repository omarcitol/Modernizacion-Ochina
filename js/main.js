function show(id) {
  const sections = document.querySelectorAll('main section');
  sections.forEach((section) => {
    section.classList.add('hidden');
  });

  const activeSection = document.getElementById(id);
  if (activeSection) {
    activeSection.classList.remove('hidden');
  }
}

function enviarFormulario(event) {
  event.preventDefault();

  const nombre = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email').value.trim();
  const asunto = document.getElementById('asunto').value;
  const mensaje = document.getElementById('mensaje').value.trim();
  const responseBox = document.getElementById('formResponse');

  responseBox.classList.add('hidden');
  responseBox.textContent = '';

  if (!nombre || !email || !asunto || !mensaje) {
    alert('Por favor completa todos los campos obligatorios antes de enviar.');
    return;
  }

  const datosEnvio = {
    nombre,
    email,
    asunto,
    mensaje,
  };

  console.log('Formulario de contacto enviado:', datosEnvio);

  responseBox.textContent = '¡Mensaje enviado con éxito! Nuestro equipo de OCHINA revisará tu solicitud y se pondrá en contacto pronto.';
  responseBox.classList.remove('hidden');
  event.target.reset();
}
