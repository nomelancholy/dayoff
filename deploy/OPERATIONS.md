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
