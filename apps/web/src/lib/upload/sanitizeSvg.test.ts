import { describe, expect, it } from 'vitest';
import { sanitizeSvg, SvgSanitizeError } from './sanitizeSvg';

describe('sanitizeSvg — §8 "SVG? → svgo + DOMPurify ← חובה, וקטור XSS"', () => {
  it('מסיר <script> לגמרי', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert');
  });

  it('מסיר event handler attributes (onload, onclick וכו״)', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="1" height="1" onclick="alert(2)"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean.toLowerCase()).not.toContain('onload');
    expect(clean.toLowerCase()).not.toContain('onclick');
  });

  it('מסיר javascript: URIs מתוך href', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="1" height="1"/></a></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean.toLowerCase()).not.toContain('javascript:');
  });

  it('מסיר <foreignObject> (וקטור XSS ידוע ב-SVG — מאפשר HTML מלא בתוך SVG)', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body onload="alert(1)"><img src=x /></body></foreignObject><rect width="1" height="1"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean.toLowerCase()).not.toContain('foreignobject');
  });

  it('מסיר <use>/<image> (SSRF/מעקב חיצוני דרך href)', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/track.svg#x"/><rect width="1" height="1"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean.toLowerCase()).not.toContain('<use');
    expect(clean).not.toContain('evil.example');
  });

  it('שומר תוכן וקטורי לגיטימי (path/rect/circle) ללא שינוי מהותי', () => {
    const clean = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L10,10 Z"/></svg>',
    );
    expect(clean).toContain('<svg');
    expect(clean).toContain('path');
  });

  it('זורק SvgSanitizeError כשכל התוכן נחסם (רק תגיות אסורות)', () => {
    expect(() => sanitizeSvg('<script>alert(1)</script>')).toThrow(SvgSanitizeError);
  });
});
