insert into public.dramas(id,slug,public_code,status,title,hook,description,cover_url,tags,published_at) values
('00000000-0000-0000-0000-000000000042','the-billionaires-vow','0042','published','The Billionaire''s Vow','She married a stranger for one night. He spent three years looking for her.','Demo data only.','https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00',array['Secret baby','Romance'],now());
insert into public.redirect_routes(id,slug,drama_id) values ('10000000-0000-0000-0000-000000000042','billionaires-vow','00000000-0000-0000-0000-000000000042');
-- Use application-layer encryption before inserting any real destination URL.
insert into public.destinations(id,name,provider,app_platform,cps_url_encrypted,allowed_host) values
('20000000-0000-0000-0000-000000000042','Placeholder universal','demo','universal','ENCRYPTED:https://affiliate.example.test/cps/RESOURCE_PLACEHOLDER','affiliate.example.test');
insert into public.route_destinations(route_id,destination_id) values ('10000000-0000-0000-0000-000000000042','20000000-0000-0000-0000-000000000042');
