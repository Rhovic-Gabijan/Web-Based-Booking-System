// ══════════════════════════════════════════════════════════
//  PALACIO FELIZ — BOOKING CALENDAR
// ══════════════════════════════════════════════════════════

// ── BOOKING DATA ──────────────────────────────────────────
// Each entry: { date: "YYYY-MM-DD", type: "day" | "night" | "overnight", guest: "Name" }
// A single date can have MULTIPLE entries (e.g., day + night on same day)
// Add/remove entries here to reflect real bookings.
const bookings = [
    { date: "2026-03-05",  type: "day",       guest: "Santos Family"    },
    { date: "2026-03-05",  type: "night",     guest: "Reyes Group"      },
    { date: "2026-03-10",  type: "overnight", guest: "Cruz Reunion"     },
    { date: "2026-03-15",  type: "day",       guest: "Villanueva Party" },
    { date: "2026-03-15",  type: "overnight", guest: "Garcia Wedding"   },
    { date: "2026-03-20",  type: "night",     guest: "Barkada Gala"     },
    { date: "2026-03-22",  type: "day",       guest: "Mendoza Birthday" },
    { date: "2026-03-22",  type: "night",     guest: "Lim Night Event"  },
    { date: "2026-03-22",  type: "overnight", guest: "Corporate Retreat" },
    { date: "2026-04-05",  type: "day",       guest: "Dela Cruz Family" },
    { date: "2026-04-12",  type: "overnight", guest: "Ramos Reunion"    },
    { date: "2026-04-18",  type: "night",     guest: "Aquino Group"     },
    { date: "2026-04-25",  type: "day",       guest: "Magno Birthday"   },
];

// Slot metadata
const SLOTS = {
    day:       { label: "Day Swimming",   time: "6:00 AM – 5:00 PM",  badgeClass: "badge-day",       pipClass: "pip-day"       },
    night:     { label: "Night Swimming", time: "6:00 PM – 5:00 AM",  badgeClass: "badge-night",     pipClass: "pip-night"     },
    overnight: { label: "Overnight",      time: "8:00 AM – 8:00 AM",  badgeClass: "badge-overnight", pipClass: "pip-overnight" },
};

// ── DOM REFS ──────────────────────────────────────────────
const datesContainer   = document.getElementById("dates");
const monthYearEl      = document.getElementById("month-year");
const prevBtn          = document.getElementById("prev");
const nextBtn          = document.getElementById("next");
const slotsPanel       = document.getElementById("slotsPanel");
const selectedDateLabel= document.getElementById("selectedDateLabel");
const slotsBody        = document.getElementById("slotsBody");
const tooltip          = document.getElementById("calTooltip");

let currentDate  = new Date();
let selectedDate = null;

// ── HAMBURGER ─────────────────────────────────────────────
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

// ── SCROLL REVEAL ─────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── HELPERS ───────────────────────────────────────────────
function formatDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getBookingsForDate(dateKey) {
    return bookings.filter(b => b.date === dateKey);
}

function isToday(year, month, day) {
    const t = new Date();
    return day === t.getDate() && month === t.getMonth() && year === t.getFullYear();
}

function isPast(year, month, day) {
    const t  = new Date(); t.setHours(0,0,0,0);
    const d  = new Date(year, month, day);
    return d < t;
}

function friendlyDate(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-PH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

// ── RENDER CALENDAR ───────────────────────────────────────
function renderCalendar(date) {
    datesContainer.innerHTML = "";

    const year  = date.getFullYear();
    const month = date.getMonth();

    monthYearEl.textContent =
        date.toLocaleString("default", { month: "long" }) + " " + year;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    // Empty cells before 1st
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.classList.add("cal-date", "empty");
        datesContainer.appendChild(empty);
    }

    // Date cells
    for (let day = 1; day <= lastDate; day++) {
        const dateKey   = formatDateKey(year, month, day);
        const dayBookings = getBookingsForDate(dateKey);
        const past      = isPast(year, month, day);
        const todayFlag = isToday(year, month, day);

        const cell = document.createElement("div");
        cell.classList.add("cal-date");
        cell.textContent = day;
        cell.dataset.dateKey = dateKey;

        if (past && !todayFlag) {
            cell.classList.add("past");
        } else if (dayBookings.length === 0) {
            cell.classList.add("available");
        } else {
            const types = [...new Set(dayBookings.map(b => b.type))];
            if (types.length === 1) {
                cell.classList.add(`${types[0]}-booked`);
            } else {
                cell.classList.add("multi-booked");
                // pip dots
                const pips = document.createElement("div");
                pips.classList.add("slot-pips");
                types.forEach(t => {
                    const pip = document.createElement("span");
                    pip.classList.add("slot-pip", SLOTS[t].pipClass);
                    pips.appendChild(pip);
                });
                cell.appendChild(pips);
            }
        }

        if (todayFlag)  cell.classList.add("today");
        if (selectedDate === dateKey) cell.classList.add("selected");

        // Tooltip on hover
        cell.addEventListener("mouseenter", (e) => showTooltip(e, dateKey, dayBookings, past));
        cell.addEventListener("mousemove",  (e) => moveTooltip(e));
        cell.addEventListener("mouseleave", ()  => hideTooltip());

        // Click → show slots panel
        if (!past || todayFlag) {
            cell.addEventListener("click", () => {
                selectedDate = dateKey;
                // re-render to update selected state
                renderCalendar(currentDate);
                showSlots(dateKey, dayBookings);
            });
        }

        datesContainer.appendChild(cell);
    }
}

// ── TOOLTIP ───────────────────────────────────────────────
function showTooltip(e, dateKey, dayBookings, past) {
    if (past) {
        tooltip.textContent = "Past date — not available";
    } else if (dayBookings.length === 0) {
        tooltip.textContent = "✅ Available — click to see slots";
    } else {
        const lines = dayBookings.map(b => `• ${SLOTS[b.type].label}`);
        tooltip.innerHTML = `<strong>Booked:</strong><br>${lines.join('<br>')}`;
    }
    tooltip.classList.add("visible");
    moveTooltip(e);
}

function moveTooltip(e) {
    const x = e.clientX + 14;
    const y = e.clientY - 10;
    tooltip.style.left = x + "px";
    tooltip.style.top  = y + "px";
}

function hideTooltip() {
    tooltip.classList.remove("visible");
}

// ── SLOTS PANEL ───────────────────────────────────────────
function showSlots(dateKey, dayBookings) {
    selectedDateLabel.textContent = friendlyDate(dateKey);

    const bookedTypes = new Set(dayBookings.map(b => b.type));
    const allSlotTypes = ["day", "night", "overnight"];

    slotsBody.innerHTML = "";

    allSlotTypes.forEach(type => {
        const isBooked = bookedTypes.has(type);
        const booking  = dayBookings.find(b => b.type === type);
        const meta     = SLOTS[type];

        const row = document.createElement("div");
        row.classList.add("slot-row");

        const badge = document.createElement("div");
        badge.classList.add("slot-badge", isBooked ? meta.badgeClass : "badge-available");

        const info = document.createElement("div");
        info.classList.add("slot-info");

        const typeEl = document.createElement("div");
        typeEl.classList.add("slot-type");
        typeEl.textContent = meta.label;

        const timeEl = document.createElement("div");
        timeEl.classList.add("slot-time");
        timeEl.textContent = meta.time;

        info.appendChild(typeEl);
        info.appendChild(timeEl);

        if (isBooked && booking.guest) {
            const guestEl = document.createElement("div");
            guestEl.classList.add("slot-time");
            guestEl.style.marginTop = "2px";
            guestEl.textContent = `Guest: ${booking.guest}`;
            info.appendChild(guestEl);
        }

        const status = document.createElement("div");
        status.classList.add("slot-status", isBooked ? "status-booked" : "status-available");
        status.textContent = isBooked ? "Booked" : "Open";

        row.appendChild(badge);
        row.appendChild(info);
        row.appendChild(status);
        slotsBody.appendChild(row);
    });

    // Scroll panel into view on mobile
    slotsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── NAVIGATION ────────────────────────────────────────────
prevBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate);
});

nextBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate);
});

// ── INIT ─────────────────────────────────────────────────
renderCalendar(currentDate);
