import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = join(__dirname, '..');
const DEV_SOURCE = join(PROJECT_ROOT, 'index.html');
const PROD_SOURCE = join(PROJECT_ROOT, 'index.production.html');
const HEADERS_SOURCE = join(PROJECT_ROOT, '_headers');
const DIST_INDEX = join(PROJECT_ROOT, 'dist', 'index.html');
const DIST_HEADERS = join(PROJECT_ROOT, 'dist', '_headers');
const ANGULAR_JSON = join(PROJECT_ROOT, 'angular.json');

function extractCsp(html: string): string {
  const match = html.match(
    /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(?:"([^"]+)"|'([^']+)')/i
  );
  const csp = match?.[1] ?? match?.[2];
  if (!csp) {
    throw new Error('No Content-Security-Policy <meta> tag found');
  }
  return csp;
}

function parseDirectives(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const raw of csp.split(';')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const [name, ...sources] = trimmed.split(/\s+/);
    if (name) directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

function extractHeader(headers: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = headers.match(new RegExp(`^\\s*${escapedName}:\\s*(.+)$`, 'im'));
  const value = match?.[1]?.trim();
  if (!value) {
    throw new Error(`No ${name} header found`);
  }
  return value;
}

describe('Production CSP (T3)', () => {
  describe('index.html development source', () => {
    let directives: Map<string, string[]>;

    beforeAll(() => {
      const html = readFileSync(DEV_SOURCE, 'utf8');
      directives = parseDirectives(extractCsp(html));
    });

    it('does not include frame-ancestors because CSP meta tags cannot enforce it', () => {
      expect(directives.has('frame-ancestors')).toBe(false);
    });
  });

  describe('index.production.html source', () => {
    let csp: string;
    let directives: Map<string, string[]>;

    beforeAll(() => {
      const html = readFileSync(PROD_SOURCE, 'utf8');
      csp = extractCsp(html);
      directives = parseDirectives(csp);
    });

    it('defines a script-src directive', () => {
      expect(directives.has('script-src')).toBe(true);
    });

    it("does not allow 'unsafe-inline' in script-src", () => {
      const scriptSrc = directives.get('script-src') ?? [];
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    it("does not allow 'unsafe-eval' in script-src", () => {
      const scriptSrc = directives.get('script-src') ?? [];
      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });

    it('restricts script-src to self (no remote/CDN origins)', () => {
      const scriptSrc = directives.get('script-src') ?? [];
      const allowed = new Set(["'self'", "'strict-dynamic'"]);
      for (const source of scriptSrc) {
        if (source.startsWith("'nonce-") || source.startsWith("'sha")) continue;
        expect(allowed.has(source)).toBe(true);
      }
    });

    it('does not contain localhost / 127.0.0.1 / ws: origins in any directive', () => {
      expect(csp).not.toMatch(/localhost/i);
      expect(csp).not.toMatch(/127\.0\.0\.1/);
      expect(csp).not.toMatch(/(?:^|\s)ws:/);
      expect(csp).not.toMatch(/(?:^|\s)wss:/);
    });

    it('restricts connect-src to self', () => {
      const connectSrc = directives.get('connect-src') ?? [];
      expect(connectSrc).toEqual(["'self'"]);
    });

    it("sets object-src to 'none'", () => {
      expect(directives.get('object-src')).toEqual(["'none'"]);
    });

    it('does not include frame-ancestors because CSP meta tags cannot enforce it', () => {
      expect(directives.has('frame-ancestors')).toBe(false);
    });

    it("sets base-uri to 'self'", () => {
      expect(directives.get('base-uri')).toEqual(["'self'"]);
    });

    it('includes upgrade-insecure-requests', () => {
      expect(directives.has('upgrade-insecure-requests')).toBe(true);
    });
  });

  describe('angular.json production configuration', () => {
    it('uses index.production.html as the production index input', () => {
      const config = JSON.parse(readFileSync(ANGULAR_JSON, 'utf8'));
      const prodIndex = config.projects?.app?.architect?.build?.configurations?.production?.index;
      expect(prodIndex).toEqual({
        input: 'index.production.html',
        output: 'index.html',
      });
    });

    it('copies _headers into the production output', () => {
      const config = JSON.parse(readFileSync(ANGULAR_JSON, 'utf8'));
      const assets = config.projects?.app?.architect?.build?.options?.assets ?? [];
      expect(assets).toContain('_headers');
    });
  });

  describe('_headers deployment configuration', () => {
    let cspDirectives: Map<string, string[]>;
    let headers: string;

    beforeAll(() => {
      headers = readFileSync(HEADERS_SOURCE, 'utf8');
      cspDirectives = parseDirectives(extractHeader(headers, 'Content-Security-Policy'));
    });

    it('enforces frame-ancestors as an HTTP header directive', () => {
      expect(cspDirectives.get('frame-ancestors')).toEqual(["'none'"]);
    });

    it('sets clickjacking and baseline security headers', () => {
      expect(extractHeader(headers, 'X-Frame-Options')).toBe('DENY');
      expect(extractHeader(headers, 'X-Content-Type-Options')).toBe('nosniff');
      expect(extractHeader(headers, 'Referrer-Policy')).toBe('no-referrer');
    });
  });

  describe('dist/index.html (only when a production build exists)', () => {
    const distExists = existsSync(DIST_INDEX);
    const maybeIt = distExists ? it : it.skip;

    maybeIt('contains the strict production CSP', () => {
      const html = readFileSync(DIST_INDEX, 'utf8');
      const csp = extractCsp(html);
      const directives = parseDirectives(csp);

      const scriptSrc = directives.get('script-src') ?? [];
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");

      expect(csp).not.toMatch(/localhost/i);
      expect(csp).not.toMatch(/127\.0\.0\.1/);
      expect(csp).not.toMatch(/(?:^|\s)ws:/);
      expect(csp).not.toMatch(/(?:^|\s)wss:/);

      expect(directives.get('object-src')).toEqual(["'none'"]);
      expect(directives.has('frame-ancestors')).toBe(false);
      expect(directives.has('upgrade-insecure-requests')).toBe(true);
    });
  });

  describe('dist/_headers (only when a production build exists)', () => {
    const distExists = existsSync(DIST_HEADERS);
    const maybeIt = distExists ? it : it.skip;

    maybeIt('contains the HTTP-only frame-ancestors directive', () => {
      const headers = readFileSync(DIST_HEADERS, 'utf8');
      const directives = parseDirectives(extractHeader(headers, 'Content-Security-Policy'));
      expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    });
  });
});
