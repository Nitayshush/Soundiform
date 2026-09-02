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

/** ⭐ 2026-09-02: הפורמטים שנפתחו — כולם מיוצרים מ-sharp עצמו, כך שהבדיקה מאמתת גם שהמנוע
 *  שמפענח אותם בשרשרת ההעלאה באמת יודע לייצר/לקרוא אותם בסביבה הזו. */
function blueSquare() {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: '#0000ff' } });
}
const gifBuffer = (): Promise<Buffer> => blueSquare().gif().toBuffer();
const tiffBuffer = (): Promise<Buffer> => blueSquare().tiff().toBuffer();
// ⚠️ heif דורש `compression` מפורש ב-sharp 0.35; 'av1' מפיק AVIF, שעוטף באותו HEIF כמו HEIC.
const heifBuffer = (): Promise<Buffer> => blueSquare().heif({ compression: 'av1' }).toBuffer();

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

  // ⭐ 2026-09-02: הפורמטים שנפתחו. ⚠️ HEIC של אייפון ו-AVIF שניהם עוטפים ב-HEIF, ולכן
  // שניהם ממופים ל-'heif'. בלי התמיכה הזו כל צילום מאייפון נדחה — הכשל הנפוץ ביותר.
  it('מזהה TIFF ו-HEIF/AVIF מהתוכן', async () => {
    expect(await detectFileKind(await tiffBuffer())).toBe('tiff');
    expect(await detectFileKind(await heifBuffer())).toBe('heif');
  });

  // ⚠️ GIF נדחה **בכוונה**, אף ש-sharp מפענח אותו: ה-dithering שלו דוחף 1,424 פיקסלים
  // מעבר לסף ולכן אותה תמונה נותנת מוזיקה אחרת מכל שאר הפורמטים. עדיף לומר "לא נתמך"
  // מאשר לתת תוצאה שגויה בשקט. הבדיקה נועלת את ההחלטה.
  it('דוחה GIF — ה-dithering שלו משנה את הצורה שנחלצת', async () => {
    expect(await detectFileKind(await gifBuffer())).toBeNull();
  });

  // ⚠️ BMP נשאר **מחוץ** לרשימה בכוונה: נמדד ש-sharp נכשל עליו ("unsupported image format").
  // הבדיקה הזו נועלת את ההחלטה — פורמט שהמנוע לא מפענח לא נכנס לרשימת ההיתר, אחרת הכשל
  // יקרה מאוחר יותר בשרשרת ובהודעת שגיאה גרועה בהרבה.
  it('דוחה BMP — sharp אינו מפענח אותו, ולכן הוא לא ברשימה', async () => {
    const bmpHeader = Buffer.concat([Buffer.from('BM'), Buffer.alloc(60, 0)]);
    expect(await detectFileKind(bmpHeader)).toBeNull();
  });

  it('לא נופל על תוכן PNG-אמיתי גם אם שם-קובץ/סיומת מרמזים על SVG — אין קלט סיומת כלל בפונקציה', async () => {
    // ה-API של detectFileKind לוקח Buffer בלבד — אין דרך "לשקר" לו עם סיומת; הבדיקה כאן
    // רק מוודאת שתוכן PNG אמיתי תמיד מזוהה כ-PNG בלי קשר לשום מטא-דאטה חיצוני.
    expect(await detectFileKind(await realPngBuffer())).toBe('png');
  });
});
