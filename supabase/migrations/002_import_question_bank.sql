begin;
-- Single RPC call is one transaction: malformed imports cannot leave half a bank.
create or replace function public.import_question_bank(p_questions jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  imported_count integer := 0;
  active_count integer := 0;
begin
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
    raise exception 'Question bank must be a JSON array';
  end if;
  if jsonb_array_length(p_questions) = 0 then
    raise exception 'Question bank must not be empty';
  end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_questions)) <> jsonb_array_length(p_questions) then
    raise exception 'Duplicate question IDs';
  end if;
  for item in select value from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(item) <> 'object'
      or not (item ?& array['id', 'sourceNumber', 'prompt', 'options', 'correctKey', 'explanation', 'active'])
      or (item->>'id') !~ '^ly-duoc-[0-9]{3,}$'
      or jsonb_typeof(item->'sourceNumber') <> 'number'
      or jsonb_typeof(item->'prompt') <> 'string' or length(item->>'prompt') = 0
      or jsonb_typeof(item->'explanation') <> 'string' or length(item->>'explanation') = 0
      or jsonb_typeof(item->'active') <> 'boolean'
      or jsonb_typeof(item->'options') <> 'array'
      or jsonb_array_length(item->'options') <> 4
      or (select string_agg(value->>'key', '' order by ordinality) from jsonb_array_elements(item->'options') with ordinality) <> 'ABCD'
      or exists (select 1 from jsonb_array_elements(item->'options') where jsonb_typeof(value->'text') is distinct from 'string' or length(value->>'text') = 0)
      or (item->>'correctKey') not in ('A','B','C','D') then
      raise exception 'Invalid question bank item';
    end if;
    insert into public.questions (id, data, active, exclusion_reason)
    values (item->>'id', jsonb_build_object('sourceNumber', item->'sourceNumber', 'prompt', item->'prompt', 'options', item->'options'), (item->>'active')::boolean, item->>'exclusionReason')
    on conflict (id) do update set data = excluded.data, active = excluded.active, exclusion_reason = excluded.exclusion_reason;
    insert into public.question_answer_keys (question_id, correct_key, explanation)
    values (item->>'id', item->>'correctKey', item->>'explanation')
    on conflict (question_id) do update set correct_key = excluded.correct_key, explanation = excluded.explanation;
    imported_count := imported_count + 1;
    if (item->>'active')::boolean then active_count := active_count + 1; end if;
  end loop;
  return jsonb_build_object('imported', imported_count, 'active', active_count);
end;
$$;
revoke all on function public.import_question_bank(jsonb) from public, anon, authenticated;
grant execute on function public.import_question_bank(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
