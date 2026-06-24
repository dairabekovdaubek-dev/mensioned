import { useMemo } from 'react';

export function useGameAssetPreload() {
  return useMemo(
    () => ({
      loaded: 0,
      total: 0,
      started: true,
      progress: 100,
      done: true,
    }),
    [],
  );
}
