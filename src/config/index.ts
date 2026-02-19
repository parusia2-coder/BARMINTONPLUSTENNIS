// ==========================================
// 스포츠 설정 로더
// 빌드 시 SPORT 환경변수로 선택: SPORT=tennis npm run build
// 기본값: badminton
// ==========================================

import type { SportConfig } from './types'
import { badmintonConfig } from './badminton'
import { tennisConfig } from './tennis'

// Vite가 빌드 시 __SPORT__를 문자열로 치환합니다
declare const __SPORT__: string
const SPORT = typeof __SPORT__ !== 'undefined' ? __SPORT__ : 'badminton'

const configs: Record<string, SportConfig> = {
  badminton: badmintonConfig,
  tennis: tennisConfig,
}

export const sportConfig: SportConfig = configs[SPORT] || badmintonConfig

// 편의 re-export
export type { SportConfig } from './types'
export { badmintonConfig } from './badminton'
export { tennisConfig } from './tennis'
