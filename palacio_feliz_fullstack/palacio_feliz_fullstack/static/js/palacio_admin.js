const API_BASE = `${window.location.origin}/api`;
let token = localStorage.getItem('token');
let bookingsChart;
let revenueChart;
let statisticsChart;
let adminCalendarDate = new Date();

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }
  if (!response.ok) throw new Error(payload.message || 'Request failed.');
  return payload.data;
}

function showSection(sectionId, navElement) {
  document.querySelectorAll('.content-section').forEach((section) => section.classList.remove('active'));
  document.getElementById(sectionId)?.classList.add('active');
  document.querySelectorAll('.nav-link').forEach((link) => link.classList.remove('active'));
  if (navElement) navElement.classList.add('active');

  const loaders = {
    dashboard: loadDashboard,
    'booking-approval': loadBookingApproval,
    'all-reservations': loadReservations,
    calendar: loadAdminCalendar,
    guests: loadGuests,
    reviews: loadReviews,
    payments: loadPayments,
    events: loadPackages,
    reports: loadReports,
  };
  loaders[sectionId]?.();
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('active');
  document.querySelector('.sidebar-overlay')?.classList.toggle('active');
}

function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login';
}

function currency(value) {
  return `₱${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-PH') : '—';
}

function statusBadge(status) {
  const normalized = (status || 'pending').toLowerCase();
  return `<span class="status-badge status-${normalized}">${normalized[0].toUpperCase()}${normalized.slice(1)}</span>`;
}

async function loadDashboard() {
  const selectedRange = document.getElementById('dashboardRange')?.value || 'this_month';

  const stats = await api('/dashboard/stats', { headers: authHeaders() });
  document.getElementById('totalBookings').textContent = stats.total_bookings ?? 0;
  document.getElementById('pendingApprovals').textContent = stats.pending ?? 0;
  document.getElementById('approvedBookings').textContent = stats.approved ?? 0;
  document.getElementById('totalRevenue').textContent = currency(stats.total_revenue ?? 0);
  document.getElementById('notificationCount').textContent = stats.pending ?? 0;

  const recent = await api('/dashboard/recent-bookings?limit=5', { headers: authHeaders() });
  const recentTable = document.getElementById('recentBookingsTable');
  if (recentTable) {
    recentTable.innerHTML = recent.map((booking) => `
      <tr>
        <td><strong>${booking.guest?.full_name || '—'}</strong></td>
        <td>${booking.booking_type || '—'}</td>
        <td>${formatDate(booking.check_in_date)}</td>
        <td>${statusBadge(booking.status)}</td>
        <td>${currency(booking.total_price)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">No recent bookings.</td></tr>';
  }

  const bookingStats = await api(`/dashboard/booking-stats?range=${encodeURIComponent(selectedRange)}`, {
    headers: authHeaders()
  });

  const ctx = document.getElementById('bookingsChart')?.getContext('2d');
  if (ctx) {
    if (bookingsChart) bookingsChart.destroy();

    bookingsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: bookingStats.map(row => row.label),
        datasets: [{
          label: 'Bookings',
          data: bookingStats.map(row => row.total),
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/*EXPORT IN EXCEL YAN */
async function exportDashboardExcel() {
  try {
    const response = await fetch(`${API_BASE}/reports/export-monthly-excel`, {
      method: 'GET',
      headers: authHeaders()
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return;
    }

    if (!response.ok) {
      let errorMessage = 'Failed to export Excel file.';
      try {
        const errorPayload = await response.json();
        errorMessage = errorPayload.message || errorMessage;
      } catch (_) {}
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const today = new Date();
    const filename = `palacio_monthly_report_${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, '0')}.xlsx`;
    downloadBlob(blob, filename);
  } catch (err) {
    alert(err.message);
  }
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function safeValue(value) {
  return value ?? '—';
}

function buildImagePreview(url, label) {
  if (!url) return '<span class="text-muted">No file uploaded</span>';
  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-secondary">
      View ${label}
    </a>
  `;
}

async function loadBookingApproval() {
  try {
    const query = document.getElementById('approvalSearch')?.value || '';

    const data = await api(`/bookings/?q=${encodeURIComponent(query)}`, {
      headers: authHeaders()
    });

    const tbody = document.getElementById('approvalTable');
    if (!tbody) return;

    const items = data?.items || [];

    if (!items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">No bookings found.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map((booking) => {
      const bookingId = booking.id;
      const guestName =
        booking.guest?.full_name ||
        `${booking.guest?.first_name || ''} ${booking.guest?.last_name || ''}`.trim() ||
        '—';

      const phone = booking.guest?.phone || booking.contact_number || '—';
      const email = booking.guest?.email || '—';
      const eventType = booking.booking_type || booking.event_type || '—';
      const submittedAt =
        booking.created_at || booking.submitted_at || booking.booked_at || booking.created_on || null;

      const adults = Number(booking.adults ?? booking.number_of_adults ?? 0);
      const children = Number(booking.youth ?? booking.children ?? booking.number_of_children ?? 0);
      const totalPax = booking.total_pax ?? (adults + children);

      const status = booking.status || 'pending';
      const checkIn = booking.check_in_date || '—';
      const checkOut = booking.check_out_date || '—';
      const packageName = booking.package?.name || booking.package_name || '—';
      const paymentMethod = booking.payment_method || '—';
      const price = booking.total_price ?? booking.price ?? 0;
      const accountName = booking.payment_ref || booking.account_name || '—';
      const paymentNumber = booking.payment_number || booking.card_number || booking.gcash_number || '—';
      const specialRequest = booking.special_request || booking.specialRequest || '—';

      const validIdUrl =
        booking.valid_id_url ||
        booking.valid_id ||
        booking.valid_id_path ||
        '';

      const transactionScreenshotUrl =
        booking.transaction_screenshot_url ||
        booking.payment_screenshot_url ||
        booking.screenshot_url ||
        booking.transaction_screenshot ||
        '';

      return `
        <tr>
          <td><strong>${guestName}</strong></td>
          <td>${phone}</td>
          <td>${eventType}</td>
          <td>${formatDateTime(submittedAt)}</td>
          <td>${totalPax}</td>
          <td>${statusBadge(status)}</td>
          <td class="d-flex gap-2 flex-wrap">
            <button class="btn-action btn-view" onclick="toggleBookingDetails(${bookingId})" title="View Details">
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>

        <tr id="booking-details-${bookingId}" class="booking-details-row" style="display:none;">
          <td colspan="7">
            <div class="booking-details-card">
              <div class="row g-3">

                <div class="col-md-6">
                  <p><strong>Guest Name:</strong> ${guestName}</p>
                  <p><strong>Contact Number:</strong> ${phone}</p>
                  <p><strong>Email Address:</strong> ${email}</p>
                  <p><strong>Event Type:</strong> ${eventType}</p>
                  <p><strong>Submitted Date & Time:</strong> ${formatDateTime(submittedAt)}</p>
                  <p><strong>Number of Adults:</strong> ${adults}</p>
                  <p><strong>Number of Children:</strong> ${children}</p>
                  <p><strong>Status:</strong> ${statusBadge(status)}</p>
                </div>

                <div class="col-md-6">
                  <p><strong>Check-in Date:</strong> ${formatDate(checkIn)}</p>
                  <p><strong>Check-out Date:</strong> ${formatDate(checkOut)}</p>
                  <p><strong>Package:</strong> ${packageName}</p>
                  <p><strong>Payment Method:</strong> ${paymentMethod}</p>
                  <p><strong>Price:</strong> ${currency(price)}</p>
                  <p><strong>Account Name:</strong> ${accountName}</p>
                  <p><strong>Card Number / GCash Number:</strong> ${paymentNumber}</p>
                </div>

                <div class="col-md-6">
                  <p><strong>Valid ID:</strong></p>
                  ${validIdUrl 
                    ? `<img src="${validIdUrl}" alt="Valid ID" 
                        style="width:100%; max-height:250px; object-fit:cover; border-radius:8px; border:1px solid #ddd;">`
                    : `<p style="color:#888;">No Valid ID uploaded</p>`
                  }
                </div>

                <div class="col-md-6">
                  <p><strong>Transaction Screenshot:</strong></p>
                  ${transactionScreenshotUrl 
                    ? `<img src="${transactionScreenshotUrl}" alt="Transaction Screenshot" 
                        style="width:100%; max-height:250px; object-fit:cover; border-radius:8px; border:1px solid #ddd;">`
                    : `<p style="color:#888;">No Screenshot uploaded</p>`
                  }
                </div>

                <div class="col-12">
                  <p><strong>Special Request:</strong></p>
                  <div style="
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    padding: 12px 14px;
                    background: #f8f9fa;
                    min-height: 60px;
                    white-space: pre-wrap;
                  ">
                    ${specialRequest}
                  </div>
                </div>
                <div class="col-12 mt-3 d-flex gap-2 justify-content-end">
                  <button class="btn btn-success"
                    onclick="updateBookingStatus(${bookingId}, 'approved')">
                    Approve
                  </button>

                  <button class="btn btn-danger"
                    onclick="updateBookingStatus(${bookingId}, 'rejected')">
                    Reject
                  </button>
                </div>

              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    alert(err.message);
  }
}

function toggleBookingDetails(bookingId) {
  const row = document.getElementById(`booking-details-${bookingId}`);
  if (!row) return;

  row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

async function loadReservations() {
  try {
    const status = document.getElementById('statusFilter')?.value || '';
    const date = document.getElementById('dateFilter')?.value || '';
    const q = document.getElementById('reservationSearch')?.value || '';

    const data = await api(
      `/bookings/?status=${encodeURIComponent(status)}&date=${encodeURIComponent(date)}&q=${encodeURIComponent(q)}`,
      { headers: authHeaders() }
    );

    const table = document.getElementById('reservationsTable');
    if (!table) return;

    const items = data?.items || [];

    if (!items.length) {
      table.innerHTML = `<tr><td colspan="9" class="text-center">No bookings found.</td></tr>`;
      return;
    }

    table.innerHTML = items.map((booking) => {
      const guestName =
        booking.guest?.full_name ||
        `${booking.guest?.first_name || ''} ${booking.guest?.last_name || ''}`.trim() ||
        '—';

      return `
        <tr>
          <td><strong>${booking.reference_no || '—'}</strong></td>
          <td>${guestName}</td>
          <td>${booking.booking_type || '—'}</td>
          <td>${formatDate(booking.check_in_date)}</td>
          <td>${formatDate(booking.check_out_date)}</td>
          <td>${booking.total_pax ?? '—'}</td>
          <td>${statusBadge(booking.status)}</td>
          <td>${currency(booking.total_price)}</td>
          <td>
            <button class="btn-action btn-delete" onclick="deleteBooking(${booking.id})">
              Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    alert(err.message);
  }
}

/*CALENDAR */
/*let adminCalendarDate = new Date();*/

function formatDateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeCalendarStatus(status) {
  return (status || '').toLowerCase().trim();
}

function getEventLabel(status) {
  const s = normalizeCalendarStatus(status);

  if (s === 'dayswimming' || s === 'day') return 'Day Swimming';
  if (s === 'nightswimming' || s === 'night') return 'Night Swimming';
  if (s === 'overnight') return 'Overnight';
  if (s === 'available') return 'Available';

  return status || 'Booked';
}

function getDayClass(day) {
  const status = normalizeCalendarStatus(day.status);

  if (status === 'available') return 'calendar-day available-day';
  if (status === 'dayswimming' || status === 'day') return 'calendar-day partial-day';
  if (status === 'nightswimming' || status === 'night') return 'calendar-day partial-night';
  if (status === 'overnight') return 'calendar-day partial-overnight';

  return 'calendar-day fully-booked';
}

function getBookingDetails(day) {
  const status = normalizeCalendarStatus(day.status);

  if (status === 'available') {
    return `<div class="calendar-day-empty">Available</div>`;
  }

  const guestName =
    day.guest_name ||
    day.guest?.full_name ||
    `${day.guest?.first_name || ''} ${day.guest?.last_name || ''}`.trim() ||
    'Booked Guest';

  return `
    <div class="calendar-booking-line">
      <span class="booking-guest">${guestName}</span>
      <span class="booking-type">${getEventLabel(day.status)}</span>
    </div>
  `;
}

async function loadAdminCalendar() {
  const grid = document.getElementById('calendarGrid');
  const title = document.getElementById('currentMonth');

  if (!grid) return;

  const year = adminCalendarDate.getFullYear();
  const monthIndex = adminCalendarDate.getMonth();
  const apiMonth = monthIndex + 1;

  if (title) {
    title.textContent = adminCalendarDate.toLocaleString('default', {
      month: 'long',
      year: 'numeric'
    });
  }

  grid.innerHTML = `
    <div class="calendar-day-header">Sun</div>
    <div class="calendar-day-header">Mon</div>
    <div class="calendar-day-header">Tue</div>
    <div class="calendar-day-header">Wed</div>
    <div class="calendar-day-header">Thu</div>
    <div class="calendar-day-header">Fri</div>
    <div class="calendar-day-header">Sat</div>
  `;

  try {
    const data = await api(`/calendar/month?year=${year}&month=${apiMonth}`, {
      headers: authHeaders()
    });

    const days = Array.isArray(data?.days) ? data.days : [];

    const firstDay = new Date(year, monthIndex, 1).getDay();

    for (let i = 0; i < firstDay; i += 1) {
      grid.innerHTML += `<div class="calendar-day other-month"></div>`;
    }

    days.forEach((day) => {
      const dateObj = new Date(day.date);
      const dayNumber = dateObj.getDate();

      grid.innerHTML += `
        <div class="${getDayClass(day)}">
          <div class="day-number">${dayNumber}</div>
          <div class="calendar-day-details">
            ${getBookingDetails(day)}
          </div>
        </div>
      `;
    });
  } catch (err) {
    grid.innerHTML = `
      <div class="calendar-error">
        Failed to load calendar: ${err.message}
      </div>
    `;
  }
}

function changeMonth(delta) {
  adminCalendarDate.setMonth(adminCalendarDate.getMonth() + delta);
  loadAdminCalendar();
}

async function loadGuests() {
  const q = document.getElementById('guestSearch')?.value || '';
  const data = await api(`/guests/?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
  document.getElementById('guestsTable').innerHTML = data.items.map((guest) => `
    <tr>
      <td><strong>${guest.full_name}</strong></td>
      <td>${guest.email}</td>
      <td>${guest.phone}</td>
      <td>${guest.total_bookings}</td>
      <td>${guest.last_visit ? formatDate(guest.last_visit) : '—'}</td>
      <td><button class="btn-action btn-delete" onclick="deleteGuest(${guest.id})">Delete</button></td>
    </tr>`).join('') || '<tr><td colspan="6">No guests found.</td></tr>';
}

async function loadReviews() {
  try {
    const data = await api('/reviews/all', { headers: authHeaders() });
    const items = Array.isArray(data?.items) ? data.items : [];
    const container = document.getElementById('reviewsContainer');
    if (!container) return;

    container.innerHTML = items.length ? items.map((review) => {
      const media = Array.isArray(review.media) ? review.media : [];
      const existingReply = review.admin_reply || '';

      return `
        <div class="review-card admin-review-card">
          <div class="review-header">
            <div class="reviewer-info">
              <div class="reviewer-avatar">${(review.guest_name || 'G').charAt(0)}</div>
              <div>
                <h4>${review.guest_name || 'Guest'}</h4>
                <p>${review.created_at ? new Date(review.created_at).toLocaleString('en-PH') : '—'}</p>
              </div>
            </div>
            <div class="review-rating">${'★'.repeat(Number(review.rating || 0))}${'☆'.repeat(5 - Number(review.rating || 0))}</div>
          </div>

          <div class="review-body">
            <p>${review.body || ''}</p>
          </div>

          ${
            media.length ? `
              <div class="admin-review-media">
                ${media.map((item, index) => {
                  const url = item.url || item.file_url || item.media_url || '';
                  const type = (item.type || item.media_type || '').toLowerCase();
                  const filename = item.filename || `review-media-${review.id}-${index + 1}`;

                  if (type.startsWith('video')) {
                    return `
                      <div class="admin-media-card">
                        <video controls preload="metadata">
                          <source src="${url}">
                        </video>
                        <a href="${url}" download="${filename}" class="btn btn-sm btn-outline-primary mt-2">Download Video</a>
                      </div>
                    `;
                  }

                  return `
                    <div class="admin-media-card">
                      <img src="${url}" alt="Review media">
                      <a href="${url}" download="${filename}" class="btn btn-sm btn-outline-primary mt-2">Download Photo</a>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : '<p style="color:#888;">No media uploaded.</p>'
          }

          <div class="admin-review-reply-box mt-3">
            <label class="form-label"><strong>Reply to this review</strong></label>
            <textarea 
              id="reply-${review.id}" 
              class="form-control" 
              rows="3" 
              placeholder="Write your reply here..."
            >${existingReply}</textarea>

            <div class="d-flex gap-2 mt-2">
              <button class="btn btn-success btn-sm" onclick="saveReviewReply(${review.id})">
                Save Reply
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteReview(${review.id})">
                Delete Review
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('') : '<p>No reviews found.</p>';
  } catch (err) {
    alert(err.message);
  }
}

async function saveReviewReply(reviewId) {
  const textarea = document.getElementById(`reply-${reviewId}`);
  if (!textarea) return;

  const admin_reply = textarea.value.trim();

  try {
    await api(`/reviews/${reviewId}/reply`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ admin_reply }),
    });

    alert('Reply saved successfully.');
    await loadReviews();
  } catch (err) {
    alert(err.message);
  }
}

function normalizePaymentList(booking) {
  return (
    booking.payments ||
    booking.payment_history ||
    booking.payment_records ||
    booking.records ||
    []
  );
}

function getRecordedAmountPaid(booking) {
  const payments = normalizePaymentList(booking);
  return payments.reduce((sum, payment) => {
    return sum + Number(payment.amount || payment.amount_paid || 0);
  }, 0);
}

function getComputedPaymentStatus(totalAmount, amountPaid) {
  if (amountPaid <= 0) return 'pending';
  if (amountPaid >= totalAmount) return 'paid';
  return 'partial';
}

async function loadPayments() {
  try {
    const data = await api('/bookings/', { headers: authHeaders() });
    const tbody = document.getElementById('paymentsTable');
    if (!tbody) return;

    const items = data?.items || [];

    tbody.innerHTML = items.map((booking) => {
      const totalAmount = Number(booking.total_price || 0);

      // IMPORTANT:
      // Do not auto-record downpayment as amount paid.
      // Only use actual recorded payments entered by admin.
      const amountPaid = getRecordedAmountPaid(booking);

      const balance = Math.max(totalAmount - amountPaid, 0);
      const paymentStatus = getComputedPaymentStatus(totalAmount, amountPaid);

      return `
        <tr>
          <td><strong>${booking.reference_no || booking.id || '—'}</strong></td>
          <td>${booking.guest?.full_name || '—'}</td>
          <td>${currency(totalAmount)}</td>
          <td>${currency(amountPaid)}</td>
          <td>${currency(balance)}</td>
          <td>${statusBadge(paymentStatus)}</td>
          <td>
            <button class="btn-action btn-edit" onclick="openRecordPaymentModal(${booking.id})">
              <i class="bi bi-cash"></i> Record Payment
            </button>
          </td>
          <td>
            <button class="btn-action btn-view" onclick="viewPaymentDetails(${booking.id})" title="View Payment Details">
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="8">No payments found.</td></tr>';
  } catch (err) {
    alert(err.message);
  }
}

function openRecordPaymentModal(bookingId) {
  document.getElementById('recordPaymentBookingId').value = bookingId;
  document.getElementById('recordPaymentMethod').value = '';
  document.getElementById('recordPaymentAmount').value = '';

  const modalEl = document.getElementById('recordPaymentModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function submitRecordedPayment(e) {
  e.preventDefault();

  const bookingId = document.getElementById('recordPaymentBookingId').value;
  const method = document.getElementById('recordPaymentMethod').value;
  const amount = Number(document.getElementById('recordPaymentAmount').value);

  if (!bookingId || !method || !amount || amount <= 0) {
    alert('Please complete the payment form correctly.');
    return;
  }

  try {
    await api(`/payments/${bookingId}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        method,
        amount,
        note: 'Recorded from admin payment modal'
      }),
    });

    const modalEl = document.getElementById('recordPaymentModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    e.target.reset();
    await loadPayments();
    await loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function viewPaymentDetails(bookingId) {
  try {
    const booking = await api(`/bookings/${bookingId}`, { headers: authHeaders() });
    const paymentDetailsBody = document.getElementById('paymentDetailsBody');
    if (!paymentDetailsBody) return;

    const paymentMethod =
      booking.payment_method ||
      booking.selected_payment_method ||
      '—';

    const accountName =
      booking.payment_ref ||
      booking.account_name ||
      booking.cardholder_name ||
      booking.gcash_name ||
      '—';

    const paymentNumber =
      booking.payment_number ||
      booking.card_number ||
      booking.gcash_number ||
      '—';

    const screenshotUrl =
      booking.transaction_screenshot_url ||
      booking.payment_screenshot_url ||
      booking.screenshot_url ||
      booking.transaction_screenshot ||
      '';

    paymentDetailsBody.innerHTML = `
      <div class="row g-4">
        <div class="col-md-6">
          <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p><strong>Cardholder Name / GCash Name:</strong> ${accountName}</p>
          <p><strong>Card Number / GCash Number:</strong> ${paymentNumber}</p>
        </div>

        <div class="col-md-6">
          <p><strong>Transaction Screenshot:</strong></p>
          ${
            screenshotUrl
              ? `<img
                    src="${screenshotUrl}"
                    alt="Transaction Screenshot"
                    style="width:100%; max-height:320px; object-fit:cover; border-radius:8px; border:1px solid #ddd;"
                 >`
              : `<p style="color:#888;">No screenshot uploaded</p>`
          }
        </div>
      </div>
    `;

    const modalEl = document.getElementById('paymentDetailsModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } catch (err) {
    alert(err.message);
  }
}

async function loadPackages() {
  const data = await api('/packages/all', { headers: authHeaders() });
  document.getElementById('packagesContainer').innerHTML = data.map((pkg) => `
    <div class="col-md-4 mb-4">
      <div class="card h-100" style="border-top: 3px solid var(--gold);">
        <div class="card-body">
          <h5 class="card-title">${pkg.icon || '⭐'} ${pkg.name}</h5>
          <p class="card-text text-muted">${pkg.description || ''}</p>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <span class="h5 mb-0">${currency(pkg.base_price)}</span>
            <span class="badge bg-secondary">${pkg.duration_hours || 0} hrs</span>
          </div>
        </div>
        <div class="card-footer bg-transparent">
          <button class="btn btn-sm btn-outline-secondary" onclick="togglePackage(${pkg.id}, ${pkg.is_active})">${pkg.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </div>
    </div>`).join('');
}

async function loadReports() {
  const [revenue, summary] = await Promise.all([
    api('/dashboard/monthly-revenue', { headers: authHeaders() }),
    api('/dashboard/monthly-summary', { headers: authHeaders() }),
  ]);

  const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
  if (revenueCtx) {
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(revenueCtx, {
      type: 'bar',
      data: { labels: revenue.map((row) => row.label), datasets: [{ label: 'Revenue', data: revenue.map((row) => row.revenue) }] },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  const statsCtx = document.getElementById('statisticsChart')?.getContext('2d');
  if (statsCtx) {
    if (statisticsChart) statisticsChart.destroy();
    statisticsChart = new Chart(statsCtx, {
      type: 'line',
      data: { labels: summary.map((row) => row.month), datasets: [{ label: 'Bookings', data: summary.map((row) => row.total_bookings) }] },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  document.getElementById('monthlySummaryTable').innerHTML = summary.map((row) => `
    <tr>
      <td>${row.month}</td>
      <td>${row.total_bookings}</td>
      <td>${currency(row.revenue)}</td>
      <td>${row.avg_pax}</td>
    </tr>`).join('') || '<tr><td colspan="4">No report data yet.</td></tr>';
}

async function updateBookingStatus(id, status) {
  try {
    await api(`/bookings/${id}/status`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status }),
    });
    await loadBookingApproval();
    await loadReservations();
    await loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteBooking(id) {
  if (!confirm('Delete this booking?')) return;
  try {
    await api(`/bookings/${id}`, { method: 'DELETE', headers: authHeaders() });
    await loadReservations();
    await loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteGuest(id) {
  if (!confirm('Delete this guest?')) return;
  try {
    await api(`/guests/${id}`, { method: 'DELETE', headers: authHeaders() });
    await loadGuests();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteReview(id) {
  if (!confirm('Delete this review?')) return;
  try {
    await api(`/reviews/${id}`, { method: 'DELETE', headers: authHeaders() });
    await loadReviews();
  } catch (err) {
    alert(err.message);
  }
}

async function recordPayment(bookingId) {
  const amount = prompt('Enter payment amount:');
  if (!amount) return;
  try {
    await api(`/payments/${bookingId}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ amount: Number(amount), method: 'cash', note: 'Recorded from admin dashboard' }),
    });
    await loadPayments();
    await loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function togglePackage(pkgId, isActive) {
  try {
    await api(`/packages/${pkgId}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ is_active: !isActive }),
    });
    await loadPackages();
  } catch (err) {
    alert(err.message);
  }
}

async function changePassword(e) {
  e.preventDefault();
  const currentPassword = prompt('Enter your current password:');
  const newPassword = document.getElementById('newPassword').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();
  if (!currentPassword || !newPassword || !confirmPassword) return alert('Please complete the password fields.');
  try {
    await api('/auth/change-password', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }),
    });
    alert('Password updated successfully.');
    e.target.reset();
  } catch (err) {
    alert(err.message);
  }
}

async function addPackage(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('packageName').value.trim(),
    description: document.getElementById('packageDesc').value.trim(),
    base_price: Number(document.getElementById('packagePrice').value || 0),
    duration_hours: Number(document.getElementById('packageDuration').value || 0),
  };
  try {
    await api('/packages/', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    alert('Package created.');
    e.target.reset();
    await loadPackages();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('approvalSearch')?.addEventListener('input', loadBookingApproval);
document.getElementById('statusFilter')?.addEventListener('change', loadReservations);
document.getElementById('dateFilter')?.addEventListener('change', loadReservations);
document.getElementById('reservationSearch')?.addEventListener('input', loadReservations);
document.getElementById('guestSearch')?.addEventListener('input', loadGuests);
document.getElementById('paymentFilter')?.addEventListener('change', loadPayments);
document.getElementById('recordPaymentForm')?.addEventListener('submit', submitRecordedPayment);
document.getElementById('resortSettingsForm')?.addEventListener('submit', changePassword);
document.getElementById('addPackageForm')?.addEventListener('submit', addPackage);
ocument.getElementById('dashboardRange')?.addEventListener('change', loadDashboard);
document.getElementById('exportExcelBtn')?.addEventListener('click', exportDashboardExcel);

(async function init() {
  if (!token) {
    window.location.href = '/login';
    return;
  }
  try {
    const me = await api('/auth/me', { headers: authHeaders() });
    document.querySelector('.admin-name').textContent = me.full_name || me.username;
    document.querySelector('.admin-role').textContent = me.role || 'admin';
    document.querySelector('.admin-avatar').textContent = (me.username || 'AD').slice(0, 2).toUpperCase();
    await loadDashboard();
  } catch (err) {
    console.error(err);
  }
})();
