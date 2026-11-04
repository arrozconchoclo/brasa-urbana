alter table public.products
  add column if not exists image_url text;

update public.products
set description = case name
    when 'La Urbana' then 'Carne smash, queso fundido, vegetales frescos y salsa de la casa.'
    when 'Doble Fuego' then 'Doble carne, queso y salsa picante para quienes buscan más intensidad.'
    when 'Papas Bravas' then 'Papas doradas y crujientes servidas con nuestra salsa brava.'
    when 'Alitas 8 piezas' then 'Ocho alitas jugosas, doradas y bañadas en salsa de la casa.'
    when 'Combo Clásico' then 'Hamburguesa clásica acompañada de papas y gaseosa fría.'
    when 'Gaseosa fría' then 'Gaseosa bien fría para acompañar tu pedido.'
    when 'Milkshake de vainilla' then 'Batido cremoso de vainilla, frío y recién preparado.'
    else description
  end;
