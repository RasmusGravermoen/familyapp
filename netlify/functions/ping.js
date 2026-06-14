// netlify/functions/ping.js
// Kjøres automatisk hver dag for å holde Supabase aktiv

exports.handler = async function() {
  const url  = process.env.SUPABASE_URL + '/rest/v1/events?limit=1';
  const key  = process.env.SUPABASE_KEY;

  try {
    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key
      }
    });
    return {
      statusCode: 200,
      body: 'Ping OK: ' + res.status
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: 'Ping feilet: ' + err.message
    };
  }
};
