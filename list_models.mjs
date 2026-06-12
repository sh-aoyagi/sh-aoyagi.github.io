import 'dotenv/config';
const key = process.env.GEMINI_API_KEY;
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=100`);
const json = await res.json();
json.models?.forEach(m => {
  if (m.name.includes('image') || m.name.includes('flash') || m.name.includes('imagen')) {
    console.log(m.name, '|', m.supportedGenerationMethods?.join(','));
  }
});
