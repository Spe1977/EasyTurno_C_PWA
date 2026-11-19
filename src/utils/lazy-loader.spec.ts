import { createLazyLoader } from './lazy-loader';

describe('createLazyLoader', () => {
  it('memoizes the resolved value and coalesces concurrent calls', async () => {
    const loader = jest.fn().mockResolvedValue({ sdk: 'ready' });
    const load = createLazyLoader(loader);

    const [a, b] = await Promise.all([load(), load()]);
    const c = await load();

    expect(a).toEqual({ sdk: 'ready' });
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('clears cached promise on failure so subsequent calls can retry', async () => {
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce('recovered');
    const load = createLazyLoader(loader);

    await expect(load()).rejects.toThrow('network down');
    await expect(load()).resolves.toBe('recovered');
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
