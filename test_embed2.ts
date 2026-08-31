import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const res = await ai.models.embedContent({ model: 'gemini-embedding-2', contents: 'test chunk' });
  console.log(res.embeddings ? res.embeddings[0].values.length : 'no embeddings');
}
run().catch(console.error);
