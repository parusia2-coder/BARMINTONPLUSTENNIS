// ==========================================
// 스포츠 설정 타입 정의
// 새 스포츠 추가 시 이 인터페이스를 구현하면 됩니다
// ==========================================

export interface SportConfig {
  // 기본 정보
  sport: 'badminton' | 'tennis'
  name: string           // "배드민턴 대회 운영 시스템"
  nameEn: string         // "Badminton Tournament Management System"
  emoji: string          // "🏸" or "🎾"
  icon: string           // FontAwesome 아이콘 클래스
  version: string

  // 카테고리 (종목)
  categories: Record<string, string>  // { md: '남자복식', ... }
  supportsSingles: boolean

  // 스코어링
  scoring: {
    defaultTargetScore: number     // 배드민턴: 25, 테니스: 8
    tournamentTargetScore: number  // 배드민턴: 21, 테니스: 8
    scoreUnit: string              // "점" or "게임"
    scoreLabel: string             // "점수" or "스코어"
    swapInterval: number           // 교체 간격 (배드민턴: 중간점, 테니스: 2)
    swapLabel: string              // "교체" or "체인지오버"
    swapDescription: string        // "중간 교체" or "매 2게임 체인지오버"
    scoringTypes?: { value: string, label: string }[]  // 테니스 전용
    deuceRules?: { value: string, label: string }[]    // 테니스 전용
  }

  // DB 스키마 추가 필드
  dbFields: {
    hasScoringType: boolean
    hasTargetGames: boolean
    hasDeuceRule: boolean
  }

  // UI 테마
  theme: {
    primary: Record<string, string>    // Tailwind 커스텀 색상
    secondary: Record<string, string>
    primaryClass: string               // "blue" or "emerald"
    secondaryClass: string             // "indigo" or "teal"
    gradientFrom: string               // "from-blue-500"
    gradientTo: string                 // "to-blue-600"
  }

  // 텍스트/용어
  terms: {
    team: string          // "팀" (복식) - 단식 시 "선수"로 동적 변경
    player: string        // "선수"
    match: string         // "경기"
    court: string         // "코트"
    scoreBoard: string    // "점수판" or "스코어보드"
    half1: string         // "전반" or 체인지오버 관련
    half2: string         // "후반"
    systemLabel: string   // "배드민턴 대회 운영 시스템"
  }

  // 알림
  notifications: {
    matchStart: string    // "🏸 경기 시작!" or "🎾 경기 시작!"
    matchReady: string    // "🏸 다음 경기 준비" or "🎾 다음 경기 준비"
    testTitle: string     // "🏸 알림 테스트"
    defaultTitle: string  // "🏸 배드민턴 대회"
  }
}
