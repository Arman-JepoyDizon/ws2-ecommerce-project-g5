let lastScroll = 0;
const navbar = document.querySelector('.navbar');
const collapse = document.querySelector('#navbarNav'); // Bootstrap collapse div

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;

  // Only hide/show if the mobile menu is collapsed
  const isExpanded = collapse.classList.contains('show');
  if (!isExpanded) {
    if (currentScroll > lastScroll) {
      // scrolling down -> hide
      navbar.classList.remove('show');
      navbar.style.top = '-100px';
    } else {
      // scrolling up -> show
      navbar.classList.add('show');
      navbar.style.top = '0';
    }
  }

  lastScroll = currentScroll;
});