const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('#main-nav');

if (menuToggle && mainNav) {
	menuToggle.addEventListener('click', () => {
		const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
		menuToggle.setAttribute('aria-expanded', String(!expanded));
		menuToggle.setAttribute('aria-label', expanded ? 'Abrir menú' : 'Cerrar menú');
		mainNav.classList.toggle('is-open', !expanded);
	});

	mainNav.addEventListener('click', (event) => {
		if (!event.target.closest('a')) return;
		menuToggle.setAttribute('aria-expanded', 'false');
		menuToggle.setAttribute('aria-label', 'Abrir menú');
		mainNav.classList.remove('is-open');
	});
}

const shareButton = document.querySelector('#share-button');
const shareStatus = document.querySelector('#share-status');
if (shareButton && shareStatus) {
	shareButton.addEventListener('click', async () => {
		try {
			if (navigator.share) {
				await navigator.share({ title: document.title, url: window.location.href });
				shareStatus.textContent = 'Gracias por compartir.';
			} else if (navigator.clipboard) {
				await navigator.clipboard.writeText(window.location.href);
				shareStatus.textContent = 'Enlace copiado.';
			} else {
				shareStatus.textContent = 'Copiá el enlace de la barra del navegador.';
			}
		} catch (error) {
			if (error.name !== 'AbortError') shareStatus.textContent = 'No se pudo compartir en este momento.';
		}
	});
}

const currentYear = document.querySelector('#current-year');
if (currentYear) currentYear.textContent = new Date().getFullYear();
