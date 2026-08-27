# DigitalOcean Spaces 이미지 저장소

상품 및 리뷰의 새 이미지는 API 컨테이너에서 최적화한 뒤 `dayofftoday` Spaces
버킷에 저장하고 CDN URL을 DB에 기록합니다. Spaces 설정이 없거나
`SPACES_ENABLED=false`이면 기존 `/uploads` 로컬 저장 방식을 사용합니다.

## 운영 환경변수

Droplet의 `~/dayoff/.env.deploy`에 다음 값을 설정합니다. Access Key는
`dayofftoday` 버킷에 한정된 Read/Write/Delete 권한을 권장합니다.

```dotenv
SPACES_ENABLED=true
SPACES_REGION=sgp1
SPACES_BUCKET=dayofftoday
SPACES_ENDPOINT=https://sgp1.digitaloceanspaces.com
SPACES_CDN_URL=https://dayofftoday.sgp1.cdn.digitaloceanspaces.com
SPACES_ACCESS_KEY_ID=발급받은-access-key
SPACES_SECRET_ACCESS_KEY=발급받은-secret-key
```

Secret Key는 Git 저장소나 GitHub Actions 변수에 넣지 않습니다. 이 프로젝트는
Droplet의 `.env.deploy`에서 런타임에만 읽습니다.

## 배포 후 점검

관리자 토큰으로 아래 API를 호출하면 인증값을 노출하지 않고 설정 상태를 확인할
수 있습니다.

```sh
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  https://dayoff.today/shop/admin/storage/status
```

정상 응답은 `driver`가 `spaces`, `configured`가 `true`, `missingKeys`가 빈
배열입니다. 그다음 관리자 화면에서 테스트 이미지를 한 장 올리고 반환 URL과
브라우저 네트워크 요청이 `dayofftoday.sgp1.cdn.digitaloceanspaces.com`인지
확인합니다.

## 기존 이미지 이동

새 버전 배포 후 API 컨테이너에서 한 번 실행합니다.

```sh
docker compose -f docker-compose.prod.yml --env-file .env.deploy \
  exec api npm run storage:migrate
```

이 명령은 DB의 `/uploads/...` URL만 찾아 Spaces에 복사하고, 업로드가 성공한
행만 CDN URL로 변경합니다. 이미 CDN으로 전환된 URL은 건너뛰므로 재실행해도
됩니다. 로컬 원본은 삭제하지 않으므로 버킷과 실제 사이트 이미지를 확인할
때까지 `dayoff_uploads` 볼륨을 유지해야 합니다.

실패 건수가 0인지, 버킷의 객체 수가 증가했는지, 상품/리뷰 이미지가 정상적으로
보이는지 확인한 후에만 로컬 볼륨 제거를 별도 작업으로 진행합니다.
