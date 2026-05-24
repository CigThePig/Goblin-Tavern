// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Section composers for the daily service-log Traffic / Service /
// Drivers lines. Connector-only voicing: the figures (patron count,
// group count, coin, unpaid tabs) and the driver name all stay
// structural; only the leading verb / phrase is voiced.

import type { ReportSection } from '../../../cards/compose/reports'
import { buildReportSeed } from '../../../cards/compose/reports'
import { assembleSlots } from '../../../cards/compose/assemble'
import type { SlotSpec } from '../../../cards/compose/types'
import type { TavernState } from '../../../sim/state/TavernState'
import {
  serviceLogDriverPhrasePool,
  serviceLogServiceVerbPool,
  serviceLogTrafficVerbPool,
} from '../pools/serviceLog'

const TRAFFIC_VERB_BUDGET = 2
const SERVICE_VERB_BUDGET = 2
const DRIVER_PHRASE_BUDGET = 3

export const serviceLogTrafficSlots: readonly SlotSpec[] = [
  {
    id: 'verb',
    role: 'aside',
    pool: serviceLogTrafficVerbPool,
    optional: false,
    wordBudget: TRAFFIC_VERB_BUDGET,
    claimMode: 'flavor',
  },
]

export const serviceLogServiceSlots: readonly SlotSpec[] = [
  {
    id: 'verb',
    role: 'aside',
    pool: serviceLogServiceVerbPool,
    optional: false,
    wordBudget: SERVICE_VERB_BUDGET,
    claimMode: 'flavor',
  },
]

export const serviceLogDriverSlots: readonly SlotSpec[] = [
  {
    id: 'phrase',
    role: 'aside',
    pool: serviceLogDriverPhrasePool,
    optional: false,
    wordBudget: DRIVER_PHRASE_BUDGET,
    claimMode: 'flavor',
  },
]

export const serviceLogTrafficSection: ReportSection = {
  id: 'daily.service_log.traffic',
  voiceRegister: 'tavern_floor',
  slots: serviceLogTrafficSlots,
}

export const serviceLogServiceSection: ReportSection = {
  id: 'daily.service_log.service',
  voiceRegister: 'tavern_floor',
  slots: serviceLogServiceSlots,
}

export const serviceLogDriverSection: ReportSection = {
  id: 'daily.service_log.driver',
  voiceRegister: 'tavern_floor',
  slots: serviceLogDriverSlots,
}

/** Maps traffic total to the routing tag for the traffic verb pool. */
export function trafficVolumeTag(trafficTotal: number): string {
  if (trafficTotal <= 20) return 'traffic_low'
  if (trafficTotal > 60) return 'traffic_high'
  return 'traffic_mid'
}

/** Maps a non-zero net coin amount to the routing tag for the service
 *  verb pool. Loss is detected by sign; gain bands at ≤30 / 31-100 / >100. */
export function serviceCoinTag(netCoin: number): string {
  if (netCoin < 0) return 'service_loss'
  if (netCoin <= 30) return 'service_gain_small'
  if (netCoin > 100) return 'service_gain_large'
  return 'service_gain_mid'
}

export type TrafficLineInput = {
  state: TavernState
  closedDay: number
  trafficTotal: number
  groupCount: number
}

export type ServiceLineInput = {
  state: TavernState
  closedDay: number
  netCoin: number
  unpaidTabs: number
}

export type DriverLineInput = {
  state: TavernState
  closedDay: number
  driverName: string
  direction: 'positive' | 'negative'
}

/** Composes the voiced Traffic line. Structure:
 *  `${verb} ${trafficTotal} patrons across ${groupCount} groups.` */
export function composeTrafficLine(input: TrafficLineInput): string {
  const seed = buildReportSeed({
    sectionId: 'daily.service_log.traffic',
    periodKey: `d${input.closedDay}.traffic`,
    timing: 'closing',
    domain: [trafficVolumeTag(input.trafficTotal)],
  })
  const filled = assembleSlots(serviceLogTrafficSlots, seed, input.state)
  const verb = filled['verb'] ?? 'Served'
  return `${verb} ${input.trafficTotal} patrons across ${input.groupCount} groups.`
}

/** Composes the voiced Service line. Structure:
 *  `${verb} ${netCoin} coin (${unpaidTabs} unpaid tabs).` Net coin is
 *  shown as its absolute value — the leading verb carries direction. */
export function composeServiceLine(input: ServiceLineInput): string {
  const seed = buildReportSeed({
    sectionId: 'daily.service_log.service',
    periodKey: `d${input.closedDay}.service`,
    timing: 'closing',
    domain: [serviceCoinTag(input.netCoin)],
  })
  const filled = assembleSlots(serviceLogServiceSlots, seed, input.state)
  const verb = filled['verb'] ?? 'Took'
  return `${verb} ${Math.abs(input.netCoin)} coin (${input.unpaidTabs} unpaid tabs).`
}

/** Composes the voiced Driver line. Structure:
 *  `${phrase} ${driverName}.` */
export function composeDriverLine(input: DriverLineInput): string {
  const seed = buildReportSeed({
    sectionId: 'daily.service_log.driver',
    periodKey: `d${input.closedDay}.driver.${input.direction}`,
    timing: 'closing',
    domain: [`driver_${input.direction}`],
  })
  const filled = assembleSlots(serviceLogDriverSlots, seed, input.state)
  const phrase = filled['phrase'] ?? 'Driven by'
  return `${phrase} ${input.driverName}.`
}
