import { describe, expect, it } from 'vitest'
import { ageOn, isValidBirthDate, profileForAge, profileOf, todayIso } from './age'

const at = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d)
}
const TODAY = at('2026-10-23')

describe('edad y perfil', () => {
  it('cuenta los años cumplidos: el cumpleaños suma ese mismo día', () => {
    expect(ageOn('2000-10-23', TODAY)).toBe(26)
    expect(ageOn('2000-10-24', TODAY)).toBe(25)
    expect(ageOn('2000-10-22', TODAY)).toBe(26)
    expect(ageOn('2000-12-31', TODAY)).toBe(25)
    expect(ageOn('2026-10-23', TODAY)).toBe(0)
  })
  it('el 29 de febrero se celebra el 1 de marzo en los años no bisiestos', () => {
    expect(ageOn('2000-02-29', at('2026-02-28'))).toBe(25)
    expect(ageOn('2000-02-29', at('2026-03-01'))).toBe(26)
  })
  it('asigna el perfil con los rangos pedidos, en los dos extremos de cada tramo', () => {
    const casos: [number, string][] = [
      [0, 'kids'], [13, 'kids'], [14, 'teens'], [22, 'teens'],
      [23, 'young'], [38, 'young'], [39, 'adults'], [45, 'adults'], [110, 'adults'],
    ]
    for (const [edad, perfil] of casos) expect(profileForAge(edad)).toBe(perfil)
  })
  it('el perfil cambia el día que se cumple la edad límite', () => {
    // Nace el 2012-10-24: el 23-10-2026 tiene 13 años (niño); al día siguiente cumple 14 (adolescente).
    expect(profileOf({ birthDate: '2012-10-24' }, TODAY)).toBe('kids')
    expect(profileOf({ birthDate: '2012-10-24' }, at('2026-10-24'))).toBe('teens')
    // Nace el 1987-10-24: hoy tiene 38 años (joven); mañana cumple 39 (adulto).
    expect(profileOf({ birthDate: '1987-10-24' }, TODAY)).toBe('young')
    expect(profileOf({ birthDate: '1987-10-24' }, at('2026-10-24'))).toBe('adults')
  })
  it('valida fechas: formato, calendario, futuras y anteriores a 1900', () => {
    expect(isValidBirthDate('1980-05-17', TODAY)).toBe(true)
    expect(isValidBirthDate('2026-10-23', TODAY)).toBe(true)
    expect(isValidBirthDate('2026-10-24', TODAY)).toBe(false)
    expect(isValidBirthDate('2023-02-31', TODAY)).toBe(false)
    expect(isValidBirthDate('1899-12-31', TODAY)).toBe(false)
    expect(isValidBirthDate('17/05/1980', TODAY)).toBe(false)
    expect(isValidBirthDate('', TODAY)).toBe(false)
    expect(ageOn('2099-01-01', TODAY)).toBeNull()
  })
  it('los jugadores sin fecha conservan su perfil anterior, o adultos si no tienen ninguno', () => {
    expect(profileOf({ profile: 'kids' }, TODAY)).toBe('kids')
    expect(profileOf({}, TODAY)).toBe('adults')
    expect(profileOf({ birthDate: 'basura', profile: 'teens' }, TODAY)).toBe('teens')
  })
  it('todayIso da la fecha local en el formato del selector', () => {
    expect(todayIso(at('2026-01-05'))).toBe('2026-01-05')
  })
})
