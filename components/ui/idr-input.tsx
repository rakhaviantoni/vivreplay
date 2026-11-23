'use client';

import type { InputHTMLAttributes } from 'react';

export function formatIdrDigits(value: string | number | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
}

export function parseIdrDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

type IdrInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string | number;
  onValueChange: (digits: string) => void;
};

export function IdrInput({ value, onValueChange, ...props }: IdrInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatIdrDigits(value)}
      onChange={(event) => onValueChange(parseIdrDigits(event.target.value))}
    />
  );
}
