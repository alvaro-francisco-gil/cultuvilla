import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// A <Tabs.Screen name> that matches no route file is ignored by expo-router,
// which then appends the real route with default options: no icon, wrong
// order. The village-first rename did exactly that to Mi pueblo and Perfil.
describe('tabs layout', () => {
  it('names only screens that exist as route files', () => {
    const dir = join(__dirname, '..');
    const routes = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx') && !f.startsWith('_'))
      .map((f) => f.replace(/\.tsx$/, ''));
    const source = readFileSync(join(dir, '_layout.tsx'), 'utf8');
    const names = [...source.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);

    expect(names.sort()).toEqual(routes.sort());
  });
});
