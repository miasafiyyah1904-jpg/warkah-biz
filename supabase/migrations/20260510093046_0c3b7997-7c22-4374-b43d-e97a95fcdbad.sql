
-- Rename device_id -> user_id on the 5 affected tables, recreate indexes/constraints/policies.

-- 1) nightly_reports
ALTER TABLE public.nightly_reports RENAME COLUMN device_id TO user_id;

DROP POLICY IF EXISTS "own select" ON public.nightly_reports;
DROP POLICY IF EXISTS "own insert" ON public.nightly_reports;
DROP POLICY IF EXISTS "own update" ON public.nightly_reports;
DROP POLICY IF EXISTS "own delete" ON public.nightly_reports;
CREATE POLICY "own select" ON public.nightly_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.nightly_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.nightly_reports FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.nightly_reports FOR DELETE USING (auth.uid() = user_id);

-- 2) action_items_log
ALTER TABLE public.action_items_log RENAME COLUMN device_id TO user_id;

DROP POLICY IF EXISTS "own select" ON public.action_items_log;
DROP POLICY IF EXISTS "own insert" ON public.action_items_log;
DROP POLICY IF EXISTS "own update" ON public.action_items_log;
DROP POLICY IF EXISTS "own delete" ON public.action_items_log;
CREATE POLICY "own select" ON public.action_items_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.action_items_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.action_items_log FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.action_items_log FOR DELETE USING (auth.uid() = user_id);

-- 3) forecasts
ALTER TABLE public.forecasts RENAME COLUMN device_id TO user_id;

DROP POLICY IF EXISTS "own select" ON public.forecasts;
DROP POLICY IF EXISTS "own insert" ON public.forecasts;
DROP POLICY IF EXISTS "own update" ON public.forecasts;
DROP POLICY IF EXISTS "own delete" ON public.forecasts;
CREATE POLICY "own select" ON public.forecasts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.forecasts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.forecasts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.forecasts FOR DELETE USING (auth.uid() = user_id);

-- 4) user_impian
ALTER TABLE public.user_impian RENAME COLUMN device_id TO user_id;

DROP POLICY IF EXISTS "own select" ON public.user_impian;
DROP POLICY IF EXISTS "own insert" ON public.user_impian;
DROP POLICY IF EXISTS "own update" ON public.user_impian;
DROP POLICY IF EXISTS "own delete" ON public.user_impian;
CREATE POLICY "own select" ON public.user_impian FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.user_impian FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.user_impian FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.user_impian FOR DELETE USING (auth.uid() = user_id);

-- 5) sisa_harian
ALTER TABLE public.sisa_harian RENAME COLUMN device_id TO user_id;

DROP POLICY IF EXISTS "own select" ON public.sisa_harian;
DROP POLICY IF EXISTS "own insert" ON public.sisa_harian;
DROP POLICY IF EXISTS "own update" ON public.sisa_harian;
DROP POLICY IF EXISTS "own delete" ON public.sisa_harian;
CREATE POLICY "own select" ON public.sisa_harian FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.sisa_harian FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.sisa_harian FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.sisa_harian FOR DELETE USING (auth.uid() = user_id);
