-- pg_policies snapshot — production (project ref qzrrscryacxhprnrtpjd)
-- Captured: 2026-04-21 via supabase db query --linked
-- NOT idempotent; this is a read-only DDL rendering for human review / diff.
-- Source view: pg_policies (system catalog)

-- public.academies :: ac_del
CREATE POLICY ac_del ON public.academies
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.academies :: ac_ins
CREATE POLICY ac_ins ON public.academies
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)));

-- public.academies :: ac_sel
CREATE POLICY ac_sel ON public.academies
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.academies :: ac_upd
CREATE POLICY ac_upd ON public.academies
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.child_locations :: cl_ins
CREATE POLICY cl_ins ON public.child_locations
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((user_id = auth.uid()));

-- public.child_locations :: cl_insert_own
CREATE POLICY cl_insert_own ON public.child_locations
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((user_id = auth.uid()));

-- public.child_locations :: cl_sel
CREATE POLICY cl_sel ON public.child_locations
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.child_locations :: cl_select_family
CREATE POLICY cl_select_family ON public.child_locations
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.child_locations :: cl_upd
CREATE POLICY cl_upd ON public.child_locations
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((user_id = auth.uid()))
;

-- public.child_locations :: cl_update_own
CREATE POLICY cl_update_own ON public.child_locations
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((user_id = auth.uid()))
;

-- public.danger_zones :: dz_delete_parent
CREATE POLICY dz_delete_parent ON public.danger_zones
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((family_id IN ( SELECT families.id
   FROM families
  WHERE (families.parent_id = auth.uid()))))
;

-- public.danger_zones :: dz_insert_parent
CREATE POLICY dz_insert_parent ON public.danger_zones
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((family_id IN ( SELECT families.id
   FROM families
  WHERE (families.parent_id = auth.uid()))));

-- public.danger_zones :: dz_select_family
CREATE POLICY dz_select_family ON public.danger_zones
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.danger_zones :: dz_update_parent
CREATE POLICY dz_update_parent ON public.danger_zones
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((family_id IN ( SELECT families.id
   FROM families
  WHERE (families.parent_id = auth.uid()))))
;

-- public.emergency_audio_chunks :: eac_delete_parent
CREATE POLICY eac_delete_parent ON public.emergency_audio_chunks
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((family_id IN ( SELECT families.id
   FROM families
  WHERE (families.parent_id = auth.uid()))))
;

-- public.emergency_audio_chunks :: eac_insert_child
CREATE POLICY eac_insert_child ON public.emergency_audio_chunks
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((child_id = auth.uid()) AND (family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids))));

-- public.emergency_audio_chunks :: eac_select_family
CREATE POLICY eac_select_family ON public.emergency_audio_chunks
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.events :: ev_del
CREATE POLICY ev_del ON public.events
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.events :: ev_ins
CREATE POLICY ev_ins ON public.events
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)));

-- public.events :: ev_sel
CREATE POLICY ev_sel ON public.events
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.events :: ev_upd
CREATE POLICY ev_upd ON public.events
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.families :: fam_ins
CREATE POLICY fam_ins ON public.families
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((parent_id = auth.uid()));

-- public.families :: fam_sel
CREATE POLICY fam_sel ON public.families
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.families :: fam_upd
CREATE POLICY fam_upd ON public.families
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((parent_id = auth.uid()))
;

-- public.family_members :: fm_del
CREATE POLICY fm_del ON public.family_members
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((user_id = auth.uid()) OR (family_id IN ( SELECT families.id
   FROM families
  WHERE (families.parent_id = auth.uid())))))
;

-- public.family_members :: fm_ins
CREATE POLICY fm_ins ON public.family_members
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((user_id = auth.uid()));

-- public.family_members :: fm_sel
CREATE POLICY fm_sel ON public.family_members
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.family_members :: fm_upd
CREATE POLICY fm_upd ON public.family_members
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((user_id = auth.uid()))
;

-- public.fcm_tokens :: users_manage_own_fcm_tokens
CREATE POLICY users_manage_own_fcm_tokens ON public.fcm_tokens
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

-- public.location_history :: child_insert_own_history
CREATE POLICY child_insert_own_history ON public.location_history
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((user_id = auth.uid()));

-- public.location_history :: family_read_history
CREATE POLICY family_read_history ON public.location_history
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT family_members.family_id
   FROM family_members
  WHERE (family_members.user_id = auth.uid()))))
;

-- public.location_history :: lh_insert_own
CREATE POLICY lh_insert_own ON public.location_history
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((user_id = auth.uid()));

-- public.location_history :: lh_select_family
CREATE POLICY lh_select_family ON public.location_history
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.memo_replies :: memo_replies_delete
CREATE POLICY memo_replies_delete ON public.memo_replies
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((user_id = auth.uid()))
;

-- public.memo_replies :: memo_replies_insert
CREATE POLICY memo_replies_insert ON public.memo_replies
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)));

-- public.memo_replies :: memo_replies_select
CREATE POLICY memo_replies_select ON public.memo_replies
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.memos :: memo_del
CREATE POLICY memo_del ON public.memos
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.memos :: memo_ins
CREATE POLICY memo_ins ON public.memos
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)));

-- public.memos :: memo_sel
CREATE POLICY memo_sel ON public.memos
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.memos :: memo_upd
CREATE POLICY memo_upd ON public.memos
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.memos :: memos_insert
CREATE POLICY memos_insert ON public.memos
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((family_id IN ( SELECT family_members.family_id
   FROM family_members
  WHERE (family_members.user_id = auth.uid()))));

-- public.memos :: memos_update
CREATE POLICY memos_update ON public.memos
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((family_id IN ( SELECT family_members.family_id
   FROM family_members
  WHERE (family_members.user_id = auth.uid()))))
;

-- public.pair_attempts :: pa_ins
CREATE POLICY pa_ins ON public.pair_attempts
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (true);

-- public.pair_attempts :: pa_sel
CREATE POLICY pa_sel ON public.pair_attempts
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((user_id = auth.uid()))
;

-- public.parent_alerts :: pa_select_family
CREATE POLICY pa_select_family ON public.parent_alerts
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.parent_alerts :: pa_update_family
CREATE POLICY pa_update_family ON public.parent_alerts
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.point_transactions :: tx_read
CREATE POLICY tx_read ON public.point_transactions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT family_members.family_id
   FROM family_members
  WHERE (family_members.user_id = auth.uid()))))
;

-- public.point_wallets :: wallet_read
CREATE POLICY wallet_read ON public.point_wallets
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT family_members.family_id
   FROM family_members
  WHERE (family_members.user_id = auth.uid()))))
;

-- public.push_sent :: psent_all
CREATE POLICY psent_all ON public.push_sent
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- public.push_subscriptions :: ps_del
CREATE POLICY ps_del ON public.push_subscriptions
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((user_id = auth.uid()))
;

-- public.push_subscriptions :: ps_ins
CREATE POLICY ps_ins ON public.push_subscriptions
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((user_id = auth.uid()));

-- public.push_subscriptions :: ps_sel
CREATE POLICY ps_sel ON public.push_subscriptions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT get_my_family_ids() AS get_my_family_ids)))
;

-- public.push_subscriptions :: ps_upd
CREATE POLICY ps_upd ON public.push_subscriptions
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((user_id = auth.uid()))
;

-- public.referral_codes :: rc_read
CREATE POLICY rc_read ON public.referral_codes
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((family_id IN ( SELECT family_members.family_id
   FROM family_members
  WHERE (family_members.user_id = auth.uid()))))
;

-- public.referral_completions :: rcomp_read
CREATE POLICY rcomp_read ON public.referral_completions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((referrer_family_id IN ( SELECT family_members.family_id
   FROM family_members
  WHERE (family_members.user_id = auth.uid()))) OR (referee_family_id IN ( SELECT family_members.family_id
   FROM family_members
  WHERE (family_members.user_id = auth.uid())))))
;

-- public.user_feedback :: Users can insert own feedback
CREATE POLICY "Users can insert own feedback" ON public.user_feedback
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id));

-- public.user_feedback :: Users can read own feedback
CREATE POLICY "Users can read own feedback" ON public.user_feedback
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id))
;

-- storage.objects :: sos_audio_delete
CREATE POLICY sos_audio_delete ON storage.objects
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((bucket_id = 'sos_audio'::text) AND ((storage.foldername(name))[1] IN ( SELECT (families.id)::text AS id
   FROM families
  WHERE (families.parent_id = auth.uid())))))
;

-- storage.objects :: sos_audio_download
CREATE POLICY sos_audio_download ON storage.objects
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((bucket_id = 'sos_audio'::text) AND ((storage.foldername(name))[1] IN ( SELECT (family_members.family_id)::text AS family_id
   FROM family_members
  WHERE (family_members.user_id = auth.uid())))))
;

-- storage.objects :: sos_audio_upload
CREATE POLICY sos_audio_upload ON storage.objects
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((bucket_id = 'sos_audio'::text) AND (auth.uid() IS NOT NULL) AND ((storage.foldername(name))[1] IN ( SELECT (family_members.family_id)::text AS family_id
   FROM family_members
  WHERE (family_members.user_id = auth.uid())))));
