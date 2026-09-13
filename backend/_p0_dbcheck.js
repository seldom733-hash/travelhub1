const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/travelhub1', connectionTimeoutMillis: 15000 });
(async () => {
  await c.connect();
  const p = await c.query('SELECT slug, status, "currentVersion", "draftVersion" FROM constructor."ConstructorPage" WHERE slug = $1', ['marketplace-home']);
  console.log('PAGE:', JSON.stringify(p.rows[0]));
  const v = await c.query('SELECT version, status FROM constructor."ConstructorPageVersion" WHERE "pageId" = (SELECT id FROM constructor."ConstructorPage" WHERE slug = $1) ORDER BY version DESC LIMIT 3', ['marketplace-home']);
  console.log('LAST VERSIONS:', JSON.stringify(v.rows));
  const snap = await c.query(`SELECT snapshot->'headerConfig'->'companyName'->>'ru' AS company, snapshot->'heroConfig'->'slides'->0->>'imageUrl' AS hero1 FROM constructor."ConstructorPageVersion" WHERE "pageId" = (SELECT id FROM constructor."ConstructorPage" WHERE slug = $1) AND version = (SELECT "currentVersion" FROM constructor."ConstructorPage" WHERE slug = $1)`, ['marketplace-home']);
  console.log('PUBLISHED companyName.ru:', snap.rows[0].company);
  console.log('PUBLISHED hero slide-1:', (snap.rows[0].hero1 || '').slice(0, 110));
  const sections = await c.query('SELECT count(*) AS n FROM constructor."ConstructorPageSection" WHERE "pageId" = (SELECT id FROM constructor."ConstructorPage" WHERE slug = $1) AND version = (SELECT "currentVersion" FROM constructor."ConstructorPage" WHERE slug = $1)', ['marketplace-home']);
  console.log('PUBLISHED sections:', sections.rows[0].n);
  await c.end();
})().catch(e => { console.log('ERR:', e.message); process.exit(1); });
