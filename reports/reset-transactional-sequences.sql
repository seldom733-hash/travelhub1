TRUNCATE TABLE communication."Communication", communication."CommunicationThread" RESTART IDENTITY CASCADE;

UPDATE events."BusinessSequence"
SET value = 0
WHERE prefix IN (
  'BKG', 'CML', 'CUS', 'LTX', 'ORD', 'PAY', 'REQ', 'SBO', 'TH-2026',
  'REFSEQ:REFSEQ:COMMERCE:ROOT'
);

SELECT prefix, value FROM events."BusinessSequence"
WHERE prefix IN ('BKG','CML','CUS','LTX','ORD','PAY','REQ','SBO','TH-2026')
ORDER BY prefix;
