import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(PROJECT_ROOT, 'manifest.webmanifest');
const DEV_INDEX_PATH = join(PROJECT_ROOT, 'index.html');
const PROD_INDEX_PATH = join(PROJECT_ROOT, 'index.production.html');

interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

interface ManifestShortcut {
  name: string;
  short_name?: string;
  description?: string;
  url: string;
  icons?: ManifestIcon[];
}

interface WebAppManifest {
  id?: string;
  name?: string;
  short_name?: string;
  description?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  background_color?: string;
  theme_color?: string;
  orientation?: string;
  icons?: ManifestIcon[];
  shortcuts?: ManifestShortcut[];
  categories?: string[];
}

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  const pngMagic = '89504e470d0a1a0a';
  expect(buf.subarray(0, 8).toString('hex')).toBe(pngMagic);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

describe('PWA Manifest & Meta Tags (Fase 5 Step 5.4)', () => {
  let manifest: WebAppManifest;

  beforeAll(() => {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as WebAppManifest;
  });

  it('defines stable app identity, start_url, scope, standalone display, and theme colors', () => {
    expect(manifest.id).toBe('/');
    expect(manifest.name).toBe('EasyTurno');
    expect(manifest.short_name).toBe('EasyTurno');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#4f46e5');
    expect(manifest.background_color).toBe('#4f46e5');
  });

  it('references existing icon assets matching declared PNG dimensions and maskable purpose', () => {
    const icons = manifest.icons ?? [];
    expect(icons.length).toBeGreaterThanOrEqual(4);
    expect(icons.some(icon => icon.purpose === 'maskable' && icon.sizes === '512x512')).toBe(true);
    expect(icons.some(icon => icon.sizes === '192x192' && icon.type === 'image/png')).toBe(true);

    for (const icon of icons) {
      const iconPath = join(PROJECT_ROOT, icon.src);
      expect(existsSync(iconPath)).toBe(true);
      if (icon.type === 'image/png' && icon.sizes) {
        const [w, h] = icon.sizes.split('x').map(Number);
        const dims = readPngDimensions(iconPath);
        expect(dims).toEqual({ width: w, height: h });
      }
    }
  });

  it('defines valid shortcuts with existing icons', () => {
    const shortcuts = manifest.shortcuts ?? [];
    expect(shortcuts.length).toBeGreaterThanOrEqual(1);
    const addShiftShortcut = shortcuts.find(s => s.url === '/?action=add_shift');
    expect(addShiftShortcut).toBeDefined();
    for (const icon of addShiftShortcut?.icons ?? []) {
      expect(existsSync(join(PROJECT_ROOT, icon.src))).toBe(true);
    }
  });

  it.each([
    ['index.html', DEV_INDEX_PATH],
    ['index.production.html', PROD_INDEX_PATH],
  ])(
    '%s includes synchronized PWA meta tags, SVG icon, apple-touch-icon, and manifest link',
    (_label, htmlPath) => {
      const html = readFileSync(htmlPath, 'utf8');
      expect(html).toMatch(/<link\s+rel=["']manifest["']\s+href=["']manifest\.webmanifest["']/i);
      expect(html).toMatch(/<meta\s+name=["']theme-color["']\s+content=["']#4f46e5["']/i);
      expect(html).toMatch(
        /<meta\s+name=["']apple-mobile-web-app-capable["']\s+content=["']yes["']/i
      );
      expect(html).toMatch(
        /<meta\s+name=["']apple-mobile-web-app-title["']\s+content=["']EasyTurno["']/i
      );
      expect(html).toMatch(
        /<link\s+rel=["']apple-touch-icon["']\s+href=["']icons\/apple-touch-icon\.png["']/i
      );
      expect(html).toMatch(
        /<link\s+rel=["']icon["']\s+type=["']image\/svg\+xml["']\s+href=["']icon\.svg["']/i
      );
      expect(existsSync(join(PROJECT_ROOT, 'icons/apple-touch-icon.png'))).toBe(true);
      expect(readPngDimensions(join(PROJECT_ROOT, 'icons/apple-touch-icon.png'))).toEqual({
        width: 180,
        height: 180,
      });
    }
  );
});
