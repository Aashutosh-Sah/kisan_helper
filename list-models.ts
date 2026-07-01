import https from "https";
import dotenv from "dotenv";
dotenv.config();

const options = {
  hostname: 'api.groq.com',
  path: '/openai/v1/models',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
  }
};
const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const models = JSON.parse(data).data;
      console.log(models.filter(m => m.id.includes('vision') || m.id.includes('llama')).map(m => m.id));
    } catch(e) {
      console.log(data);
    }
  });
});
req.end();
