// ── HAMBURGER MENU ──
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('nav-open');
    document.body.style.overflow = navLinks.classList.contains('nav-open') ? 'hidden' : '';
});

navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('nav-open');
        document.body.style.overflow = '';
    });
});

// ── BOOKING CARDS REVEAL (delayed after page load) ──
// Cards start hidden via CSS (opacity:0, translateY). We trigger
// them with a staggered delay so they animate in one by one.
window.addEventListener('load', () => {
    const cards = document.querySelectorAll('.booking-card');
    cards.forEach((card, i) => {
        setTimeout(() => {
            card.classList.add('visible');
        }, 600 + i * 200); // first card at 600ms, then +200ms each
    });
});

// ── PRICE RANGE SLIDER ──
const priceRange  = document.getElementById('priceRange');
const priceOutput = document.getElementById('priceOutput');

function updatePriceSlider() {
    const min = parseInt(priceRange.min)   || 0;
    const max = parseInt(priceRange.max)   || 100000;
    const val = parseInt(priceRange.value) || 0;
    const pct = ((val - min) / (max - min)) * 100;
    priceRange.style.background =
        `linear-gradient(to right, var(--gold) ${pct}%, #e0e0e0 ${pct}%)`;
    priceOutput.textContent = '₱ ' + val.toLocaleString('en-PH');
}

if (priceRange) {
    priceRange.addEventListener('input', updatePriceSlider);
    updatePriceSlider();
}

// ── AUTO-POPULATE PRICE BASED ON PACKAGE + SCHEDULE ──
const accomSelect = document.getElementById('accomSelect');
const timeSelect  = document.getElementById('timeSelect');
const checkIn     = document.getElementById('checkIn');
const checkOut    = document.getElementById('checkOut');

function getBasePrice() {
    const timeVal = timeSelect ? timeSelect.value : '';
    const checkDate = checkIn ? new Date(checkIn.value) : null;
    const isWeekend = checkDate
        ? (checkDate.getDay() === 0 || checkDate.getDay() === 6)
        : false;

    const prices = {
        dayswimming:   { weekday: 10000, weekend: 15000 },
        nightswimming: { weekday: 11000, weekend: 16000 },
        overnight:     { weekday: 20000, weekend: 30000 },
    };

    if (prices[timeVal]) {
        return isWeekend ? prices[timeVal].weekend : prices[timeVal].weekday;
    }
    return 0;
}

function updatePrice() {
    const price = getBasePrice();
    if (price && priceRange && priceOutput) {
        priceRange.value = price;
        updatePriceSlider();
    }
}

if (timeSelect) timeSelect.addEventListener('change', updatePrice);
if (checkIn)    checkIn.addEventListener('change', updatePrice);

// ── CHECKOUT DATE MINIMUM (must be >= check-in) ──
if (checkIn && checkOut) {
    checkIn.addEventListener('change', () => {
        checkOut.min = checkIn.value;
        if (checkOut.value && checkOut.value < checkIn.value) {
            checkOut.value = checkIn.value;
        }
        updatePrice();
    });
}

// Set today as minimum check-in
const today = new Date().toISOString().split('T')[0];
if (checkIn)  checkIn.min  = today;
if (checkOut) checkOut.min = today;

// ── PAYMENT METHOD — show/hide card fields ──
const paymentRadios    = document.querySelectorAll('input[name="bayadmethod"]');
const cardFields       = document.getElementById('cardFields');
const gcashFields      = document.getElementById('gcashFields');
const cashFields       = document.getElementById('cashFields');

paymentRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        [cardFields, gcashFields, cashFields].forEach(f => {
            if (f) f.classList.remove('visible');
        });
        if (radio.value === 'paymaya' && cardFields)  cardFields.classList.add('visible');
        if (radio.value === 'gcash'   && gcashFields) gcashFields.classList.add('visible');
        if (radio.value === 'cash'    && cashFields)  cashFields.classList.add('visible');
    });
});

// ── POLICY CHECKBOXES — highlight row when checked ──
document.querySelectorAll('.policy-box').forEach(box => {
    const checkbox = box.querySelector('input[type="checkbox"]');
    if (!checkbox) return;
    checkbox.addEventListener('change', () => {
        box.classList.toggle('checked', checkbox.checked);
    });
});

// ── CONFIRM BOOKING ──
const confirmBtn  = document.getElementById('confirmBtn');
const successToast = document.getElementById('successToast');

if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
        // Basic validation
        const required = document.querySelectorAll('[required]');
        let valid = true;

        required.forEach(field => {
            if (!field.value.trim()) {
                valid = false;
                field.style.borderColor = '#e74c3c';
                field.addEventListener('input', () => {
                    field.style.borderColor = '';
                }, { once: true });
            }
        });

        const terms  = document.getElementById('termscondition');
        const cancel = document.getElementById('cancelpolicy');

        if (terms && !terms.checked) {
            valid = false;
            document.querySelector('[for-policy="terms"]')
                ?.classList.add('shake');
        }
        if (cancel && !cancel.checked) {
            valid = false;
            document.querySelector('[for-policy="cancel"]')
                ?.classList.add('shake');
        }

        if (!valid) {
            return;
        }

        // Show toast
        if (successToast) {
            successToast.style.display = 'block';
            setTimeout(() => { successToast.style.display = 'none'; }, 5000);
        }

        // Optionally reset form
        // document.querySelector('form')?.reset();
    });
}
