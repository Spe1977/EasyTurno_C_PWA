import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = join(__dirname, '..');
const PACKAGE_JSON_PATH = join(PROJECT_ROOT, 'package.json');
const CI_WORKFLOW_PATH = join(PROJECT_ROOT, '.github', 'workflows', 'ci.yml');
const ANGULAR_JSON_PATH = join(PROJECT_ROOT, 'angular.json');

interface PackageJson {
  engines?: {
    node?: string;
    npm?: string;
  };
  scripts?: Record<string, string>;
}

interface AngularBudget {
  type: string;
  maximumWarning?: string;
  maximumError?: string;
}

interface AngularConfig {
  projects?: {
    app?: {
      architect?: {
        build?: {
          defaultConfiguration?: string;
          configurations?: {
            production?: {
              budgets?: AngularBudget[];
            };
          };
        };
      };
    };
  };
}

describe('CI Alignment, Node Engines & Bundle Budgets (Fase 6 Step 6.1)', () => {
  let pkg: PackageJson;
  let ciYml: string;
  let angularConfig: AngularConfig;

  beforeAll(() => {
    pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as PackageJson;
    ciYml = readFileSync(CI_WORKFLOW_PATH, 'utf8');
    angularConfig = JSON.parse(readFileSync(ANGULAR_JSON_PATH, 'utf8')) as AngularConfig;
  });

  describe('package.json engines and scripts', () => {
    it('aligns engines.node with Angular 22 LTS tracks and local Node 26+', () => {
      expect(pkg.engines?.node).toBe('^22.22.3 || ^24.15.0 || >=26.0.0');
      expect(pkg.engines?.npm).toBe('>=10.0.0');
    });

    it('contains no deprecated Cypress scripts', () => {
      const scripts = pkg.scripts ?? {};
      expect(scripts['e2e']).toBeUndefined();
      expect(scripts['cypress:open']).toBeUndefined();
      expect(scripts['cypress:run']).toBeUndefined();
    });
  });

  describe('.github/workflows/ci.yml', () => {
    it('tests both Node 22.x and 24.x in the test matrix without --legacy-peer-deps', () => {
      expect(ciYml).toMatch(/node-version:\s*\[22\.x,\s*24\.x\]/);
      expect(ciYml).not.toContain('--legacy-peer-deps');
    });

    it('runs post-build CSP checks after npm run build', () => {
      const buildIdx = ciYml.indexOf('npm run build');
      const postBuildCspIdx = ciYml.indexOf('npx jest scripts/check-csp.spec.ts');
      expect(buildIdx).toBeGreaterThan(-1);
      expect(postBuildCspIdx).toBeGreaterThan(buildIdx);
    });

    it('runs TypeScript checks for app and Playwright specs', () => {
      expect(ciYml).toContain('npx tsc --noEmit');
      expect(ciYml).toContain('npx tsc -p playwright/tsconfig.json --noEmit');
    });

    it('avoids upload-artifact name collisions across matrix Node versions', () => {
      expect(ciYml).toMatch(/name:\s*dist-node-\$\{\{\s*matrix\.node-version\s*\}\}/);
    });

    it('runs Firebase emulator checks with JDK 21', () => {
      expect(ciYml).toContain('actions/setup-java@v4');
      expect(ciYml).toMatch(/java-version:\s*['"]?21['"]?/);
      expect(ciYml).toContain('npm run test:firebase');
    });

    it('runs Playwright E2E on Node 24.x LTS', () => {
      const playwrightSection = ciYml.slice(ciYml.indexOf('playwright:'));
      expect(playwrightSection).toMatch(/node-version:\s*['"]?24\.x['"]?/);
      expect(playwrightSection).toContain('npm run test:pw');
    });
  });

  describe('angular.json bundle budgets', () => {
    it('enforces production budgets by default during npm run build', () => {
      const build = angularConfig.projects?.app?.architect?.build;
      expect(build?.defaultConfiguration).toBe('production');

      const budgets = build?.configurations?.production?.budgets ?? [];
      expect(budgets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'initial',
            maximumWarning: '450kB',
            maximumError: '600kB',
          }),
          expect.objectContaining({
            type: 'anyComponentStyle',
            maximumWarning: '4kB',
            maximumError: '8kB',
          }),
        ])
      );
    });
  });
});
