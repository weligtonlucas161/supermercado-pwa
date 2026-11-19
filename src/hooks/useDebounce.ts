import { useState, useEffect } from 'react';

/**
 * Hook reutilizável de Debounce para retardar consultas pesadas no Supabase
 * enquanto o usuário digita nos campos de busca ou altera filtros.
 *
 * @param value Valor de entrada
 * @param delayMs Tempo de atraso em milissegundos (padrão 400ms)
 */
export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
