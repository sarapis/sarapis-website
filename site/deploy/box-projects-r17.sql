-- round-17 project taxonomy only (box sync owns event/repo linking + publish)
BEGIN;
UPDATE projects SET region='nyc', role='flagship', lineage=NULL, site='wegov.nyc' WHERE name='WeGovNYC';
UPDATE projects SET region='nyc', role='child', lineage='Experiment → App → Integrated', site='databook.nyc' WHERE name='Databook';
UPDATE projects SET region='nyc', role='child', lineage='Experiment → App → Integrated', site='contracts.nyc' WHERE name='NYC Contracting Explorer';
UPDATE projects SET region='nyc', role='child', lineage='Experiment → App → Integrated', site='titleviewer.nyc' WHERE name='NYC Civil Title Viewer';
UPDATE projects SET region='global', role='flagship', lineage=NULL, site='openreferral.org' WHERE name='Open Referral';
UPDATE projects SET region='global', role='child', lineage='Deployment', site='orservices.org' WHERE name='ORServices';
UPDATE projects SET region='nyc', role='standalone', lineage=NULL, site='mutualaid.nyc' WHERE name='MutualAidNYC';
UPDATE projects SET region='global', role='standalone', lineage=NULL, site='sahanafoundation.org' WHERE name='Sahana EDEN';
COMMIT;
