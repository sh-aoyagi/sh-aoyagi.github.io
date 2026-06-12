import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

// v1alpha (実験的API) で試す
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1alpha' });

const candidates = [
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.5-flash-preview-image-generation',
];

for (const model of candidates) {
  try {
    const response = await ai.models.generateContent({
      model,
      contents: 'テスト',
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    });
    console.log(`✅ ${model} → OK`);
  } catch (err) {
    const msg = err.message?.slice(0, 120);
    console.log(`❌ ${model} → ${msg}`);
  }
}
