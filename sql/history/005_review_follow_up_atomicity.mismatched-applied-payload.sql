-- HISTORICAL RECORD ONLY — do not apply to new environments.
-- Source: agent transcript apply_migration call (CareGap Test, 2026-10-28).
-- Migration history name on CareGap Test: 005_review_follow_up_atomicity (version 20261028085923).
-- This payload used non-existent columns (owner_user_id, task_type, review_id) vs live schema.
-- Live DB was corrected by 005b_review_follow_up_atomicity_correct; do not invent alternate bodies.
-- Recovered verbatim from tool arguments; not the intended sql/005_review_follow_up_atomicity.sql.
-- CareGap Test only until approved elsewhere.
-- Atomic review insert → needs_followup follow_up_tasks enqueue (same transaction).
-- App must stop dual-write inserts into follow_up_tasks on review create.

CREATE OR REPLACE FUNCTION public.reviews_enqueue_follow_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_existing uuid;
BEGIN
  IF NEW.decision IS DISTINCT FROM 'needs_followup' THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'reviews_enqueue_follow_up: unauthenticated';
  END IF;

  SELECT a.owner_user_id, a.status
    INTO v_owner, v_status
  FROM public.analyses a
  WHERE a.id = NEW.analysis_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reviews_enqueue_follow_up: analysis not found';
  END IF;

  IF v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'reviews_enqueue_follow_up: ownership mismatch';
  END IF;

  IF v_status IS DISTINCT FROM 'succeeded' THEN
    RAISE EXCEPTION 'reviews_enqueue_follow_up: analysis not succeeded';
  END IF;

  SELECT f.id
    INTO v_existing
  FROM public.follow_up_tasks f
  WHERE f.review_id = NEW.id
    AND f.status = 'open'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.follow_up_tasks (
    owner_user_id,
    case_id,
    analysis_id,
    review_id,
    task_type,
    status,
    note
  ) VALUES (
    v_uid,
    NEW.case_id,
    NEW.analysis_id,
    NEW.id,
    'next_consultation',
    'open',
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_enqueue_follow_up_trg ON public.reviews;

CREATE TRIGGER reviews_enqueue_follow_up_trg
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_enqueue_follow_up();

REVOKE ALL ON FUNCTION public.reviews_enqueue_follow_up() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reviews_enqueue_follow_up() FROM anon, authenticated;

