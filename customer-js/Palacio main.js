const leftBtn = document.querySelector('.arrow-left');
const rightBtn = document.querySelector('.arrow-right');
const rules = document.querySelector('.rulesyan');

leftBtn.addEventListener('click', () => {
    rules.scrollBy({ left: -320, behavior: 'smooth' });
});

rightBtn.addEventListener('click', () => {
    rules.scrollBy({ left: 320, behavior: 'smooth' });
});