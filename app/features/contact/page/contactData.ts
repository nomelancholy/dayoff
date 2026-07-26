/** 연락처·찾아오는 길 데이터 (추후 DB/API 연동 가능) */

export const CONTACT_INFO = {
  address: '서울 중구 마른내로4길 31-3 3층',
  email: 'eundi2c@naver.com',
  /** 인스타그램 프로필 URL */
  instagramUrl: 'https://www.instagram.com/dot_sej/',
  /** 블로그 URL */
  blogUrl: 'https://blog.naver.com/eundi2c',
} as const

/** 지도 마커/센터용 위경도 (네이버 지도 API) */
export const MAP_POSITION = {
  lat: 37.562823554,
  lng: 126.99361333732,
} as const

/** 지도에서 보기 링크 */
export const MAP_LINKS = {
  kakao: 'https://map.kakao.com/?q=을지로동+서울+공방',
  google: 'https://www.google.com/maps/search/을지로동+서울',
  /** 네이버 지도 짧은 링크 (마커 정보창용) */
  naver: 'https://naver.me/xVBDxK0Q',
} as const
