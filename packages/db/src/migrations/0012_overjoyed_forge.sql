CREATE POLICY "shares_select_own_private" ON "shares" AS PERMISSIVE FOR SELECT TO "authenticated" USING (visibility = 'private' and exists (
        select 1 from renders r join projects p on p.id = r.project_id
        where r.id = render_id and p.user_id = auth.uid()
      ));--> statement-breakpoint
ALTER POLICY "shares_select_public" ON "shares" TO public USING (visibility <> 'private');