import type { SportConfig } from './types'

export const badmintonConfig: SportConfig = {
  sport: 'badminton',
  name: '배드민턴 대회 운영 시스템',
  nameEn: 'Badminton Tournament Management System',
  emoji: '🏸',
  icon: 'fa-shuttlecock',
  version: 'v3.2',

  categories: {
    md: '남자복식',
    wd: '여자복식',
    xd: '혼합복식'
  },
  supportsSingles: false,

  scoring: {
    defaultTargetScore: 25,
    tournamentTargetScore: 21,
    scoreUnit: '점',
    scoreLabel: '점수',
    swapInterval: 0,  // 중간점 자동 계산
    swapLabel: '교체',
    swapDescription: '중간 교체',
  },

  dbFields: {
    hasScoringType: false,
    hasTargetGames: false,
    hasDeuceRule: false,
  },

  theme: {
    primary: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a' },
    secondary: { 50:'#fdf4ff',100:'#fae8ff',200:'#f5d0fe',300:'#f0abfc',400:'#e879f9',500:'#d946ef',600:'#c026d3',700:'#a21caf',800:'#86198f',900:'#701a75' },
    primaryClass: 'blue',
    secondaryClass: 'indigo',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-600',
  },

  terms: {
    team: '팀',
    player: '선수',
    match: '경기',
    court: '코트',
    scoreBoard: '점수판',
    half1: '전반',
    half2: '후반',
    systemLabel: '배드민턴 대회 운영 시스템',
  },

  notifications: {
    matchStart: '🏸 경기 시작!',
    matchReady: '🏸 다음 경기 준비',
    testTitle: '🏸 알림 테스트',
    defaultTitle: '🏸 배드민턴 대회',
  },
}
