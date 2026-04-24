UPDATE public.breakout_companies
SET mapped_data = mapped_data
  || jsonb_build_object('revenue', COALESCE(NULLIF(mapped_data->>'revenue', ''), NULLIF(raw_data->>'Company Size (Revenue): Please indicate the ARR as of the end of 2025', ''), ''))
  || jsonb_build_object('capital_raised', COALESCE(NULLIF(mapped_data->>'capital_raised', ''), NULLIF(raw_data->>'Company Size (Capitalization): Please indicate the amount of investment received from external investors (including grants and other non-dilutive funding)', ''), ''))
  || jsonb_build_object('sector', COALESCE(NULLIF(mapped_data->>'sector', ''), NULLIF(raw_data->>'Describe what sector(s) are most relevant to you', ''), ''))
  || jsonb_build_object('primary_market', COALESCE(NULLIF(mapped_data->>'primary_market', ''), NULLIF(raw_data->>'What is the primary market that you serve?', ''), ''))
  || jsonb_build_object('business_type', COALESCE(NULLIF(mapped_data->>'business_type', ''), NULLIF(raw_data->>'Which of the following best describes your business?', ''), ''))
  || jsonb_build_object('has_pmf', COALESCE(NULLIF(mapped_data->>'has_pmf', ''), NULLIF(raw_data->>'Have you found product-market fit?', ''), ''))
  || jsonb_build_object('sales_stage', COALESCE(NULLIF(mapped_data->>'sales_stage', ''), NULLIF(raw_data->>'Where are you in your sales evolution?', ''), ''))
  || jsonb_build_object('employee_count', COALESCE(NULLIF(mapped_data->>'employee_count', ''), NULLIF(raw_data->>'Company Size (# of Employees): Please indicate the # of employees (excluding consultants/advisors)', ''), ''))
  || jsonb_build_object('icp', COALESCE(NULLIF(mapped_data->>'icp', ''), NULLIF(raw_data->>'Briefly Describe your ideal customer profile (ICP)', ''), ''))
WHERE session_id = 'f0833640-16af-4ebd-a2c4-b69655dd0758'
  AND raw_data IS NOT NULL;