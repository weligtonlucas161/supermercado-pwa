import { useState, useEffect } from 'react';

/**
 * Hook para debounce de valor (300ms a 500ms).
 * Evita disparar consultas repetidas no Supabase a cada tecla digitada.
 */
export function useDebounce<T>(value: T, delay: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
