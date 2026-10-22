import { bank } from '../src/data/bank'
import { validateBank } from '../src/data/validate'

const issues = validateBank(bank)
for (const i of issues) console.log(`${i.level === 'error' ? 'ERROR' : 'aviso'} ${i.id ?? ''} ${i.message}`)
console.log(`${bank.length} registros | ${issues.filter((i) => i.level === 'error').length} errores | ${issues.filter((i) => i.level === 'warning').length} avisos`)
process.exit(issues.some((i) => i.level === 'error') ? 1 : 0)
