console.log("customer js loaded!")

const API_BASE_URL = `${window.location.origin}/api`;

let packageCatalog = [];
let currentCalendarDate = new Date();
let selectedCalendarDate = null;
let reviewChart = null;

function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach((el) => {
    observer.observe(el);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initReveal();
});

function gotoPage(pageId, anchorId = null) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (!page) return;
  page.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (anchorId) {
    const el = document.getElementById(anchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
  initReveal();
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-goto]');
  if (trigger) {
    e.preventDefault();
    gotoPage(trigger.dataset.goto, trigger.dataset.anchor || null);
    return;
  }

const leftBtn = document.querySelector('.arrow-left');
const rightBtn = document.querySelector('.arrow-right');
const rulesEl = document.querySelector('.rulesyan');

if (leftBtn && rightBtn && rulesEl) {
  leftBtn.addEventListener('click', () => {
    rulesEl.scrollBy({ left: -330, behavior: 'smooth' });
  });

  rightBtn.addEventListener('click', () => {
    rulesEl.scrollBy({ left: 330, behavior: 'smooth' });
  });
}

  const anchor = e.target.closest('a[href^="#"]');
  if (anchor) {
    const id = anchor.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }
});

function initHamburger(hamburgerId, navLinksId) {
  const hamburger = document.getElementById(hamburgerId);
  const navLinks = document.getElementById(navLinksId);
  if (!hamburger || !navLinks) return;
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('nav-open');
  });
}

['main','booking','cal','terms'].forEach((prefix) => initHamburger(`${prefix}-hamburger`, `${prefix}-navLinks`));

function showToast(id, message, ms = 3500) {
  const el = document.getElementById(id);
  if (!el) return;
  if (message) el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, ms);
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Request failed.');
  return payload.data;
}

function normalizeBookingType(value) {
  return (value || '').toLowerCase().trim();
}

function getSelectedBookingType() {
  const select = document.getElementById('timeSelect');
  return normalizeBookingType(select?.value);
}

function findMatchingPackage() {
  const select = document.getElementById('accomSelect');
  const bookingType = getSelectedBookingType();
  const label = select?.selectedOptions?.[0]?.textContent?.toLowerCase() || '';

  return packageCatalog.find((pkg) => {
    const name = (pkg.name || '').toLowerCase();
    return pkg.booking_type === bookingType || (label && name.includes(label.split(' ')[0]));
  }) || null;
}

async function loadPackages() {
  try {
    packageCatalog = await api('/packages');
  } catch (err) {
    console.warn('Failed to load packages:', err.message);
    packageCatalog = [];
  }
}

async function updatePrice() {
  const bookingType = getSelectedBookingType();
  const checkIn = document.getElementById('checkIn')?.value;
  const adults = Number(document.getElementById('adults')?.value || 1);
  const youth = Number(document.getElementById('children')?.value || 0);
  const priceOutput = document.getElementById('priceOutput');
  const checkOut = document.getElementById('checkOut');

  if (!priceOutput) return;
  if (!bookingType || !checkIn) {
    priceOutput.innerHTML = 'Select a schedule and date to preview your total price.';
    return;
  }

  const matchedPackage = findMatchingPackage();
  const params = new URLSearchParams({
    booking_type: bookingType,
    check_in_date: checkIn,
    adults: String(adults),
    youth: String(youth),
  });
  if (matchedPackage?.id) params.set('package_id', matchedPackage.id);

  try {
    const data = await api(`/bookings/price?${params.toString()}`);
    if (checkOut) checkOut.value = data.check_out_date || checkIn;
    const suggestedDownpayment = Math.max(Number(data.downpayment_min || 2000), Math.round(Number(data.total_price || 0) * 0.5));
    priceOutput.innerHTML = `
      <strong>Total:</strong> ₱${Number(data.total_price || 0).toLocaleString()}<br>
      <strong>Schedule:</strong> ${data.check_in_time || '--'} to ${data.check_out_time || '--'}<br>
      <strong>Suggested down payment:</strong> ₱${suggestedDownpayment.toLocaleString()}
    `;
    priceOutput.dataset.totalPrice = data.total_price;
    priceOutput.dataset.suggestedDownpayment = suggestedDownpayment;
  } catch (err) {
    priceOutput.textContent = err.message;
  }
}

async function submitBooking() {
  const firstName = document.getElementById('firstName')?.value.trim();
  const lastName = document.getElementById('lastName')?.value.trim();
  const email = document.getElementById('emailAddr')?.value.trim();
  const phone = document.getElementById('phoneNum')?.value.trim();
  const bookingType = getSelectedBookingType();
  const checkIn = document.getElementById('checkIn')?.value;
  const adults = document.getElementById('adults')?.value || '1';
  const youth = document.getElementById('children')?.value || '0';
  const specialRequest = document.getElementById('specialRequest')?.value.trim();
  const validID = document.getElementById('validID')?.files?.[0] || null;
  const terms = document.getElementById('termscondition')?.checked;
  const cancel = document.getElementById('cancelpolicy')?.checked;
  const paymentMethod = document.querySelector('input[name="bayadmethod"]:checked')?.value;
  const totalPrice = Number(document.getElementById('priceOutput')?.dataset.totalPrice || 0);
  const downpayment = Number(document.getElementById('priceOutput')?.dataset.suggestedDownpayment || 2000);

  if (!firstName || !lastName || !email || !phone || !bookingType || !checkIn || !paymentMethod) {
    alert('Please complete all required booking fields.');
    return;
  }
  if (!terms || !cancel) {
    alert('Please accept the terms and cancellation policy.');
    return;
  }

  const formData = new FormData();
  formData.append('first_name', firstName);
  formData.append('last_name', lastName);
  formData.append('email', email);
  formData.append('phone', phone);
  formData.append('booking_type', bookingType);
  formData.append('check_in_date', checkIn);
  formData.append('adults', adults);
  formData.append('youth', youth);
  formData.append('downpayment', String(Math.min(downpayment, totalPrice || downpayment)));
  formData.append('payment_method', paymentMethod);
  if (specialRequest) formData.append('special_request', specialRequest);
  if (validID) formData.append('valid_id', validID);

  const matchedPackage = findMatchingPackage();
  if (matchedPackage?.id) formData.append('package_id', String(matchedPackage.id));

  if (paymentMethod === 'gcash') {
    formData.append('payment_ref', document.getElementById('gcashName')?.value.trim() || '');
    formData.append('payment_number', document.getElementById('gcashNum')?.value.trim() || '');
    const screenshot = document.getElementById('gcashScreenshot')?.files?.[0];
    if (!screenshot) return alert('Please upload your GCash screenshot.');
    formData.append('payment_screenshot', screenshot);
  }
  if (paymentMethod === 'paymaya') {
    formData.append('payment_ref', document.getElementById('cardHolder')?.value.trim() || '');
    formData.append('payment_number', document.getElementById('cardNumber')?.value.trim() || '');
    const screenshot = document.getElementById('txnScreenshot')?.files?.[0];
    if (!screenshot) return alert('Please upload your PayMaya screenshot.');
    formData.append('payment_screenshot', screenshot);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/bookings/`, { method: 'POST', body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'Booking failed.');
    showToast('bookingToast', `Booking submitted! Reference: ${payload.data.reference_no}`);
    alert(`Booking submitted successfully. Reference No: ${payload.data.reference_no}`);
  } catch (err) {
    alert(err.message);
  }
}

async function loadReviews() {
  try {
    const data = await api('/reviews');
    const items = Array.isArray(data?.items) ? data.items : [];
    const grid = document.getElementById('reviewsGrid');
    if (!grid) return;

    grid.innerHTML = items.length ? items.map((review) => {
      const media = Array.isArray(review.media) ? review.media : [];
      const adminReply = review.admin_reply || '';

      return `
        <div class="review-card">
          <div class="review-header">
            <div class="reviewer-avatar">${(review.guest_name || 'G').charAt(0)}</div>
            <div class="reviewer-info">
              <div class="name">${review.guest_name || 'Guest'}</div>
              <div class="date">${review.created_at ? new Date(review.created_at).toLocaleDateString('en-PH') : '—'}</div>
            </div>
          </div>

          <div class="review-stars">${'★'.repeat(Number(review.rating || 0))}${'☆'.repeat(5 - Number(review.rating || 0))}</div>
          <div class="review-text">"${review.body || ''}"</div>

          ${
            media.length ? `
              <div class="review-media-gallery">
                ${media.map((item) => {
                  const url = item.url || item.file_url || item.media_url || '';
                  const type = (item.type || item.media_type || '').toLowerCase();

                  if (type.startsWith('video')) {
                    return `
                      <div class="review-media-item">
                        <video controls preload="metadata">
                          <source src="${url}">
                          Your browser does not support video playback.
                        </video>
                      </div>
                    `;
                  }

                  return `
                    <div class="review-media-item">
                      <img src="${url}" alt="Review media">
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''
          }

          ${
            adminReply ? `
              <div class="review-admin-reply">
                <div class="reply-label">Admin Reply</div>
                <div class="reply-text">${adminReply}</div>
              </div>
            ` : ''
          }
        </div>
      `;
    }).join('') : '<p style="color:white;">No reviews yet.</p>';
  } catch (err) {
    console.warn('Failed to load reviews:', err.message);
  }
}

async function submitReview() {
  const guestName = document.getElementById('reviewName')?.value.trim();
  const body = document.getElementById('reviewText')?.value.trim();
  const rating = document.querySelector('input[name="rating"]:checked')?.value || document.querySelector('input[id^="star"]:checked')?.value;
  const files = document.getElementById('reviewMedia')?.files || [];

  if (!guestName || !body || !rating) {
    alert('Please complete the review form.');
    return;
  }

  const formData = new FormData();
  formData.append('guest_name', guestName);
  formData.append('body', body);
  formData.append('rating', rating);
  [...files].forEach((file) => formData.append('media', file));

  try {
    const response = await fetch(`${API_BASE_URL}/reviews/`, { method: 'POST', body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'Failed to submit review.');
    document.getElementById('reviewModal')?.classList.remove('open');
    showToast('successToast', 'Thank you for your review!');
    await loadReviews();
  } catch (err) {
    alert(err.message);
  }
}

async function renderCalendar() {
  const datesContainer = document.getElementById('dates');
  const monthYearEl = document.getElementById('month-year');
  if (!datesContainer || !monthYearEl) return;

  const year = currentCalendarDate.getFullYear();
  const monthIndex = currentCalendarDate.getMonth();
  const apiMonth = monthIndex + 1;
  monthYearEl.textContent = currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  datesContainer.innerHTML = '';
  try {
    const data = await api(`/calendar/month?year=${year}&month=${apiMonth}`);
    const firstDay = new Date(year, monthIndex, 1).getDay();
    for (let i = 0; i < firstDay; i += 1) {
      const empty = document.createElement('div');
      empty.className = 'cal-date empty';
      datesContainer.appendChild(empty);
    }

    data.days.forEach((day) => {
      const dateObj = new Date(day.date);
      const cell = document.createElement('div');
      cell.className = 'cal-date';
      cell.textContent = String(dateObj.getDate());
      cell.dataset.dateKey = day.date;
      if (selectedCalendarDate === day.date) cell.classList.add('selected');

      const todayKey = new Date().toISOString().split('T')[0];
      if (day.date < todayKey) cell.classList.add('past');
      else if (day.status === 'available') cell.classList.add('available');
      else if (day.status === 'dayswimming') cell.classList.add('day-booked');
      else if (day.status === 'nightswimming') cell.classList.add('night-booked');
      else if (day.status === 'overnight') cell.classList.add('overnight-booked');
      else cell.classList.add('multi-booked');

      cell.addEventListener('click', async () => {
        selectedCalendarDate = day.date;
        await renderCalendar();
        renderSlots(day.date);
      });
      datesContainer.appendChild(cell);
    });
  } catch (err) {
    datesContainer.innerHTML = `<p>${err.message}</p>`;
  }
}

async function renderSlots(dateKey) {
  const selectedDateLabel = document.getElementById('selectedDateLabel');
  const slotsBody = document.getElementById('slotsBody');
  if (!selectedDateLabel || !slotsBody) return;

  try {
    const data = await api(`/calendar/date?date=${dateKey}`);
    selectedDateLabel.textContent = new Date(dateKey).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const types = [
      ['dayswimming', 'Day Swimming', '6:00 AM – 5:00 PM'],
      ['nightswimming', 'Night Swimming', '6:00 PM – 5:00 AM'],
      ['overnight', 'Overnight', '8:00 AM – 8:00 AM'],
    ];
    slotsBody.innerHTML = types.map(([type, label, time]) => {
      const booked = data.slots.find((slot) => slot.type === type);
      return `
        <div class="slot-row">
          <div class="slot-badge ${booked ? `badge-${type === 'dayswimming' ? 'day' : type === 'nightswimming' ? 'night' : 'overnight'}` : 'badge-available'}"></div>
          <div class="slot-info">
            <div class="slot-type">${label}</div>
            <div class="slot-time">${time}</div>
          </div>
          <div class="slot-status ${booked ? 'status-booked' : 'status-available'}">${booked ? 'Booked' : 'Open'}</div>
        </div>`;
    }).join('');
  } catch (err) {
    slotsBody.innerHTML = `<p>${err.message}</p>`;
  }
}

function bindEvents() {
  document.getElementById('openReviewModal')?.addEventListener('click', () => document.getElementById('reviewModal')?.classList.add('open'));
  document.getElementById('closeModal')?.addEventListener('click', () => document.getElementById('reviewModal')?.classList.remove('open'));
  document.getElementById('toggleReviews')?.addEventListener('click', async () => {
    const panel = document.getElementById('reviewsPanel');
    const open = panel?.classList.toggle('visible');
    if (open) await loadReviews();
  });
  document.getElementById('submitReview')?.addEventListener('click', submitReview);
  document.getElementById('confirmBtn')?.addEventListener('click', submitBooking);
  document.getElementById('prev')?.addEventListener('click', async () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); await renderCalendar(); });
  document.getElementById('next')?.addEventListener('click', async () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); await renderCalendar(); });

  ['checkIn', 'adults', 'children', 'accomSelect', 'timeSelect'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', updatePrice);
    document.getElementById(id)?.addEventListener('input', updatePrice);
  });

  document.querySelectorAll('input[name="bayadmethod"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      ['cardFields', 'gcashFields', 'cashFields'].forEach((id) => document.getElementById(id)?.classList.remove('visible'));
      if (radio.value === 'paymaya') document.getElementById('cardFields')?.classList.add('visible');
      if (radio.value === 'gcash') document.getElementById('gcashFields')?.classList.add('visible');
      if (radio.value === 'cash') document.getElementById('cashFields')?.classList.add('visible');
    });
  });
}

(async function init() {
  const today = new Date().toISOString().split('T')[0];
  const checkIn = document.getElementById('checkIn');
  const checkOut = document.getElementById('checkOut');
  if (checkIn) checkIn.min = today;
  if (checkOut) checkOut.min = today;

  bindEvents();
  await loadPackages();
  await updatePrice();
  await loadReviews();
  await renderCalendar();
  gotoPage('page-main');
})();
