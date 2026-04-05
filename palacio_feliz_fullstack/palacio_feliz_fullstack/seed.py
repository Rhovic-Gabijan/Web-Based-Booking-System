"""
seed.py  –  Initialize the database and create default admin + sample packages.

Usage:
    python seed.py
"""
from werkzeug.security import generate_password_hash
from run import app, db
from app.models import AdminUser, Package


def seed():
    with app.app_context():
        # Create all tables
        db.create_all()
        print("✅  Tables created.")

        # ── Default admin ────────────────────────────────────────────────────
        if not AdminUser.query.filter_by(username="admin").first():
            admin = AdminUser(
                username  = "admin",
                email     = "admin@palaciofeliz.com",
                password  = generate_password_hash("Admin@1234"),
                full_name = "Resort Manager",
                role      = "admin",
            )
            db.session.add(admin)
            print("✅  Default admin created  →  username: admin  /  password: Admin@1234")
        else:
            print("ℹ️   Admin already exists, skipping.")

        # ── Default packages (matching the HTML rate cards) ──────────────────
        default_packages = [
            {
                "name":           "Day Tour",
                "description":    "Enjoy the resort from 6:00 AM to 5:00 PM. "
                                  "Includes unlimited pool access for up to 20 guests.",
                "icon":           "🌤️",
                "base_price":     10_000,
                "weekend_price":  15_000,
                "booking_type":   "dayswimming",
                "included_pax":   20,
                "extra_pax_price":0,
                "duration_hours": 11,
            },
            {
                "name":           "Night Tour",
                "description":    "Experience the resort from 6:00 PM to 5:00 AM. "
                                  "Includes unlimited pool access for up to 20 guests.",
                "icon":           "🌙",
                "base_price":     11_000,
                "weekend_price":  16_000,
                "booking_type":   "nightswimming",
                "included_pax":   20,
                "extra_pax_price":0,
                "duration_hours": 11,
            },
            {
                "name":           "Overnight",
                "description":    "Stay overnight from 8:00 AM to 8:00 AM next day. "
                                  "Includes unlimited pool access for up to 20 guests.",
                "icon":           "⭐",
                "base_price":     20_000,
                "weekend_price":  30_000,
                "booking_type":   "overnight",
                "included_pax":   20,
                "extra_pax_price":0,
                "duration_hours": 24,
            },
        ]

        added = 0
        for pd in default_packages:
            if not Package.query.filter_by(name=pd["name"]).first():
                db.session.add(Package(**pd))
                added += 1

        if added:
            print(f"✅  {added} default package(s) seeded.")
        else:
            print("ℹ️   Packages already exist, skipping.")

        db.session.commit()
        print("\n🎉  Database ready.")


if __name__ == "__main__":
    seed()
