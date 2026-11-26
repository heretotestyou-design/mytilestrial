create function public.create_guest_order(
  p_pack_id text, p_expected_base bigint, p_email text, p_full_name text, p_company text,
  p_phone text, p_access_hash text, p_gstin text
)
returns public.guest_orders language plpgsql set search_path = ''
as $$
declare
  v_order public.guest_orders;
begin
  v_order := public.create_guest_order(p_pack_id, p_expected_base, p_email, p_full_name, p_company, p_phone, p_access_hash);
  if p_gstin is not null then
    update public.checkout_contacts set gstin = p_gstin where guest_order_id = v_order.id;
  end if;
  return v_order;
end;
$$;

revoke all on function public.create_guest_order(text, bigint, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_guest_order(text, bigint, text, text, text, text, text, text) to service_role;
