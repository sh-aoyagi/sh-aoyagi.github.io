import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 試すモデル名一覧
const candidates = [
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-2.5-flash-preview-05-20',
];

for (const modelName of candidates) {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseModalities: ['image', 'text'] },
    });
    const result = await model.generateContent('テスト');
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const hasImage = parts.some(p => p.inlineData);
    console.log(`✅ ${modelName} → 動作OK (画像あり: ${hasImage})`);
  } catch (err) {
    console.log(`❌ ${modelName} → ${err.message.split('\n')[0]}`);
  }
}
