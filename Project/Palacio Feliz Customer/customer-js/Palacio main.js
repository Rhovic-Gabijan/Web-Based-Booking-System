// ── HAMBURGER MENU ──
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('nav-open');
    document.body.style.overflow = navLinks.classList.contains('nav-open') ? 'hidden' : '';
});

// Close nav when a link is clicked
navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('nav-open');
        document.body.style.overflow = '';
    });
});

// ── SCROLL REVEAL ──
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
    observer.observe(el);
});

// ── RULES SCROLL ──
const leftBtn = document.querySelector('.arrow-left');
const rightBtn = document.querySelector('.arrow-right');
const rules = document.querySelector('.rulesyan');

leftBtn.addEventListener('click', () => rules.scrollBy({ left: -330, behavior: 'smooth' }));
rightBtn.addEventListener('click', () => rules.scrollBy({ left: 330, behavior: 'smooth' }));

// ── REVIEWS SYSTEM ──
let reviews = [
    { name: "Ana Reyes", rating: 5, text: "Absolutely stunning resort! The pool is breathtaking and the staff were so welcoming. We'll definitely be back for our anniversary!", date: "February 28, 2025" },
    { name: "Carlo Mendoza", rating: 5, text: "Best resort experience in Bulacan. Clean, beautiful, and so relaxing. My kids loved the kiddie pool. Highly recommend!", date: "March 3, 2025" },
    { name: "Jess & Family", rating: 4, text: "Great place for a family getaway. The videoke was a hit! Loved the overall ambiance and the Bali-inspired pool is gorgeous.", date: "March 8, 2025" },
];

const reviewModal = document.getElementById('reviewModal');
const openBtn = document.getElementById('openReviewModal');
const closeBtn = document.getElementById('closeModal');
const toggleBtn = document.getElementById('toggleReviews');
const reviewsPanel = document.getElementById('reviewsPanel');
const reviewsGrid = document.getElementById('reviewsGrid');
const toast = document.getElementById('successToast');

openBtn.addEventListener('click', () => reviewModal.classList.add('open'));
closeBtn.addEventListener('click', () => reviewModal.classList.remove('open'));
reviewModal.addEventListener('click', (e) => {
    if (e.target === reviewModal) reviewModal.classList.remove('open');
});

toggleBtn.addEventListener('click', () => {
    const isOpen = reviewsPanel.classList.toggle('visible');
    toggleBtn.textContent = isOpen ? '✕  Hide Reviews' : '👁️  View All Reviews';
    if (isOpen) renderReviews();
});

function renderReviews() {
    if (reviews.length === 0) {
        reviewsGrid.innerHTML = `<div class="reviews-empty" style="grid-column:1/-1"><p>No reviews yet. Be the first to share your experience!</p></div>`;
        return;
    }
    reviewsGrid.innerHTML = reviews.map(r => `
        <div class="review-card">
            <div class="review-header">
                <div class="reviewer-avatar">${r.name.charAt(0)}</div>
                <div class="reviewer-info">
                    <div class="name">${r.name}</div>
                    <div class="date">${r.date}</div>
                </div>
            </div>
            <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            <div class="review-text">"${r.text}"</div>
        </div>
    `).join('');
}

document.getElementById('submitReview').addEventListener('click', () => {
    const name = document.getElementById('reviewName').value.trim();
    const text = document.getElementById('reviewText').value.trim();
    const ratingEl = document.querySelector('input[name="rating"]:checked');
    const files = document.getElementById('reviewImages').files;

    if (!name || !text || !ratingEl) {
        alert('Please fill in your name, rating, and review before submitting.');
        return;
    }

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const images = [];

    for (let i = 0; i<files.length; i++){
        images.push(URL.createObjectURL(files[i]));
    }
    reviews.unshift({ name, rating: parseInt(ratingEl.value), text, date: today });

    reviewModal.classList.remove('open');
    document.getElementById('reviewName').value = '';
    document.getElementById('reviewText').value = '';
    document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);

    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 4000);

    if (reviewsPanel.classList.contains('visible')) renderReviews();
    else {
        reviewsPanel.classList.add('visible');
        toggleBtn.textContent = '✕  Hide Reviews';
        renderReviews();
    }
});
