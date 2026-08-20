import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { detectFileKind } from './detectFileKind';

async function realPngBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: '#ff0000' } })
    .png()
    .toBuffer();
}

async function realJpegBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: '#00ff00' } })
    .jpeg()
    .toBuffer();
}

describe('detectFileKind — §8 "בדיקת magic bytes ← לא סיומת!"', () => {
  it('מזהה PNG אמיתי מהתוכן (לא מהסיומת — אין סיומת בקלט כלל)', async () => {
    expect(await detectFileKind(await realPngBuffer())).toBe('png');
  });

  it('מזהה JPEG אמיתי מהתוכן', async () => {
    expect(await detectFileKind(await realJpegBuffer())).toBe('jpeg');
  });

  it('מזהה SVG לפי היוריסטיקת התוכן (הצהרת XML + <svg)', async () => {
    const buffer = Buffer.from(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
      'utf-8',
    );
    expect(await detectFileKind(buffer)).toBe('svg');
  });

  it('מזהה SVG גם בלי הצהרת XML, עם הערות לפני התגית', async () => {
    const buffer = Buffer.from(
      '<!-- exported by some tool --><svg xmlns="http://www.w3.org/2000/svg"></svg>',
      'utf-8',
    );
    expect(await detectFileKind(buffer)).toBe('svg');
  });

  it('דוחה קובץ טקסט רגיל שאינו SVG/תמונה (לא magic bytes, לא נראה כמו SVG)', async () => {
    const buffer = Buffer.from('this is just plain text, not an image or svg', 'utf-8');
    expect(await detectFileKind(buffer)).toBeNull();
  });

  it('דוחה קובץ בינארי-גולמי שלא תואם אף פורמט נתמך (למשל ELF/exe header מזויף)', async () => {
    const buffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x01, 0x02, 0x03, 0x04]);
    expect(await detectFileKind(buffer)).toBeNull();
  });

  it('לא נופל על תוכן PNG-אמיתי גם אם שם-קובץ/סיומת מרמזים על SVG — אין קלט סיומת כלל בפונקציה', async () => {
    // ה-API של detectFileKind לוקח Buffer בלבד — אין דרך "לשקר" לו עם סיומת; הבדיקה כאן
    // רק מוודאת שתוכן PNG אמיתי תמיד מזוהה כ-PNG בלי קשר לשום מטא-דאטה חיצוני.
    expect(await detectFileKind(await realPngBuffer())).toBe('png');
  });
});
