/** Returns a typed setter: patch("key", value) -> onChange({...value, key: value}). */
export function patcher<T extends object>(value: T, onChange: (next: T) => void) {
  return <K extends keyof T>(key: K, v: T[K]) => onChange({ ...value, [key]: v });
}
