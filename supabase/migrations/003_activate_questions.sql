begin;
update public.questions
set active = true
where id in ('ly-duoc-023', 'ly-duoc-062') and active = false;
commit;
