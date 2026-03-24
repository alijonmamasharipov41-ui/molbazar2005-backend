-- Eski category_slug = chorva qatorlarini ot | qoy | tuya | echki | qoramol ga ajratish
-- (qolganlar ot — asosan ot yoki noaniq)

UPDATE listings
SET category_slug = 'qoy'
WHERE LOWER(TRIM(category_slug)) = 'chorva'
  AND (
    product_type ILIKE '%qo''y%'
    OR product_type ILIKE '%qochqor%'
    OR product_type ILIKE '%qozi%'
    OR product_type ILIKE '%ona qo%'
  );

UPDATE listings
SET category_slug = 'tuya'
WHERE LOWER(TRIM(category_slug)) = 'chorva'
  AND (
    product_type ILIKE '%tuya%'
    OR product_type ILIKE '%bo''taloq%'
    OR product_type ILIKE '%botaloq%'
  );

UPDATE listings
SET category_slug = 'echki'
WHERE LOWER(TRIM(category_slug)) = 'chorva'
  AND (
    product_type ILIKE '%echki%'
    OR product_type ILIKE '%taka%'
    OR product_type ILIKE '%uloq%'
    OR product_type ILIKE '%chechki%'
  );

UPDATE listings
SET category_slug = 'qoramol'
WHERE LOWER(TRIM(category_slug)) = 'chorva'
  AND (
    product_type ILIKE '%sigir%'
    OR product_type ILIKE '%buzaq%'
    OR product_type ILIKE '%buqa%'
    OR product_type ILIKE '%qoramol%'
    OR product_type ILIKE '%sutli%'
  );

UPDATE listings
SET category_slug = 'ot'
WHERE LOWER(TRIM(category_slug)) = 'chorva';
