-- Seed Standard Bio project templates (internal execution playbooks).
-- Idempotent: skips when commissioning slug already exists.

do $$
declare
  v_tpl uuid;
  v_mech uuid;
  v_elec uuid;
  v_burner uuid;
  v_accept uuid;
  v_install uuid;
  v_fat uuid;
  v_service uuid;
  v_biochar uuid;
  v_internal uuid;
  v_custom uuid;
begin
  if exists (select 1 from public.project_templates where slug = 'commissioning') then
    return;
  end if;

  -- Commissioning v1
  insert into public.project_templates (
    name, slug, version, is_latest, category, description, knowledge_notes, health_baseline
  ) values (
    'Commissioning',
    'commissioning',
    1,
    true,
    'Commissioning',
    'Standard Bio commissioning playbook for plant handover and client acceptance.',
    'Follow mechanical before electrical. Burner testing requires gas supply sign-off. Client acceptance requires completed training records.',
    '{"critical_milestones":["Acceptance"],"critical_phases":["Mechanical Checks","Electrical Checks","Burner Testing"]}'::jsonb
  ) returning id into v_tpl;

  insert into public.project_template_tasks (
    template_id, sort_order, title, area_name, area_code, due_offset_days,
    is_milestone, is_critical, default_status, visibility_scope, template_notes
  ) values
    (v_tpl, 10, 'Mechanical Checks', 'Mechanical', 'MECH', 7, false, true, 'Pending', 'internal', 'Verify bearings, alignment, and mechanical interfaces before energizing.'),
    (v_tpl, 20, 'Electrical Checks', 'Electrical', 'ELEC', 14, false, true, 'Pending', 'internal', 'Power systems and safety interlocks must pass before burner work.'),
    (v_tpl, 30, 'Burner Testing', 'Process', 'PROC', 21, false, true, 'Pending', 'internal_client', 'Calibration and functional burner tests under supervision.'),
    (v_tpl, 40, 'Acceptance', 'Commissioning', 'COMM', 30, true, true, 'Pending', 'internal_client', 'Client acceptance milestone — training and formal handover.');

  select id into v_mech from public.project_template_tasks where template_id = v_tpl and title = 'Mechanical Checks';
  select id into v_elec from public.project_template_tasks where template_id = v_tpl and title = 'Electrical Checks';
  select id into v_burner from public.project_template_tasks where template_id = v_tpl and title = 'Burner Testing';
  select id into v_accept from public.project_template_tasks where template_id = v_tpl and title = 'Acceptance';

  insert into public.project_template_tasks (
    template_id, parent_template_task_id, sort_order, title, due_offset_days, default_status, visibility_scope
  ) values
    (v_tpl, v_mech, 11, 'Bearings', 7, 'Pending', 'internal'),
    (v_tpl, v_mech, 12, 'Alignment', 8, 'Pending', 'internal'),
    (v_tpl, v_elec, 21, 'Power Systems', 14, 'Pending', 'internal'),
    (v_tpl, v_elec, 22, 'Safety Systems', 15, 'Pending', 'internal'),
    (v_tpl, v_burner, 31, 'Calibration', 21, 'Pending', 'internal_client'),
    (v_tpl, v_burner, 32, 'Functional Test', 22, 'Pending', 'internal_client'),
    (v_tpl, v_accept, 41, 'Training', 28, 'Pending', 'internal_client'),
    (v_tpl, v_accept, 42, 'Handover', 30, 'Pending', 'internal_client');

  insert into public.project_template_task_dependencies (
    template_id, predecessor_template_task_id, successor_template_task_id, dependency_type
  ) values
    (v_tpl, v_mech, v_elec, 'FS'),
    (v_tpl, v_elec, v_burner, 'FS'),
    (v_tpl, v_burner, v_accept, 'FS');

  -- Installation v1
  insert into public.project_templates (
    name, slug, version, is_latest, category, description, knowledge_notes
  ) values (
    'Installation',
    'installation',
    1,
    true,
    'Installation',
    'Site installation and mechanical assembly sequence.',
    'Confirm foundation and lifting plan before equipment placement.'
  ) returning id into v_install;

  insert into public.project_template_tasks (
    template_id, sort_order, title, due_offset_days, is_critical, default_status
  ) values
    (v_install, 10, 'Site Preparation', 0, true, 'Pending'),
    (v_install, 20, 'Equipment Delivery', 7, true, 'Pending'),
    (v_install, 30, 'Mechanical Installation', 14, true, 'Pending'),
    (v_install, 40, 'Installation Complete', 21, true, 'Pending');

  update public.project_template_tasks
  set is_milestone = true
  where template_id = v_install and title = 'Installation Complete';

  -- FAT v1
  insert into public.project_templates (
    name, slug, version, is_latest, category, description, knowledge_notes
  ) values (
    'FAT',
    'fat',
    1,
    true,
    'FAT',
    'Factory Acceptance Test checklist for pre-shipment validation.',
    'Document all deviations. Client witness required for sign-off.'
  ) returning id into v_fat;

  insert into public.project_template_tasks (
    template_id, sort_order, title, due_offset_days, is_milestone, is_critical, default_status
  ) values
    (v_fat, 10, 'FAT Planning', 0, false, true, 'Pending'),
    (v_fat, 20, 'FAT Execution', 7, false, true, 'Pending'),
    (v_fat, 30, 'FAT Complete', 14, true, true, 'Pending');

  -- Service v1
  insert into public.project_templates (
    name, slug, version, is_latest, category, description
  ) values (
    'Service',
    'service',
    1,
    true,
    'Service',
    'Service visit and corrective maintenance workflow.'
  ) returning id into v_service;

  insert into public.project_template_tasks (
    template_id, sort_order, title, due_offset_days, default_status
  ) values
    (v_service, 10, 'Service Request Review', 0, 'Pending'),
    (v_service, 20, 'On-site Service', 3, 'Pending'),
    (v_service, 30, 'Service Report', 7, 'Pending');

  -- Biochar Plant v1
  insert into public.project_templates (
    name, slug, version, is_latest, category, description, knowledge_notes
  ) values (
    'Biochar Plant',
    'biochar',
    1,
    true,
    'Biochar',
    'Biochar plant delivery and startup sequence.',
    'Include pyrolysis zone checks and emissions baseline capture.'
  ) returning id into v_biochar;

  insert into public.project_template_tasks (
    template_id, sort_order, title, due_offset_days, is_critical, default_status
  ) values
    (v_biochar, 10, 'Civil & Structural', 0, true, 'Pending'),
    (v_biochar, 20, 'Pyrolysis Equipment', 14, true, 'Pending'),
    (v_biochar, 30, 'Emissions & Safety', 21, true, 'Pending'),
    (v_biochar, 40, 'Plant Startup', 28, true, 'Pending');

  -- Internal Project v1
  insert into public.project_templates (
    name, slug, version, is_latest, category, description
  ) values (
    'Internal Project',
    'internal',
    1,
    true,
    'Internal',
    'Lightweight internal initiative tracker.'
  ) returning id into v_internal;

  insert into public.project_template_tasks (
    template_id, sort_order, title, due_offset_days, default_status
  ) values
    (v_internal, 10, 'Kickoff', 0, 'Pending'),
    (v_internal, 20, 'Execution', 7, 'Pending'),
    (v_internal, 30, 'Review', 14, 'Pending');

  -- Custom v1 (empty shell)
  insert into public.project_templates (
    name, slug, version, is_latest, category, description
  ) values (
    'Custom',
    'custom',
    1,
    true,
    'Custom',
    'Blank template — define your own structure in the Template Editor.'
  ) returning id into v_custom;

end $$;
