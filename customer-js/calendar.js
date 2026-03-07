const datesContainer = document.getElementById("dates");
const monthYear = document.getElementById("month-year");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");

let currentDate = new Date();

// Example booked dates (YYYY-MM-DD format)
const bookedDates = [
    "2026-03-05",
    "2026-03-10",
    "2026-03-15",
    "2026-03-20"
];

function renderCalendar(date) {
    datesContainer.innerHTML = "";

    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    monthYear.textContent = 
        date.toLocaleString("default", { month: "long" }) + 
        " " + year;

    for (let i = 0; i < firstDay; i++) {
        datesContainer.innerHTML += "<div></div>";
    }

    for (let i = 1; i <= lastDate; i++) {
        const fullDate = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayDiv = document.createElement("div");
        dayDiv.textContent = i;

        if (bookedDates.includes(fullDate)) {
            dayDiv.classList.add("booked");
        } else {
            dayDiv.classList.add("available");
        }

        const today = new Date();
        if (
            i === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {
            dayDiv.classList.add("today");
        }

        datesContainer.appendChild(dayDiv);
    }
}

prevBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate);
};

nextBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate);
};

renderCalendar(currentDate);