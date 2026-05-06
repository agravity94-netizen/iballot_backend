const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:h9XuP%26dJ%24KJ3YPQ@db.pmikowhmezwpxbccjyky.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  
  try {
    // Check if table exists
    const tableRes = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'OtpCode';
    `);
    console.log('Table OtpCode exists:', tableRes.rows.length > 0);

    // Get all foreign keys for OtpCode
    const fkeyRes = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"public"."OtpCode"'::regclass
      AND contype = 'f';
    `);
    console.log('Foreign keys on OtpCode:', fkeyRes.rows);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
  }
}

run();
