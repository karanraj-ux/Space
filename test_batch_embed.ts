import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const res = await ai.models.embedContent({ 
    model: 'gemini-embedding-2', 
    contents: ['chunk 1', 'chunk 2'] 
  });
  console.log(res.embeddings?.length);
}
run().catch(console.error);
