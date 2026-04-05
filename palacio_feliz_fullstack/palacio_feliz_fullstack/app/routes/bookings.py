"""
app/routes/bookings.py  –  Customer booking submission + admin approval
"""
import re
from datetime import date, datetime
from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required

from app import db
from app.models import Booking, Guest, Package, Payment
from app.utils  import (
    success, error,
    save_upload, generate_ref_no,
    calculate_price, get_checkout_date,
    BOOKING_TIMES,
)

bookings_bp = Blueprint("bookings", __name__)

VALID_TYPES = ("dayswimming", "nightswimming", "overnight")


# ════════════════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════════════════

def _check_availability(booking_type: str, check_in: date, exclude_id=None):
    """
    Availability rules:
    ─────────────────────────────────────────────────────────────────────────
    • overnight booking  → the date must have NO other approved bookings at all
    • dayswimming        → the date must have NO other approved dayswimming
                           AND no overnight on the same date
    • nightswimming      → the date must have NO other approved nightswimming
                           AND no overnight on the same date

    Returns (is_available: bool, reason: str)
    """
    q = Booking.query.filter(
        Booking.check_in_date == check_in,
        Booking.status == "approved",
    )
    if exclude_id:
        q = q.filter(Booking.id != exclude_id)

    existing = q.all()

    if not existing:
        return True, ""

    existing_types = {b.booking_type for b in existing}

    if booking_type == "overnight":
        return False, "The selected date already has an approved booking and cannot accommodate an Overnight reservation."

    # Any overnight on same date blocks everything else
    if "overnight" in existing_types:
        return False, "The selected date already has an Overnight booking approved."

    # Same type conflict
    if booking_type in existing_types:
        label = "Day Swimming" if booking_type == "dayswimming" else "Night Swimming"
        return False, f"The selected date already has an approved {label} booking."

    return True, ""


def _parse_date(val: str):
    try:
        return datetime.strptime(val, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


# ════════════════════════════════════════════════════════════════════════════
# PUBLIC  –  Customer submits a new booking
# ════════════════════════════════════════════════════════════════════════════

@bookings_bp.post("/")
def create_booking():
    """
    Accepts multipart/form-data (because of file uploads).
    Fields expected:
      - first_name, last_name, email, phone
      - booking_type  (dayswimming | nightswimming | overnight)
      - check_in_date (YYYY-MM-DD)
      - adults, youth
      - package_id    (optional)
      - payment_method (gcash | paymaya | cash)
      - downpayment   (must be ≥ 2000)
      - special_request (optional)
      - payment_ref, payment_number  (for gcash/paymaya)
      Files:
        valid_id
        payment_screenshot  (required for gcash/paymaya)
    """
    f = request.form

    # ── 1. Required field checks ──────────────────────────────────────────
    required = ["first_name", "last_name", "email", "phone",
                "booking_type", "check_in_date", "adults", "payment_method", "downpayment"]
    for field in required:
        if not f.get(field, "").strip():
            return error(f"Field '{field}' is required.", 400)

    booking_type = f["booking_type"].strip().lower()
    if booking_type not in VALID_TYPES:
        return error("booking_type must be: dayswimming, nightswimming, or overnight.", 400)

    # ── 2. Parse dates ────────────────────────────────────────────────────
    check_in = _parse_date(f.get("check_in_date", ""))
    if not check_in:
        return error("Invalid check_in_date. Use YYYY-MM-DD.", 400)
    if check_in < date.today():
        return error("Check-in date cannot be in the past.", 400)

    check_out = get_checkout_date(booking_type, check_in)

    # ── 3. Pax validation (total ≤ 50) ───────────────────────────────────
    try:
        adults = int(f.get("adults", 0))
        youth  = int(f.get("youth",  0))
    except ValueError:
        return error("Adults and youth must be numbers.", 400)

    if adults < 1:
        return error("At least 1 adult is required.", 400)

    max_pax = current_app.config["MAX_PAX"]
    if adults + youth > max_pax:
        return error(f"Total guests cannot exceed {max_pax} pax.", 400)

    # ── 4. Availability check ─────────────────────────────────────────────
    available, reason = _check_availability(booking_type, check_in)
    if not available:
        return error(reason, 409)

    # ── 5. Package (optional) ─────────────────────────────────────────────
    package = None
    if f.get("package_id"):
        package = Package.query.filter_by(
            id=f["package_id"], is_active=True
        ).first()
        if not package:
            return error("Selected package not found or inactive.", 404)

    # ── 6. Pricing ────────────────────────────────────────────────────────
    total_price = calculate_price(booking_type, check_in, adults, youth, package)

    try:
        downpayment = float(f.get("downpayment", 0))
    except ValueError:
        return error("downpayment must be a number.", 400)

    min_dp = current_app.config["DOWNPAYMENT_REQUIRED"]
    if downpayment < min_dp:
        return error(f"Minimum downpayment is ₱{min_dp:,.2f}.", 400)
    if downpayment > total_price:
        downpayment = total_price

    balance = total_price - downpayment

    # ── 7. Payment method validation ──────────────────────────────────────
    payment_method = f["payment_method"].strip().lower()
    if payment_method not in ("gcash", "paymaya", "cash"):
        return error("payment_method must be: gcash, paymaya, or cash.", 400)

    payment_screenshot_url = None
    if payment_method in ("gcash", "paymaya"):
        ss_file = request.files.get("payment_screenshot")
        payment_screenshot_url = save_upload(
            ss_file, "payments",
            current_app.config["ALLOWED_IMAGE_EXTENSIONS"]
        )
        if not payment_screenshot_url:
            return error("Transaction screenshot is required for GCash/PayMaya payments.", 400)

    # ── 8. Save Valid ID ──────────────────────────────────────────────────
    valid_id_url = save_upload(
        request.files.get("valid_id"),
        "valid_ids",
        current_app.config["ALLOWED_DOC_EXTENSIONS"]
    )

    # ── 9. Guest record (reuse if same email exists) ──────────────────────
    guest = Guest.query.filter_by(email=f["email"].strip().lower()).first()
    if not guest:
        guest = Guest(
            first_name=f["first_name"].strip(),
            last_name =f["last_name"].strip(),
            email     =f["email"].strip().lower(),
            phone     =f["phone"].strip(),
            valid_id_url=valid_id_url,
        )
        db.session.add(guest)
        db.session.flush()
    else:
        # Update contact info in case it changed
        guest.first_name = f["first_name"].strip()
        guest.last_name  = f["last_name"].strip()
        guest.phone      = f["phone"].strip()
        if valid_id_url:
            guest.valid_id_url = valid_id_url

    # ── 10. Create booking ────────────────────────────────────────────────
    times = BOOKING_TIMES.get(booking_type, {})
    booking = Booking(
        reference_no   = generate_ref_no(),
        guest          = guest,
        package_id     = package.id if package else None,
        booking_type   = booking_type,
        check_in_date  = check_in,
        check_out_date = check_out,
        check_in_time  = times.get("check_in"),
        check_out_time = times.get("check_out"),
        adults         = adults,
        youth          = youth,
        total_price    = total_price,
        downpayment    = downpayment,
        balance        = balance,
        payment_method = payment_method,
        payment_status = "paid" if balance == 0 else "partial",
        payment_ref    = f.get("payment_ref", "").strip() or None,
        payment_number = f.get("payment_number", "").strip() or None,
        payment_screenshot_url = payment_screenshot_url,
        special_request= f.get("special_request", "").strip() or None,
        status         = "pending",
    )
    db.session.add(booking)

    # Initial payment record
    payment_rec = Payment(
        booking    = booking,
        amount     = downpayment,
        method     = payment_method,
        reference_no=f.get("payment_ref") or None,
        screenshot_url=payment_screenshot_url,
        note       = "Downpayment upon booking",
    )
    db.session.add(payment_rec)

    db.session.commit()

    return success(
        booking.to_dict(),
        "Booking submitted! We'll contact you shortly to confirm.",
        201
    )


# ════════════════════════════════════════════════════════════════════════════
# PUBLIC  –  Check availability for a date + type
# ════════════════════════════════════════════════════════════════════════════

@bookings_bp.get("/check-availability")
def check_availability():
    """
    Query: ?booking_type=dayswimming&check_in_date=2026-04-10
    """
    btype     = request.args.get("booking_type", "").lower()
    date_str  = request.args.get("check_in_date", "")

    if btype not in VALID_TYPES:
        return error("Invalid booking_type.", 400)

    check_in = _parse_date(date_str)
    if not check_in:
        return error("Invalid date.", 400)

    available, reason = _check_availability(btype, check_in)
    return success({"available": available, "reason": reason})


# ════════════════════════════════════════════════════════════════════════════
# PUBLIC  –  Calculate price preview
# ════════════════════════════════════════════════════════════════════════════

@bookings_bp.get("/price")
def price_preview():
    """
    Query: ?booking_type=dayswimming&check_in_date=2026-04-10&adults=10&youth=5&package_id=2
    """
    btype    = request.args.get("booking_type", "").lower()
    date_str = request.args.get("check_in_date", "")
    adults   = int(request.args.get("adults",  1))
    youth    = int(request.args.get("youth",   0))
    pkg_id   = request.args.get("package_id")

    if btype not in VALID_TYPES:
        return error("Invalid booking_type.", 400)

    check_in = _parse_date(date_str)
    if not check_in:
        return error("Invalid date.", 400)

    package = None
    if pkg_id:
        package = Package.query.filter_by(id=pkg_id, is_active=True).first()

    price     = calculate_price(btype, check_in, adults, youth, package)
    check_out = get_checkout_date(btype, check_in)
    times     = BOOKING_TIMES.get(btype, {})

    return success({
        "total_price":     price,
        "check_out_date":  check_out.isoformat(),
        "check_in_time":   times.get("check_in"),
        "check_out_time":  times.get("check_out"),
        "downpayment_min": current_app.config["DOWNPAYMENT_REQUIRED"],
    })


# ════════════════════════════════════════════════════════════════════════════
# ADMIN  –  List all bookings
# ════════════════════════════════════════════════════════════════════════════

@bookings_bp.get("/")
@jwt_required()
def list_bookings():
    status     = request.args.get("status")
    search     = request.args.get("q", "")
    date_filter= request.args.get("date")
    page       = int(request.args.get("page", 1))
    per_page   = int(request.args.get("per_page", 20))

    q = Booking.query.join(Guest)

    if status:
        q = q.filter(Booking.status == status)
    if date_filter:
        d = _parse_date(date_filter)
        if d:
            q = q.filter(Booking.check_in_date == d)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Guest.first_name.ilike(like)) |
            (Guest.last_name.ilike(like))  |
            (Guest.email.ilike(like))       |
            (Booking.reference_no.ilike(like))
        )

    paginated = q.order_by(Booking.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return success({
        "items":      [b.to_dict() for b in paginated.items],
        "total":      paginated.total,
        "page":       paginated.page,
        "pages":      paginated.pages,
        "per_page":   per_page,
    })


# ════════════════════════════════════════════════════════════════════════════
# ADMIN  –  Get single booking
# ════════════════════════════════════════════════════════════════════════════

@bookings_bp.get("/<int:booking_id>")
@jwt_required()
def get_booking(booking_id):
    b = Booking.query.get_or_404(booking_id)
    return success(b.to_dict())


# ════════════════════════════════════════════════════════════════════════════
# ADMIN  –  Approve / Reject / Complete / Cancel
# ════════════════════════════════════════════════════════════════════════════

@bookings_bp.patch("/<int:booking_id>/status")
@jwt_required()
def update_status(booking_id):
    """
    Body: { "status": "approved" | "rejected" | "completed" | "cancelled" }
    """
    b    = Booking.query.get_or_404(booking_id)
    data = request.get_json(silent=True) or {}
    new_status = data.get("status", "").lower()

    allowed = ("approved", "rejected", "completed", "cancelled", "pending")
    if new_status not in allowed:
        return error(f"status must be one of: {', '.join(allowed)}", 400)

    # If approving, re-run availability check
    if new_status == "approved" and b.status != "approved":
        available, reason = _check_availability(b.booking_type, b.check_in_date, exclude_id=b.id)
        if not available:
            return error(f"Cannot approve: {reason}", 409)

    b.status = new_status
    db.session.commit()
    return success(b.to_dict(), f"Booking {new_status}.")


# ════════════════════════════════════════════════════════════════════════════
# ADMIN  –  Delete booking
# ════════════════════════════════════════════════════════════════════════════

@bookings_bp.delete("/<int:booking_id>")
@jwt_required()
def delete_booking(booking_id):
    b = Booking.query.get_or_404(booking_id)
    db.session.delete(b)
    db.session.commit()
    return success(message="Booking deleted.")


# ════════════════════════════════════════════════════════════════════════════
# ADMIN  –  Pending count (for notification badge)
# ════════════════════════════════════════════════════════════════════════════

@bookings_bp.get("/pending-count")
@jwt_required()
def pending_count():
    count = Booking.query.filter_by(status="pending").count()
    return success({"count": count})
