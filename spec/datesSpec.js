const { isDay } = require('../lib/dates');

describe('isDay (validación de fechas)', () => {
  it('rechaza meses y días fuera de rango', () => {
    expect(isDay('2026-00-10')).toBeFalse();
    expect(isDay('2026-13-01')).toBeFalse();
    expect(isDay('2026-01-00')).toBeFalse();
    expect(isDay('2026-01-32')).toBeFalse();
  });

  it('rechaza fechas imposibles del calendario', () => {
    expect(isDay('2026-02-30')).toBeFalse();
    expect(isDay('2026-02-29')).toBeFalse();
    expect(isDay('1900-02-29')).toBeFalse();
  });

  it('acepta fechas reales y años bisiestos', () => {
    expect(isDay('2026-12-31')).toBeTrue();
    expect(isDay('2024-02-29')).toBeTrue();
    expect(isDay('2000-02-29')).toBeTrue();
  });

  it('conserva años de cuatro cifras bajos sin remapearlos', () => {
    expect(isDay('0000-01-01')).toBeTrue();
    expect(isDay('0099-01-01')).toBeTrue();
  });

  it('rechaza tipos que no son cadenas', () => {
    for (const valor of [null, undefined, 20260101, new Date('2026-01-01'), ['2026-01-01'], {}, true]) {
      expect(isDay(valor)).toBeFalse();
    }
  });

  it('rechaza formatos incompletos, espacios y basura', () => {
    for (const valor of ['', '2026-1-01', '2026-01-1', '26-01-01', '2026-01', '2026/01/01',
      '2026-01-01T00:00:00Z', ' 2026-01-01', '2026-01-01 ', '2026-01-01\n', 'fecha', '2026-AB-01']) {
      expect(isDay(valor)).toBeFalse();
    }
  });

  it('siempre devuelve boolean y no lanza RangeError', () => {
    for (const valor of ['2026-13-01', '2026-00-00', '2026-01-32', '2026-02-30', '9999-99-99', '0000-00-00']) {
      expect(() => isDay(valor)).not.toThrow();
      expect(typeof isDay(valor)).toBe('boolean');
    }
  });
});
