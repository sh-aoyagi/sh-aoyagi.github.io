import 'dotenv/config';
import { GoogleGenAI, Modality } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// inboxの最初の画像でテスト
const testFile = 'C:\\denno\\images\\inbox\\IMG_E6763.HEIC';
import convert from 'heic-convert';
const heicBuf = fs.readFileSync(testFile);
const jpegBuf = await convert({ buffer: heicBuf, format: 'JPEG', quality: 0.9 });
const base64 = Buffer.from(jpegBuf).toString('base64');

const candidates = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
];

for (const model of candidates) {
  try {
    console.log(`🔄 ${model} をテスト中...`);
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: 'この商品写真の背景を白にしてクリーニングしてください。文字は一切入れないでください。' },
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          ],
        },
      ],
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find(p => p.inlineData);
    if (imgPart) {
      fs.writeFileSync(`C:\\denno\\images\\test_${model.replace(/[\/]/g, '_')}.jpg`, Buffer.from(imgPart.inlineData.data, 'base64'));
      console.log(`✅ ${model} → 画像取得成功！`);
    } else {
      console.log(`⚠ ${model} → 画像なし（テキスト応答のみ）`);
    }
    break; // 成功したら止める
  } catch (err) {
    console.log(`❌ ${model} → ${err.message?.slice(0, 100)}`);
  }
}
