# 네이버페이 주문관리 API / 재고 동기화

## 현재 범위

공식 명세: https://sandbox-api.pay.naver.com/npay/partner (애플리케이션 인증 필요).
2026-10-17 조회한 주문관리 API 1.10.0 명세 기준입니다.
운영 키 발급 절차: https://github.com/npay-mall-order-api/merchant-order-api

- OAuth SELF 인증: bcrypt(clientId_timestamp, clientSecret) → Base64 서명. 토큰 메모리 캐시 및 GW.AUTHN 1회 갱신.
- 변경 상품 주문 목록 → 상품 주문 상세 조회. 100건씩 페이징, 상세 누락 시 실패 처리.
- 60초 주기, 30초 지연, 최근 5분 중복 조회. 중단 후 저장된 시점부터 15분 단위로 따라잡음.
- 여러 서버/관리자 동시 실행은 PostgreSQL advisory lock으로 직렬화.
- 재고·원장·조회 시점을 하나의 트랜잭션으로 저장. 오류 발생 시 전부 rollback, 다음 주기에 재시도.
- 고객 이름·주소·전화번호·원문 응답은 저장/로그 출력하지 않음.

## 재고 반영 규칙

상품 전체 공유 재고를 사용하며 Npay 22자 상품 번호를 사이트 상품 UUID로 변환합니다.
PAYED/배송/구매확정 상태의 결제 수량을 차감합니다. 결제 대기와 미결제 취소는 차감하지 않습니다.
완료된 CANCEL_DONE/ADMIN_CANCEL_DONE 수량만 복원합니다. 취소 요청·처리 중에는 복원하지 않습니다.
부분취소는 완료 클레임 ID 중복을 검사하고 누적 완료 수량을 비교합니다.
반품/교환은 원장에 수동 확인 필요로 표시하며 자동 재입고하지 않습니다.
실제 상품 회수·상태 점검 후 관리자가 재고를 조정해야 합니다.

중복 조회는 이미 적용한 수량과 새 수량의 차이만 반영합니다.
결제 완료 후 조회까지 짧은 지연이 있으므로 동시 구매의 초과판매를 완전히 방지하는 예약 재고 기능은 아닙니다.
초과판매 시 음수 재고를 유지해 이후 일부 취소가 가짜 가용 재고를 만들지 않게 합니다. 구매는 재고 0 이하에서 차단됩니다.

## 환경 격리와 설정

`NAVER_ORDER_MODE`는 구매 버튼 환경이며 계속 production으로 유지합니다.
`NAVER_ORDER_API_MODE`는 주문관리 환경입니다. 두 설정은 독립적입니다.

| 변수 | 역할 |
| --- | --- |
| NAVER_ORDER_API_MODE | sandbox 또는 production |
| NAVER_ORDER_API_CLIENT_ID | 페이센터 API 관리의 애플리케이션 ID |
| NAVER_ORDER_API_CLIENT_SECRET | 전체 bcrypt 시크릿. .env에서는 작은따옴표로 감싸 $ 유지 |
| NAVER_ORDER_SYNC_ENABLED | true일 때 조회 작업 실행 |
| NAVER_ORDER_SYNC_START_AT | ISO 8601 시간대 포함 고정 시작 시각 |
| NAVER_ORDER_INVENTORY_ENABLED | true일 때만 운영 재고 변경. sandbox에서는 강제 거부 |

Sandbox는 `naver_order_inventory`의 mode=sandbox에만 시뮬레이션을 기록하고 applied_consumed=0을 유지합니다.
실제 products 재고는 쓰지 않습니다. 운영 DB에도 CHECK 제약으로 sandbox 차감을 금지합니다.
`naver_order_sync_state`에 앱/가맹점 해시, 시작 시각, 반영 정책을 고정합니다.
실행 후 정책/앱/시작 시점을 바꾸면 SYNC_CONFIGURATION_CHANGED로 중단합니다. 임의로 원장을 삭제하지 마세요.

## 배포 및 진단

일반 배포는 동기화를 기본 비활성화합니다. DB 백업 후 0012 마이그레이션을 적용합니다.
`Configure Npay order API sandbox` 수동 workflow는 다음 두 값을 담은 JSON을 Base64로 인코딩한
임시 GitHub Secret `NPAY_ORDER_API_SETUP_B64`를 사용합니다.

- NAVER_ORDER_API_CLIENT_ID
- NAVER_ORDER_API_CLIENT_SECRET

키를 로그/코드에 남기지 않고 서버 .env.deploy에 설치합니다. 체크 실패 시 기존 환경으로 복구합니다.
전달이 끝나면 임시 GitHub Secret을 삭제합니다. 서버 환경 백업은 0600 권한으로 보존합니다.
이 workflow로는 production API 또는 운영 재고 반영을 켤 수 없습니다.

운영 서버의 API 컨테이너에서 `node scripts/check-npay-order-api.cjs`를 실행하면
인증·최근 1시간 변경 주문·(주문이 있을 때) 상세 조회만 검증합니다. 결과는 건수/성공 여부만 출력합니다.
0건 응답은 연결 성공만 의미하며 실제 결제·취소 동기화 검수를 대체하지 않습니다.

관리자 JWT 전용 경로:
- GET /shop/admin/naver-order/sync: 환경, 마지막 성공/오류, 처리 시점, 최근 30건 수량/상태
- POST /shop/admin/naver-order/sync: 다음 조회 구간을 수동 실행 (본문 없음)

주요 오류: GW.IP_NOT_ALLOWED(등록된 호출 IP 확인), GW.AUTHN(인증), UNMAPPED_PRODUCT(상품 연결),
MISSING_ORDER_DETAILS(상세 누락), ORDER_STATE_REGRESSION(이전 상태로 역행), SYNC_PAGE_LIMIT(한 구간 2000건 초과).
오류를 해결하기 전 처리 위치를 수동으로 건너뛰지 마세요. 상태 확인 시 커서가 현재보다 계속 뒤처지는지도 확인합니다.

## Sandbox 검수 후 운영 전환

1. 네이버 Sandbox에서 결제/부분취소/전체취소 주문으로 API 응답과 원장 수량을 확인하고 API 검수를 요청합니다.
2. 기술지원에서 Production 애플리케이션 ID/시크릿을 별도로 발급받습니다.
3. 진행 중인 주문과 사이트 실제 재고를 대조하고 수동 반영을 마감할 기준 시각을 정합니다.
4. 새 운영 키, API_MODE=production, SYNC_START_AT=기준 시각, SYNC_ENABLED=true,
   INVENTORY_ENABLED=true를 함께 적용합니다. 이 작업은 이번 Sandbox workflow로 수행하지 않습니다.
5. 기준 시각 이후 결제만 자동 차감합니다. 기준 이전 결제의 이후 취소/반품도 수동 처리합니다.
6. 생산 환경에서 최초 차감/취소 복원 결과와 조회 지연을 확인한 후 일반 운영으로 전환합니다.

자동 반영을 비상 중지하려면 SYNC_ENABLED=false 후 API를 재생성합니다.
재개할 때 동일 원장/시작 시각을 유지해야 중복 차감을 막습니다.
중지 중 수동으로 처리한 재고는 재개 전 원장과 대조해야 합니다.

## 자동 검증

- 단위 테스트: 토큰 서명/캐시/갱신, 민감정보 오류 제거, 상세 누락 차단, 상태/부분취소/반품 변환.
- PostgreSQL 테스트: 중복 수집, 부분/전체 취소, sandbox 격리, 중간 실패 rollback,
  다중 worker 잠금, 기존 수동 주문 제외, 반품 보류, 상품 누락/설정 변경 차단, 관리자 접근권한.

외부 서비스에 연결하지 않는 전용 로컬 테스트 DB에서 실행합니다.

## 관리자 샌드박스 주문 페이지

`https://dayoff.today/admin/npay-test` — 기존 관리자 소셜 로그인 후 접근합니다.
별도 테스트 상품을 공개 등록하지 않고 판매 상품/옵션을 골라 테스트 주문서를 만듭니다.
JWT + admin 권한을 서버에서 확인하며, API_MODE=sandbox이고 INVENTORY_ENABLED가 true가 아닐 때만 작동합니다.
독립된 주문 클라이언트가 test-api로 등록하므로 일반 구매의 production 설정은 바뀌지 않습니다.
운영 API로 전환하면 이 페이지의 주문/조회 기능은 자동으로 차단됩니다.

1. 상품/옵션/수량 선택 → 샌드박스 주문서 만들기 → 새 창 열기.
2. 네이버 계정으로 테스트 주문 결제. 결제/취소를 대신 실행하지 않습니다.
3. 페이지로 돌아와 API 조회 버튼 클릭. 최근 24시간 변경 주문 최대 100건 + 상세 조회.
4. 실제 응답 GNCP-GW-Trace-ID 두 값을 화면에서 복사하여 검수 요청에 사용.
5. 테스트 구매내역에서 취소 완료 후 재조회. 백그라운드 sandbox 원장의 수량은 별도로 확인.

조회 버튼은 재고/원장을 쓰지 않습니다. 고객 개인정보/응답 원문은 화면과 로그에 표시하지 않습니다.
0건이면 변경 조회 Trace만 나오며 상세 조회 성공으로 표시하지 않습니다.


## 운영 API 최초 활성화 절차 (2026-10-21)

`Activate Npay production order API` workflow는 기존 판매 주문이 없고 관리자 재고가 실제 수량이라는
운영자의 확인을 전제로 합니다. 쿠폰 결제 기능은 변경하지 않습니다.

- 임시 Secret `NPAY_ORDER_API_PRODUCTION_SETUP_B64`: 운영 ID/시크릿 두 필드만 담은 JSON의 Base64.
  Base64는 암호화가 아니며 GitHub Secret 저장 시 암호화됩니다. 값은 로그·코드에 출력하지 않습니다.
- DB 백업 검증 후 운영 인증정보를 서버 `.env.deploy`에 설치합니다. 이 단계는 동기화/재고 쓰기를 모두 끕니다.
- 기존 production 원장이 있으면 재활성화하지 않습니다. 최근 30일 변경 주문을 일 단위로 조회해
  한 건이라도 발견되면 재고 대조를 위해 중단하고 이전 환경을 복구합니다. 30일 이전 주문 부재까지 증명하지 않습니다.
- 조회 종료 시각(서버 현재 시각보다 30초 전)을 고정 기준으로 저장하고 주문/재고 동기화를 함께 켭니다.
  조회와 활성화 사이에 결제된 주문은 이후 동기화에 포함됩니다.
- 운영 상태, 기준 시각, 최근 성공/조회 지연, Sandbox 격리, 공개 구매 버튼을 검증합니다.
- 활성화 후 검증 실패 시 Sandbox로 되돌리거나 재고를 역보정하지 않습니다. 운영 키/기준 시각/원장을 유지하고
  동기화만 중지합니다. 원인 해결 후 같은 기준으로 재개해야 중복 차감을 막을 수 있습니다.
- 전달에 사용한 GitHub 임시 Secret은 성공/실패와 관계없이 작업 종료 시 삭제합니다.
- 실제 고객 결제·취소가 발생하기 전에는 운영 연결/조회 검증만 완료된 상태입니다.
  최초 실제 결제/취소 시 상품별 재고와 원장을 대조해야 합니다.

검증 명령:

```sh
python3 deploy/test_configure_npay_production.py
node --test server/scripts/preflight-npay-production.test.cjs
```
