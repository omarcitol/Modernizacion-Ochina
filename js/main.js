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
