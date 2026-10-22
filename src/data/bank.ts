import adults from './words/adults.json'
import all from './words/all.json'
import kids from './words/kids.json'
import teens from './words/teens.json'
import type { WordRecord } from '../core/types'

export const bank = [...all, ...kids, ...teens, ...adults] as WordRecord[]
