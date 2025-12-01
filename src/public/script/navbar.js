let lastScroll = 0;
const navbar = document.querySelector('.navbar');
const collapse = document.querySelector('#navbarNav'); // Bootstrap collapse div
const scrollThreshold = 100; // Amount of pixels to scroll before the navbar starts hiding

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;

  // Only apply logic if the mobile menu is NOT expanded
  const isExpanded = collapse.classList.contains('show');
  
  if (!isExpanded) {
    // 1. If we are near the top (less than threshold), always show the navbar
    if (currentScroll < scrollThreshold) {
      navbar.classList.add('show');
      navbar.style.top = '0';
    } 
    // 2. If we are past the threshold, apply the hide/show logic
    else {
      if (currentScroll > lastScroll) {
        // Scrolling down -> Hide
        navbar.classList.remove('show');
        navbar.style.top = '-100px';
      } else {
        // Scrolling up -> Show
        navbar.classList.add('show');
        navbar.style.top = '0';
      }
    }
  }

  lastScroll = currentScroll;
});