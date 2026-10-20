"""Add profile trigger, RLS, and storage policies.

Revision ID: 002_security_policies
Revises: 001_initial_schema
"""

from alembic import op


revision = "002_security_policies"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create or replace function public.is_admin()
        returns boolean
        language sql
        stable
        security definer
        set search_path = public
        as $$
            select exists (
                select 1
                from public.profiles
                where id = auth.uid() and role = 'admin'::user_role
            )
        $$;

        create or replace function public.handle_new_user()
        returns trigger
        language plpgsql
        security definer
        set search_path = public
        as $$
        begin
            insert into public.profiles (id, full_name)
            values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
            return new;
        end;
        $$;

        drop trigger if exists on_auth_user_created on auth.users;
        create trigger on_auth_user_created
            after insert on auth.users
            for each row execute procedure public.handle_new_user();

        alter table public.profiles enable row level security;
        alter table public.reports enable row level security;

        drop policy if exists profiles_select_self_or_admin on public.profiles;
        create policy profiles_select_self_or_admin
            on public.profiles for select
            to authenticated
            using (id = auth.uid() or public.is_admin());

        drop policy if exists reports_select_owner_or_admin on public.reports;
        create policy reports_select_owner_or_admin
            on public.reports for select
            to authenticated
            using (reporter_id = auth.uid() or public.is_admin());

        drop policy if exists reports_insert_owner on public.reports;
        create policy reports_insert_owner
            on public.reports for insert
            to authenticated
            with check (reporter_id = auth.uid());

        drop policy if exists reports_update_admin on public.reports;
        create policy reports_update_admin
            on public.reports for update
            to authenticated
            using (public.is_admin())
            with check (public.is_admin());

        drop policy if exists report_photos_select_owner_or_admin on storage.objects;
        create policy report_photos_select_owner_or_admin
            on storage.objects for select
            to authenticated
            using (
                bucket_id = 'report-photos'
                and (storage.foldername(name))[1] = (auth.uid())::text
                or bucket_id = 'report-photos' and public.is_admin()
            );

        drop policy if exists report_photos_insert_owner on storage.objects;
        create policy report_photos_insert_owner
            on storage.objects for insert
            to authenticated
            with check (
                bucket_id = 'report-photos'
                and (storage.foldername(name))[1] = (auth.uid())::text
            );

        drop policy if exists report_photos_update_owner_or_admin on storage.objects;
        create policy report_photos_update_owner_or_admin
            on storage.objects for update
            to authenticated
            using (
                bucket_id = 'report-photos'
                and ((storage.foldername(name))[1] = (auth.uid())::text or public.is_admin())
            )
            with check (
                bucket_id = 'report-photos'
                and ((storage.foldername(name))[1] = (auth.uid())::text or public.is_admin())
            );

        drop policy if exists report_photos_delete_owner_or_admin on storage.objects;
        create policy report_photos_delete_owner_or_admin
            on storage.objects for delete
            to authenticated
            using (
                bucket_id = 'report-photos'
                and ((storage.foldername(name))[1] = (auth.uid())::text or public.is_admin())
            );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop policy if exists report_photos_delete_owner_or_admin on storage.objects;
        drop policy if exists report_photos_update_owner_or_admin on storage.objects;
        drop policy if exists report_photos_insert_owner on storage.objects;
        drop policy if exists report_photos_select_owner_or_admin on storage.objects;
        drop policy if exists reports_update_admin on public.reports;
        drop policy if exists reports_insert_owner on public.reports;
        drop policy if exists reports_select_owner_or_admin on public.reports;
        drop policy if exists profiles_select_self_or_admin on public.profiles;
        drop trigger if exists on_auth_user_created on auth.users;
        drop function if exists public.handle_new_user();
        drop function if exists public.is_admin();
        """
    )
