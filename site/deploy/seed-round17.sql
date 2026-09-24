-- Sarapis round-17 DATA seed — run AFTER migration-round17.sql, only on the
-- 'preserve the box DB' path. Idempotent. (If you instead ship the local
-- sarapis.db to the box volume, skip this entirely — the data is already in it.)
BEGIN;

-- 1) Project taxonomy (region / role / lineage / site) by name.
UPDATE projects SET region='nyc', role='flagship', lineage=NULL, site='wegov.nyc' WHERE name='WeGovNYC';
UPDATE projects SET region='nyc', role='child', lineage='Experiment → App → Integrated', site='databook.nyc' WHERE name='Databook';
UPDATE projects SET region='nyc', role='child', lineage='Experiment → App → Integrated', site='contracts.nyc' WHERE name='NYC Contracting Explorer';
UPDATE projects SET region='nyc', role='child', lineage='Experiment → App → Integrated', site='titleviewer.nyc' WHERE name='NYC Civil Title Viewer';
UPDATE projects SET region='global', role='flagship', lineage=NULL, site='openreferral.org' WHERE name='Open Referral';
UPDATE projects SET region='global', role='child', lineage='Deployment', site='orservices.org' WHERE name='ORServices';
UPDATE projects SET region='nyc', role='standalone', lineage=NULL, site='mutualaid.nyc' WHERE name='MutualAidNYC';
UPDATE projects SET region='global', role='standalone', lineage=NULL, site='sahanafoundation.org' WHERE name='Sahana EDEN';

-- 2) Link events + repos to projects by repo org, then publish the linked rows.
UPDATE activity_events SET project_id = CASE
    WHEN repo_full_name='wegovnyc/databook_interface' THEN 2
    WHEN repo_full_name='wegovnyc/nyc-contracting-explorer' THEN 3
    WHEN repo_full_name='wegovnyc/nyc_civil_title_viewer' THEN 4
    WHEN repo_full_name LIKE 'wegovnyc/%' THEN 1
    WHEN repo_full_name LIKE 'openreferral/ServiceNet%' THEN 6
    WHEN repo_full_name LIKE 'openreferral/%' THEN 5
    WHEN repo_full_name LIKE 'sahana/%' THEN 8
    WHEN repo_full_name LIKE 'MutualAidNYC/%' THEN 7
    ELSE project_id END;
UPDATE activity_events SET published=1 WHERE project_id IS NOT NULL;
UPDATE repos SET project_id = CASE
    WHEN full_name='wegovnyc/databook_interface' THEN 2
    WHEN full_name='wegovnyc/nyc-contracting-explorer' THEN 3
    WHEN full_name='wegovnyc/nyc_civil_title_viewer' THEN 4
    WHEN full_name LIKE 'wegovnyc/%' THEN 1
    WHEN full_name LIKE 'openreferral/ServiceNet%' THEN 6
    WHEN full_name LIKE 'openreferral/%' THEN 5
    WHEN full_name LIKE 'sahana/%' THEN 8
    WHEN full_name LIKE 'MutualAidNYC/%' THEN 7
    ELSE project_id END;
UPDATE repos SET published=1 WHERE project_id IS NOT NULL;

-- NOTE: project ids above assume the box's projects match local ids 1–8
-- (WeGovNYC=1, Databook=2, NYC Contracting Explorer=3, NYC Civil Title Viewer=4,
--  Open Referral=5, ORServices=6, MutualAidNYC=7, Sahana EDEN=8). If the box ids
--  differ, adjust the CASE targets. Verify: SELECT project_id,count(*) FROM
--  activity_events WHERE published=1 GROUP BY project_id;

COMMIT;
