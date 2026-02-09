/**
 * 마이그레이션용 집합: 각 feature의 schema를 re-export.
 * Drizzle Kit은 이 파일을 참조하며, 실제 테이블 정의는 app/features/[feature]/schema/ 에 위치.
 */
export * from '../../features/auth/schema'
export * from '../../features/shop/schema'
export * from '../../features/coupon/schema'
export * from '../../features/order/schema'
export * from '../../features/class/schema'
export * from '../../features/contact/schema'
