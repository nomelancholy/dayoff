# 운영 서버 로그 확인

운영 서버에서 프로젝트 디렉터리로 이동한 뒤 아래 명령을 실행합니다.

```sh
./deploy/api-logs.sh
```

기본적으로 API 서버의 최근 200줄을 출력하고 새 로그를 계속 표시합니다. 종료는
`Ctrl+C`입니다. 더 많은 로그가 필요하면 다음과 같이 실행합니다.

```sh
LOG_TAIL=1000 ./deploy/api-logs.sh
```

스크립트를 사용하지 않을 때의 동일한 명령은 다음과 같습니다.

```sh
docker compose -f docker-compose.prod.yml --env-file .env.deploy \
  logs --tail=200 -f api
```

HTTP 500 오류는 요청 방식, 쿼리 문자열을 제외한 요청 경로, 오류 메시지와 스택을
API 컨테이너 로그에 기록합니다. 요청 본문과 인증 헤더는 기록하지 않습니다.

API 로그는 컨테이너별 최대 10MB 파일 5개로 순환 보관됩니다.

Postgres와 Nginx 로그도 동일하게 최대 10MB 파일 5개로 순환 보관됩니다. 배포
워크플로는 새 이미지를 받기 전후에 사용하지 않는 Docker 이미지와 빌드 캐시를
정리하며, 데이터 볼륨은 삭제하지 않습니다.

## 이미지 저장소

DigitalOcean Spaces 환경변수, 설정 점검, 기존 이미지 이전 절차는
[`SPACES_SETUP.md`](./SPACES_SETUP.md)를 참고합니다. 이전이 끝나고 사이트에서
검증되기 전까지 `dayoff_uploads` 볼륨을 삭제하지 마세요.

## 네이버페이

결제형 인증값, GitHub 빌드 변수, 검수 및 비상 비활성화 절차는
[`NAVER_PAY_SETUP.md`](./NAVER_PAY_SETUP.md)를 참고합니다.
