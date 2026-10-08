-- ==============================================================================
-- BASIC SCHOOL VOTING SYSTEM — DATABASE SCHEMA & REALTIME SETUP
-- ==============================================================================
-- Strictly anonymous voting: No student names, IDs, or IPs are stored.
-- Strictly 2 admins limit enforced via database constraints and triggers.
-- High-speed B-Tree indexing and atomic PostgreSQL RPC for instant vote tallies.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. POSITIONS TABLE
CREATE TABLE IF NOT EXISTS public.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 1,
    max_choices INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    class_grade TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    manifesto TEXT DEFAULT '',
    vote_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ELECTION STATE TABLE (Always 1 row with id = 1)
CREATE TABLE IF NOT EXISTS public.election_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'paused', 'ended')),
    school_name TEXT NOT NULL DEFAULT 'St. Peter Basic School',
    election_title TEXT NOT NULL DEFAULT 'Prefectorial Elections 2026/2027',
    total_ballots_cast INTEGER NOT NULL DEFAULT 0,
    kiosk_pin TEXT NOT NULL DEFAULT '1234',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. SYSTEM ADMINS TABLE (Strictly capped at max 2 admins)
CREATE TABLE IF NOT EXISTS public.system_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    slot_number INTEGER NOT NULL UNIQUE CHECK (slot_number IN (1, 2)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ANONYMOUS VOTES AUDIT (Verifiable anonymous ledger)
CREATE TABLE IF NOT EXISTS public.votes_audit (
    id BIGSERIAL PRIMARY KEY,
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    cast_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 7. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_candidates_position ON public.candidates(position_id);
CREATE INDEX IF NOT EXISTS idx_candidates_vote_count ON public.candidates(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_positions_order ON public.positions(display_order ASC);
CREATE INDEX IF NOT EXISTS idx_votes_audit_candidate ON public.votes_audit(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_audit_position ON public.votes_audit(position_id);

-- ==============================================================================
-- 8. STRICT 2-ADMIN LIMIT TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_admin_slot_limit()
RETURNS TRIGGER AS $$
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM public.system_admins;
    IF admin_count >= 2 AND TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'System allows a maximum of 2 system administrators only.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_two_admins ON public.system_admins;
CREATE TRIGGER trg_enforce_two_admins
    BEFORE INSERT ON public.system_admins
    FOR EACH ROW
    EXECUTE FUNCTION public.check_admin_slot_limit();

-- ==============================================================================
-- 9. ATOMIC BALLOT CASTING RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.cast_ballot(candidate_ids UUID[])
RETURNS JSONB AS $$
DECLARE
    c_id UUID;
    pos_id UUID;
    cur_status TEXT;
BEGIN
    -- Verify election is active
    SELECT status INTO cur_status FROM public.election_state WHERE id = 1;
    IF cur_status IS NULL OR cur_status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Voting is currently closed or paused.');
    END IF;

    -- Increment candidate vote counts and write anonymous audit entries
    FOREACH c_id IN ARRAY candidate_ids LOOP
        SELECT position_id INTO pos_id FROM public.candidates WHERE id = c_id;
        
        IF pos_id IS NOT NULL THEN
            UPDATE public.candidates 
            SET vote_count = vote_count + 1 
            WHERE id = c_id;

            INSERT INTO public.votes_audit (position_id, candidate_id)
            VALUES (pos_id, c_id);
        END IF;
    END LOOP;

    -- Increment overall ballot count
    UPDATE public.election_state 
    SET total_ballots_cast = total_ballots_cast + 1,
        updated_at = now()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 10. RESET ELECTION VOTES RPC (Admin operation)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.reset_election_votes()
RETURNS JSONB AS $$
BEGIN
    UPDATE public.candidates SET vote_count = 0;
    DELETE FROM public.votes_audit;
    UPDATE public.election_state 
    SET total_ballots_cast = 0,
        status = 'setup',
        updated_at = now()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes_audit ENABLE ROW LEVEL SECURITY;

-- Public can read positions, candidates, and election state
CREATE POLICY "Public can view positions" ON public.positions FOR SELECT USING (true);
CREATE POLICY "Public can view candidates" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "Public can view election state" ON public.election_state FOR SELECT USING (true);

-- Admin write policies (or unrestricted for RPC service role)
CREATE POLICY "Anyone can execute ballot rpc" ON public.votes_audit FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins full access positions" ON public.positions FOR ALL USING (true);
CREATE POLICY "Admins full access candidates" ON public.candidates FOR ALL USING (true);
CREATE POLICY "Admins full access election_state" ON public.election_state FOR ALL USING (true);
CREATE POLICY "Admins full access system_admins" ON public.system_admins FOR ALL USING (true);

-- ==============================================================================
-- 12. SUPABASE REALTIME REPLICATION SETUP
-- ==============================================================================
-- Enable Realtime publication for candidates and election state
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'candidates'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'election_state'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.election_state;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'positions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.positions;
    END IF;
END $$;

-- ==============================================================================
-- 13. SEED DEFAULT ELECTION STATE & SAMPLE DATA
-- ==============================================================================
INSERT INTO public.election_state (id, status, school_name, election_title, kiosk_pin)
VALUES (1, 'active', 'St. Peter Basic School', 'Prefectorial Elections 2026/2027', '1234')
ON CONFLICT (id) DO NOTHING;

-- Seed default Positions
INSERT INTO public.positions (id, title, description, display_order)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Senior Boy Prefect', 'Head boy of the basic school', 1),
    ('22222222-2222-2222-2222-222222222222', 'Senior Girl Prefect', 'Head girl of the basic school', 2),
    ('33333333-3333-3333-3333-333333333333', 'Sports Prefect', 'Leader for athletics, games and PE', 3),
    ('44444444-4444-4444-4444-444444444444', 'Sanitation / Compound Prefect', 'Supervisor for school health, hygiene & compound cleanliness', 4)
ON CONFLICT (id) DO NOTHING;

-- Seed default Candidates
INSERT INTO public.candidates (id, position_id, full_name, class_grade, avatar_url, vote_count)
VALUES
    -- Senior Boy Prefect candidates
    ('c1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Emmanuel Darko', 'JHS 2 A', '', 14),
    ('c1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Samuel Osei Boateng', 'Basic 6', '', 18),
    ('c1111111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Kelvin Mensah', 'JHS 2 B', '', 11),

    -- Senior Girl Prefect candidates
    ('c2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Abigail Akuffo', 'JHS 2 B', '', 21),
    ('c2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Priscilla Serwaa', 'Basic 6', '', 17),

    -- Sports Prefect candidates
    ('c3333333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Prince Kwabena Adjei', 'JHS 2 A', '', 15),
    ('c3333333-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Michael Frimpong', 'Basic 6', '', 12),

    -- Sanitation Prefect candidates
    ('c4444444-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'Jessica Afia Appiah', 'JHS 1', '', 19),
    ('c4444444-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Ebenezer Quaye', 'Basic 6', '', 14)
ON CONFLICT (id) DO NOTHING;

-- Seed default System Admins (Max 2 slots)
INSERT INTO public.system_admins (id, email, full_name, slot_number)
VALUES
    ('a1111111-1111-1111-1111-111111111111', 'admin1@stpeter.edu', 'Headteacher / Electoral Commissioner 1', 1),
    ('a2222222-2222-2222-2222-222222222222', 'admin2@stpeter.edu', 'IT Lead / Electoral Commissioner 2', 2)
ON CONFLICT (slot_number) DO NOTHING;
