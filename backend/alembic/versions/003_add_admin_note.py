"""Store admin notes on reports.

Revision ID: 003_add_admin_note
Revises: 002_security_policies
"""

from alembic import op
import sqlalchemy as sa


revision = "003_add_admin_note"
down_revision = "002_security_policies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("admin_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "admin_note")
