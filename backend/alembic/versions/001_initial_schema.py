"""Create profiles and reports tables.

Revision ID: 001_initial_schema
Revises:
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


user_role = postgresql.ENUM("reporter", "admin", name="user_role", create_type=False)
facility_category = postgresql.ENUM(
    "AC", "KURSI", "LAMPU", "PROYEKTOR", "LAINNYA", name="facility_category", create_type=False
)
report_status = postgresql.ENUM(
    "pending", "accepted", "rejected", "completed", name="report_status", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    facility_category.create(bind, checkfirst=True)
    report_status.create(bind, checkfirst=True)

    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=True),
        sa.Column("role", user_role, nullable=False, server_default="reporter"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("photo_path", sa.String(length=500), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("ai_category", facility_category, nullable=True),
        sa.Column("final_category", facility_category, nullable=False),
        sa.Column("status", report_status, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["reporter_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_reporter_id", "reports", ["reporter_id"])
    op.create_index("ix_reports_status", "reports", ["status"])


def downgrade() -> None:
    op.drop_index("ix_reports_status", table_name="reports")
    op.drop_index("ix_reports_reporter_id", table_name="reports")
    op.drop_table("reports")
    op.drop_table("profiles")
    bind = op.get_bind()
    report_status.drop(bind, checkfirst=True)
    facility_category.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
