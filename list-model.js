const fs = require('fs');
const https = require('https');

// Read API key from .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.+)/);
if (!match) {
  console.log("No API key found");
  process.exit(1);
}
const apiKey = match[1].trim();

https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.models) {
      console.log("Available models:");
      json.models.filter(m => m.supportedGenerationMethods.includes('generateContent')).forEach(m => console.log(m.name));
    } else {
      console.log(json);
    }
  });
}).on('error', err => console.error(err));
