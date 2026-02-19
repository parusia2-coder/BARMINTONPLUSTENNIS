import type { SportConfig } from './types'

export const tennisConfig: SportConfig = {
  sport: 'tennis',
  name: '테니스 대회 운영 시스템',
  nameEn: 'Tennis Tournament Management System',
  emoji: '🎾',
  icon: 'fa-baseball-ball',
  version: 'v1.0',

  categories: {
    ms: '남자단식',
    ws: '여자단식',
    md: '남자복식',
    wd: '여자복식',
    xd: '혼합복식'
  },
  supportsSingles: true,

  scoring: {
    defaultTargetScore: 8,
    tournamentTargetScore: 8,
    scoreUnit: '게임',
    scoreLabel: '스코어',
    swapInterval: 2,
    swapLabel: '체인지오버',
    swapDescription: '매 2게임 체인지오버',
    scoringTypes: [
      { value: 'pro8', label: '8게임 프로세트 (동호회 기본)' },
      { value: 'pro10', label: '10게임 프로세트' },
      { value: 'set2', label: '2세트 선취 (6게임)' },
      { value: 'set3', label: '3세트 선취 (정식)' },
      { value: 'custom', label: '사용자 정의' },
    ],
    deuceRules: [
      { value: 'tiebreak', label: '타이브레이크 (기본)' },
      { value: 'noad', label: '노어드 (듀스 없음)' },
      { value: 'advantage', label: '어드밴티지 (정식)' },
    ],
  },

  dbFields: {
    hasScoringType: true,
    hasTargetGames: true,
    hasDeuceRule: true,
  },

  theme: {
    primary: { 50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b' },
    secondary: { 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f' },
    primaryClass: 'emerald',
    secondaryClass: 'teal',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-emerald-600',
  },

  terms: {
    team: '팀',
    player: '선수',
    match: '경기',
    court: '코트',
    scoreBoard: '스코어보드',
    half1: '체인지',
    half2: '체인지',
    systemLabel: '테니스 대회 운영 시스템',
  },

  notifications: {
    matchStart: '🎾 경기 시작!',
    matchReady: '🎾 다음 경기 준비',
    testTitle: '🎾 알림 테스트',
    defaultTitle: '🎾 테니스 대회',
  },
}
