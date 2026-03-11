// =========================================
// COMPONENT LOADER
// Fetches HTML component files and injects
// them into their placeholder elements.
// Requires VS Code Live Server to run.
// =========================================

/**
 * Loads a single HTML component into a target element.
 * @param {string} targetId   - The id of the placeholder element
 * @param {string} filePath   - Relative path to the component HTML file
 * @returns {Promise<void>}
 */
async function loadComponent(targetId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
        }
        const html = await response.text();
        document.getElementById(targetId).innerHTML = html;
    } catch (error) {
        console.error(`Component load error [${filePath}]:`, error);
    }
}

/**
 * Loads all components in order, then initialises the application.
 * The await chain guarantees the DOM is fully populated before any
 * render function tries to query elements.
 */
async function loadAllComponents() {
    await loadComponent('sidebar-placeholder',   'components/sidebar.html');
    await loadComponent('header-placeholder',    'components/header.html');
    await loadComponent('dashboard-placeholder', 'components/dashboard.html');
    await loadComponent('calendar-placeholder',  'components/calendar.html');
    await loadComponent('modals-placeholder',    'components/modals.html');

    // All components are in the DOM — boot the app
    initApp();
}


// =========================================
// DATA STORE
// Central source of truth for all app data
// =========================================
const store = {
    bookings: [
        { id: 'BK001', guest: 'Maria Santos',    contact: '+63 912 345 6789', email: 'maria@email.com',    event: 'Wedding',           date: '2026-03-15', checkOut: '2026-03-17', guests: 150, status: 'Pending',   amount: 85000,  paid: 0 },
        { id: 'BK002', guest: 'Juan Dela Cruz',  contact: '+63 917 123 4567', email: 'juan@email.com',     event: 'Corporate Event',   date: '2026-03-20', checkOut: '2026-03-20', guests: 50,  status: 'Approved',  amount: 45000,  paid: 22500 },
        { id: 'BK003', guest: 'Anna Reyes',      contact: '+63 918 765 4321', email: 'anna@email.com',     event: 'Birthday Party',    date: '2026-02-28', checkOut: '2026-02-28', guests: 30,  status: 'Completed', amount: 25000,  paid: 25000 },
        { id: 'BK004', guest: 'Robert Lim',      contact: '+63 915 987 6543', email: 'robert@email.com',   event: 'Wedding',           date: '2026-04-05', checkOut: '2026-04-07', guests: 200, status: 'Approved',  amount: 120000, paid: 60000 },
        { id: 'BK005', guest: 'Catherine Tan',   contact: '+63 913 456 7890', email: 'cathy@email.com',    event: 'Debut',             date: '2026-03-10', checkOut: '2026-03-10', guests: 100, status: 'Pending',   amount: 55000,  paid: 0 },
        { id: 'BK006', guest: 'Michael Chen',    contact: '+63 916 234 5678', email: 'michael@email.com',  event: 'Corporate Retreat', date: '2026-05-15', checkOut: '2026-05-18', guests: 25,  status: 'Approved',  amount: 75000,  paid: 37500 }
    ],
    guests: [
        { name: 'Maria Santos',   email: 'maria@email.com',   phone: '+63 912 345 6789', bookings: 2, lastVisit: '2026-03-15' },
        { name: 'Juan Dela Cruz', email: 'juan@email.com',    phone: '+63 917 123 4567', bookings: 5, lastVisit: '2026-03-20' },
        { name: 'Anna Reyes',     email: 'anna@email.com',    phone: '+63 918 765 4321', bookings: 1, lastVisit: '2026-02-28' },
        { name: 'Robert Lim',     email: 'robert@email.com',  phone: '+63 915 987 6543', bookings: 3, lastVisit: '2026-04-05' }
    ],
    reviews: [
        { id: 1, name: 'Maria Santos',   rating: 5, date: '2026-02-20', text: 'Absolutely stunning venue! The staff was incredibly accommodating and our wedding was perfect.' },
        { id: 2, name: 'Juan Dela Cruz', rating: 5, date: '2026-02-15', text: 'Best corporate event venue in Manila. Professional service and beautiful gardens.' },
        { id: 3, name: 'Anna Reyes',     rating: 4, date: '2026-02-28', text: 'Great experience overall. The pool area was amazing. Would recommend!' },
        { id: 4, name: 'Robert Lim',     rating: 5, date: '2026-01-10', text: 'Second time booking here. Consistently excellent service and beautiful grounds.' }
    ],
    packages: [
        { id: 1, name: 'Wedding Package Gold',      description: 'Complete wedding package with catering for 100 guests, floral arrangements, and overnight stay.', price: 85000, duration: 24 },
        { id: 2, name: 'Corporate Event Standard',  description: 'Meeting room setup, AV equipment, lunch buffet for up to 50 guests.',                             price: 35000, duration: 8  },
        { id: 3, name: 'Birthday Celebration',      description: 'Venue rental, decorations, catering for 30 guests, and swimming pool access.',                    price: 25000, duration: 6  }
    ],
    currentDate: new Date(2026, 1, 28) // Feb 2026
};


// =========================================
// NAVIGATION FUNCTIONS
// =========================================

/**
 * Shows the selected content section and hides all others.
 * @param {string}      sectionId  - The id of the section to display
 * @param {HTMLElement} navElement - The nav link that was clicked
 */
function showSection(sectionId, navElement) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionId).classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    if (navElement) navElement.classList.add('active');

    // Close sidebar on mobile
    if (window.innerWidth < 992) {
        toggleSidebar();
    }

    // Initialise section-specific content
    if (sectionId === 'dashboard')        initDashboard();
    if (sectionId === 'booking-approval') renderApprovalTable();
    if (sectionId === 'all-reservations') renderReservationsTable();
    if (sectionId === 'calendar')         renderCalendar();
    if (sectionId === 'guests')           renderGuestsTable();
    if (sectionId === 'reviews')          renderReviews();
    if (sectionId === 'payments')         renderPaymentsTable();
    if (sectionId === 'events')           renderPackages();
    if (sectionId === 'reports')          initReports();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        alert('Logged out successfully!');
        location.reload();
    }
}


// =========================================
// DASHBOARD FUNCTIONS
// =========================================
function initDashboard() {
    // Update stats
    const pending  = store.bookings.filter(b => b.status === 'Pending').length;
    const approved = store.bookings.filter(b => b.status === 'Approved').length;

    document.getElementById('pendingApprovals').textContent  = pending;
    document.getElementById('approvedBookings').textContent  = approved;
    document.getElementById('totalBookings').textContent     = store.bookings.length;

    // Render recent bookings
    const tbody = document.getElementById('recentBookingsTable');
    tbody.innerHTML = store.bookings.slice(0, 5).map(booking => `
        <tr>
            <td><strong>${booking.guest}</strong></td>
            <td>${booking.event}</td>
            <td>${formatDate(booking.date)}</td>
            <td><span class="status-badge status-${booking.status.toLowerCase()}">${booking.status}</span></td>
            <td>₱${booking.amount.toLocaleString()}</td>
        </tr>
    `).join('');

    // Destroy previous chart instance if it exists to avoid canvas reuse errors
    const existingChart = Chart.getChart('bookingsChart');
    if (existingChart) existingChart.destroy();

    // Initialise bookings chart
    const ctx = document.getElementById('bookingsChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
            datasets: [{
                label: 'Bookings',
                data: [12, 19, 15, 25, 22, 30],
                borderColor: '#D4AF37',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}


// =========================================
// BOOKING APPROVAL FUNCTIONS
// =========================================
function renderApprovalTable() {
    const tbody   = document.getElementById('approvalTable');
    const pending = store.bookings.filter(b => b.status === 'Pending');

    tbody.innerHTML = pending.map(booking => `
        <tr>
            <td><strong>${booking.guest}</strong></td>
            <td>${booking.contact}</td>
            <td>${booking.event}</td>
            <td>${formatDate(booking.date)}</td>
            <td>${booking.guests}</td>
            <td><span class="status-badge status-pending">Pending</span></td>
            <td>
                <button class="btn-action btn-approve" onclick="updateStatus('${booking.id}', 'Approved')">
                    <i class="bi bi-check-lg"></i> Approve
                </button>
                <button class="btn-action btn-reject" onclick="updateStatus('${booking.id}', 'Rejected')">
                    <i class="bi bi-x-lg"></i> Reject
                </button>
            </td>
        </tr>
    `).join('');
}

function filterApprovals() {
    const search = document.getElementById('approvalSearch').value.toLowerCase();
    document.querySelectorAll('#approvalTable tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
    });
}

function updateStatus(bookingId, status) {
    const booking = store.bookings.find(b => b.id === bookingId);
    if (booking) {
        booking.status = status;
        alert(`Booking ${bookingId} has been ${status.toLowerCase()}!`);
        renderApprovalTable();
        updateNotificationCount();
    }
}


// =========================================
// RESERVATIONS FUNCTIONS
// =========================================
function renderReservationsTable() {
    const tbody = document.getElementById('reservationsTable');
    tbody.innerHTML = store.bookings.map(booking => `
        <tr>
            <td><strong>${booking.id}</strong></td>
            <td>${booking.guest}</td>
            <td>${booking.event}</td>
            <td>${formatDate(booking.date)}</td>
            <td>${formatDate(booking.checkOut)}</td>
            <td>${booking.guests}</td>
            <td><span class="status-badge status-${booking.status.toLowerCase()}">${booking.status}</span></td>
            <td>₱${booking.amount.toLocaleString()}</td>
            <td>
                <button class="btn-action btn-view" onclick="viewBooking('${booking.id}')">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn-action btn-edit" onclick="editBooking('${booking.id}')">
                    <i class="bi bi-pencil"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterReservations() {
    const status = document.getElementById('statusFilter').value;
    const date   = document.getElementById('dateFilter').value;
    const search = document.getElementById('reservationSearch').value.toLowerCase();

    document.querySelectorAll('#reservationsTable tr').forEach(row => {
        const rowStatus = row.querySelector('.status-badge')?.textContent || '';
        const rowText   = row.textContent.toLowerCase();
        const rowDate   = row.cells[3]?.textContent || '';

        const matchStatus = !status || rowStatus === status;
        const matchSearch = !search || rowText.includes(search);
        const matchDate   = !date   || rowDate.includes(formatDate(date));

        row.style.display = (matchStatus && matchSearch && matchDate) ? '' : 'none';
    });
}

function viewBooking(id) {
    const booking = store.bookings.find(b => b.id === id);
    alert(`Booking Details:\n\nGuest: ${booking.guest}\nEvent: ${booking.event}\nDate: ${formatDate(booking.date)}\nAmount: ₱${booking.amount.toLocaleString()}`);
}

function editBooking(id) {
    alert(`Edit functionality for booking ${id} would open an edit modal.`);
}


// =========================================
// CALENDAR FUNCTIONS
// =========================================
function renderCalendar() {
    const year     = store.currentDate.getFullYear();
    const month    = store.currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    document.getElementById('currentMonth').textContent =
        new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    // Day-of-week headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        grid.innerHTML += `<div class="calendar-day-header">${day}</div>`;
    });

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="calendar-day other-month"></div>`;
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr     = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayBookings = store.bookings.filter(b => b.date === dateStr);
        const isBooked    = dayBookings.length > 0;
        const isFull      = dayBookings.filter(b => b.status === 'Approved').length >= 3;

        let bookingClass = '';
        if (isFull)      bookingClass = 'booked-full';
        else if (isBooked) bookingClass = 'booked';

        grid.innerHTML += `
            <div class="calendar-day ${bookingClass}">
                <span class="day-number">${day}</span>
                ${isBooked ? `<span class="booking-indicator">${dayBookings.length} booking${dayBookings.length > 1 ? 's' : ''}</span>` : ''}
            </div>
        `;
    }
}

function changeMonth(delta) {
    store.currentDate.setMonth(store.currentDate.getMonth() + delta);
    renderCalendar();
}


// =========================================
// GUESTS FUNCTIONS
// =========================================
function renderGuestsTable() {
    const tbody = document.getElementById('guestsTable');
    tbody.innerHTML = store.guests.map(guest => `
        <tr>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="reviewer-avatar" style="width: 35px; height: 35px; font-size: 0.9rem;">
                        ${guest.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <strong>${guest.name}</strong>
                </div>
            </td>
            <td>${guest.email}</td>
            <td>${guest.phone}</td>
            <td><span class="badge bg-secondary">${guest.bookings}</span></td>
            <td>${formatDate(guest.lastVisit)}</td>
            <td>
                <button class="btn-action btn-view" onclick="viewGuest('${guest.email}')">
                    <i class="bi bi-eye"></i> History
                </button>
            </td>
        </tr>
    `).join('');
}

function filterGuests() {
    const search = document.getElementById('guestSearch').value.toLowerCase();
    document.querySelectorAll('#guestsTable tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
    });
}

function viewGuest(email) {
    const guest   = store.guests.find(g => g.email === email);
    const history = store.bookings.filter(b => b.email === email);
    alert(`Guest: ${guest.name}\nTotal Bookings: ${guest.bookings}\n\nBooking History:\n${history.map(h => `- ${h.event} on ${formatDate(h.date)}`).join('\n')}`);
}


// =========================================
// REVIEWS FUNCTIONS
// =========================================
function renderReviews() {
    const container = document.getElementById('reviewsContainer');
    container.innerHTML = store.reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <div class="reviewer-info">
                    <div class="reviewer-avatar">${review.name.split(' ').map(n => n[0]).join('')}</div>
                    <div>
                        <div class="reviewer-name">${review.name}</div>
                        <div class="review-date">${formatDate(review.date)}</div>
                    </div>
                </div>
                <div class="review-rating">
                    ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                </div>
            </div>
            <p class="review-text">"${review.text}"</p>
            <div class="mt-3 text-end">
                <button class="btn-action btn-delete" onclick="deleteReview(${review.id})">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function deleteReview(id) {
    if (confirm('Are you sure you want to delete this review?')) {
        store.reviews = store.reviews.filter(r => r.id !== id);
        renderReviews();
    }
}


// =========================================
// PAYMENTS FUNCTIONS
// =========================================
function renderPaymentsTable() {
    const tbody = document.getElementById('paymentsTable');
    tbody.innerHTML = store.bookings.map(booking => {
        const balance = booking.amount - booking.paid;
        let status    = 'Pending';
        if (booking.paid >= booking.amount) status = 'Paid';
        else if (booking.paid > 0)          status = 'Partial';

        return `
            <tr>
                <td><strong>${booking.id}</strong></td>
                <td>${booking.guest}</td>
                <td>₱${booking.amount.toLocaleString()}</td>
                <td>₱${booking.paid.toLocaleString()}</td>
                <td>₱${balance.toLocaleString()}</td>
                <td><span class="status-badge status-${status.toLowerCase()}">${status}</span></td>
                <td>
                    <button class="btn-action btn-edit" onclick="recordPayment('${booking.id}')">
                        <i class="bi bi-cash"></i> Record Payment
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterPayments() {
    const status = document.getElementById('paymentFilter').value;
    document.querySelectorAll('#paymentsTable tr').forEach(row => {
        const rowStatus = row.querySelector('.status-badge')?.textContent || '';
        row.style.display = !status || rowStatus === status ? '' : 'none';
    });
}

function recordPayment(bookingId) {
    const amount = prompt('Enter payment amount:');
    if (amount && !isNaN(amount)) {
        const booking = store.bookings.find(b => b.id === bookingId);
        booking.paid += parseInt(amount);
        alert(`Payment of ₱${amount} recorded for booking ${bookingId}`);
        renderPaymentsTable();
    }
}


// =========================================
// EVENTS & PACKAGES FUNCTIONS
// =========================================
function renderPackages() {
    const container = document.getElementById('packagesContainer');
    container.innerHTML = store.packages.map(pkg => `
        <div class="col-md-4 mb-4">
            <div class="card h-100" style="border-top: 3px solid var(--gold);">
                <div class="card-body">
                    <h5 class="card-title" style="font-family: var(--heading-font); color: var(--dark);">${pkg.name}</h5>
                    <p class="card-text text-muted">${pkg.description}</p>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <span class="h5 mb-0" style="color: var(--gold); font-family: var(--heading-font);">₱${pkg.price.toLocaleString()}</span>
                        <span class="badge bg-secondary">${pkg.duration} hrs</span>
                    </div>
                </div>
                <div class="card-footer bg-transparent">
                    <button class="btn btn-sm btn-outline-secondary" onclick="editPackage(${pkg.id})">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger float-end" onclick="deletePackage(${pkg.id})">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function addPackage(event) {
    event.preventDefault();
    const newPackage = {
        id:          store.packages.length + 1,
        name:        document.getElementById('packageName').value,
        description: document.getElementById('packageDesc').value,
        price:       parseInt(document.getElementById('packagePrice').value),
        duration:    parseInt(document.getElementById('packageDuration').value)
    };
    store.packages.push(newPackage);
    bootstrap.Modal.getInstance(document.getElementById('addPackageModal')).hide();
    document.getElementById('addPackageForm').reset();
    renderPackages();
}

function editPackage(id) {
    alert(`Edit package ${id} functionality would open an edit modal.`);
}

function deletePackage(id) {
    if (confirm('Are you sure you want to delete this package?')) {
        store.packages = store.packages.filter(p => p.id !== id);
        renderPackages();
    }
}


// =========================================
// REPORTS FUNCTIONS
// =========================================
function initReports() {
    // Destroy any previous instances to prevent canvas reuse errors
    ['revenueChart', 'statisticsChart'].forEach(id => {
        const existing = Chart.getChart(id);
        if (existing) existing.destroy();
    });

    // Revenue Bar Chart
    const revCtx = document.getElementById('revenueChart').getContext('2d');
    new Chart(revCtx, {
        type: 'bar',
        data: {
            labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
            datasets: [{
                label: 'Revenue (₱)',
                data: [450000, 620000, 580000, 890000, 750000, 920000],
                backgroundColor: '#D4AF37',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Booking Type Doughnut Chart
    const statCtx = document.getElementById('statisticsChart').getContext('2d');
    new Chart(statCtx, {
        type: 'doughnut',
        data: {
            labels: ['Weddings', 'Corporate', 'Birthdays', 'Others'],
            datasets: [{
                data: [45, 30, 15, 10],
                backgroundColor: ['#D4AF37', '#1A1A1A', '#17a2b8', '#6c757d']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    // Monthly Summary Table
    const summaryData = [
        { month: 'February 2026', bookings: 30, revenue: 920000, occupancy: '85%', avgGuests: 85 },
        { month: 'January 2026',  bookings: 25, revenue: 750000, occupancy: '78%', avgGuests: 72 },
        { month: 'December 2025', bookings: 35, revenue: 890000, occupancy: '92%', avgGuests: 95 }
    ];

    document.getElementById('monthlySummaryTable').innerHTML = summaryData.map(row => `
        <tr>
            <td><strong>${row.month}</strong></td>
            <td>${row.bookings}</td>
            <td>₱${row.revenue.toLocaleString()}</td>
            <td>${row.occupancy}</td>
            <td>${row.avgGuests}</td>
        </tr>
    `).join('');
}


// =========================================
// SETTINGS FUNCTIONS
// =========================================
function saveSettings(event) {
    event.preventDefault();
    const newPass     = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;

    if (newPass && newPass !== confirmPass) {
        alert('Passwords do not match!');
        return;
    }
    alert('Settings saved successfully!');
}


// =========================================
// UTILITY FUNCTIONS
// =========================================

/**
 * Formats an ISO date string (YYYY-MM-DD) into a human-readable form.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Reads pending booking count and refreshes the notification badge. */
function updateNotificationCount() {
    const pending = store.bookings.filter(b => b.status === 'Pending').length;
    document.getElementById('notificationCount').textContent = pending;
}


// =========================================
// INITIALISATION
// Runs after all components have been
// loaded into the DOM.
// =========================================
function initApp() {
    initDashboard();
    updateNotificationCount();
}

// Entry point — kick off component loading on DOM ready
document.addEventListener('DOMContentLoaded', loadAllComponents);
