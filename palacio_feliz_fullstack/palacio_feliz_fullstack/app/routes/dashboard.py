"""
app/routes/dashboard.py  –  Admin dashboard stats & charts
"""
from datetime import date, timedelta
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func, extract

from app import db
from app.models import Booking, Guest, Review, Payment
from app.utils  import success

dashboard_bp = Blueprint("dashboard", __name__)


# ── GET /api/dashboard/stats  ───────────────────────────────────────── ADMIN
@dashboard_bp.get("/stats")
@jwt_required()
def stats():
    total     = Booking.query.count()
    pending   = Booking.query.filter_by(status="pending").count()
    approved  = Booking.query.filter_by(status="approved").count()
    completed = Booking.query.filter_by(status="completed").count()
    cancelled = Booking.query.filter_by(status="cancelled").count()

    # Total revenue = sum of all payments
    revenue_row = db.session.query(func.sum(Payment.amount)).scalar()
    total_revenue = float(revenue_row or 0)

    # New bookings this month
    today    = date.today()
    month_start = today.replace(day=1)
    new_this_month = Booking.query.filter(
        Booking.created_at >= month_start
    ).count()

    # Total guests
    total_guests = Guest.query.count()

    # Pending reviews (visible=True count for badge)
    total_reviews = Review.query.filter_by(is_visible=True).count()

    return success({
        "total_bookings":   total,
        "pending":          pending,
        "approved":         approved,
        "completed":        completed,
        "cancelled":        cancelled,
        "total_revenue":    total_revenue,
        "new_this_month":   new_this_month,
        "total_guests":     total_guests,
        "total_reviews":    total_reviews,
    })


# ── GET /api/dashboard/monthly-revenue  ─────────────────────────────── ADMIN
@dashboard_bp.get("/monthly-revenue")
@jwt_required()
def monthly_revenue():
    """
    Returns revenue per month for the last 12 months.
    Used by the bar/line chart in the admin dashboard.
    """
    today      = date.today()
    year_ago   = today - timedelta(days=365)

    rows = (
        db.session.query(
            extract("year",  Payment.paid_at).label("yr"),
            extract("month", Payment.paid_at).label("mo"),
            func.sum(Payment.amount).label("total"),
        )
        .filter(Payment.paid_at >= year_ago)
        .group_by("yr", "mo")
        .order_by("yr", "mo")
        .all()
    )

    import calendar
    result = [
        {
            "label":   f"{calendar.month_abbr[int(r.mo)]} {int(r.yr)}",
            "year":    int(r.yr),
            "month":   int(r.mo),
            "revenue": float(r.total),
        }
        for r in rows
    ]
    return success(result)


# ── GET /api/dashboard/booking-stats  ───────────────────────────────── ADMIN
@dashboard_bp.get("/booking-stats")
@jwt_required()
def booking_stats():
    """Monthly booking counts (total, approved, cancelled) for the last 12 months."""
    today    = date.today()
    year_ago = today - timedelta(days=365)

    rows = (
        db.session.query(
            extract("year",  Booking.created_at).label("yr"),
            extract("month", Booking.created_at).label("mo"),
            Booking.status,
            func.count(Booking.id).label("cnt"),
        )
        .filter(Booking.created_at >= year_ago)
        .group_by("yr", "mo", Booking.status)
        .order_by("yr", "mo")
        .all()
    )

    # Organise into {label: {approved: N, cancelled: N, ...}}
    import calendar as cal
    buckets: dict = {}
    for r in rows:
        label = f"{cal.month_abbr[int(r.mo)]} {int(r.yr)}"
        buckets.setdefault(label, {"label": label, "total": 0,
                                    "approved": 0, "cancelled": 0,
                                    "pending": 0, "completed": 0})
        buckets[label][r.status] = int(r.cnt)
        buckets[label]["total"] += int(r.cnt)

    return success(list(buckets.values()))


# ── GET /api/dashboard/monthly-summary  ─────────────────────────────── ADMIN
@dashboard_bp.get("/monthly-summary")
@jwt_required()
def monthly_summary():
    """
    Table data for the Reports section:
    month, total_bookings, revenue, avg_guest_count
    """
    today    = date.today()
    year_ago = today - timedelta(days=365)

    booking_rows = (
        db.session.query(
            extract("year",  Booking.created_at).label("yr"),
            extract("month", Booking.created_at).label("mo"),
            func.count(Booking.id).label("bookings"),
            func.avg(Booking.adults + Booking.youth).label("avg_pax"),
        )
        .filter(Booking.created_at >= year_ago)
        .group_by("yr", "mo")
        .order_by("yr", "mo")
        .all()
    )

    revenue_rows = (
        db.session.query(
            extract("year",  Payment.paid_at).label("yr"),
            extract("month", Payment.paid_at).label("mo"),
            func.sum(Payment.amount).label("rev"),
        )
        .filter(Payment.paid_at >= year_ago)
        .group_by("yr", "mo")
        .all()
    )

    rev_map = {(int(r.yr), int(r.mo)): float(r.rev) for r in revenue_rows}

    import calendar as cal
    result = []
    for r in booking_rows:
        yr, mo = int(r.yr), int(r.mo)
        result.append({
            "month":          f"{cal.month_name[mo]} {yr}",
            "total_bookings": int(r.bookings),
            "revenue":        rev_map.get((yr, mo), 0.0),
            "avg_pax":        round(float(r.avg_pax or 0), 1),
        })

    return success(result)


# ── GET /api/dashboard/recent-bookings  ─────────────────────────────── ADMIN
@dashboard_bp.get("/recent-bookings")
@jwt_required()
def recent_bookings():
    limit = int(request.args.get("limit", 10))
    rows  = (
        Booking.query
        .order_by(Booking.created_at.desc())
        .limit(limit)
        .all()
    )
    return success([b.to_dict() for b in rows])
