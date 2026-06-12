import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const candidates = [
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp-image-generation',
  'imagen-3.0-generate-002',
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
    console.log(`❌ ${model} → ${err.message?.split('\n')[0]}`);
  }
}
