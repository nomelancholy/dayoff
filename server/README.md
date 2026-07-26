# Dayoff Server (NestJS)

디오티(DIOTI) 서비스 백엔드 서버입니다.  
NestJS + Drizzle ORM + PostgreSQL 기반으로 인증, 주문/결제, 관리자 기능을 제공합니다.

## 기술 스택

- NestJS 11
- TypeScript
- PostgreSQL
- Drizzle ORM / Drizzle Kit
- Passport (JWT, Google, Kakao, Naver)
- Naver Pay
- Resend (React Email 템플릿)

## 요구 사항

- Node.js 20+
- npm
- PostgreSQL (로컬 또는 Docker)

## 시작하기

```bash
cd "/Volumes/sub ssd/dev/dayoff/server"
npm install
```

## 실행

```bash
# 개발 (watch)
npm run start:dev

# 일반 실행
npm run start

# 프로덕션 빌드 실행
npm run build
npm run start:prod
```

## DB 작업

```bash
# 스키마 기준 SQL 마이그레이션 생성
npm run db:generate

# 코드 스키마를 DB에 바로 반영 (개발 편의)
npm run db:push

# 생성된 마이그레이션 적용
npm run db:migrate

# migrate 이력 부트스트랩
npm run db:bootstrap

# 샘플 데이터
npm run db:seed-example
npm run db:seed-orders

# DB Studio
npm run db:studio
```

## 메일 발송(Resend)

이 서버는 아래 이벤트에서 메일을 발송합니다.

- 회원가입 완료
- 주문 결제 완료
- 발송 완료

## 결제/주문 관련 참고

- 네이버페이 결제 생성: `POST /shop/checkout/naver`
- 네이버페이 결제 승인: `POST /shop/checkout/naver/confirm`
- 내 주문 취소(발송 전 paid 주문): `POST /shop/orders/:id/cancel`
- 주문 취소는 네이버페이 결제 취소 + 재고 원복 + 쿠폰 사용 롤백까지 처리합니다.
- 승인된 `paymentId`와 결제 이력 번호는 주문에 저장되며 취소·대사에 사용합니다.
- 운영에서는 `NAVER_PAY_MODE=production`과 운영용 `NAVER_PAY_CLIENT_ID`,
  `NAVER_PAY_CLIENT_SECRET`, `NAVER_PAY_CHAIN_ID`가 모두 필요합니다.
- 네이버페이센터에 실제 서비스 HTTPS 도메인과 결제 완료 URL을 등록해야 합니다.

## 테스트

```bash
npm run test
npm run test:e2e
npm run test:cov
```

## 배포

루트의 배포 파일을 사용합니다.

- `docker-compose.prod.yml`
- `deploy/env.deploy.example`
- `.github/workflows/deploy.yml`

운영에서는 `.env.deploy` 값을 채운 뒤 compose로 실행합니다.

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Database (PostgreSQL)

- 스키마/마이그레이션: Drizzle ORM. `DATABASE_URL`은 `.env`에 설정.
- **스키마 반영**
  - `npm run db:push` — 코드 스키마를 DB에 그대로 반영 (개발 시 편리).
  - `npm run db:migrate` — 생성된 SQL 마이그레이션을 순서대로 적용.
- **`db:migrate` 시 "relation \"users\" already exists" 에러가 나는 경우**  
  DB에 이미 테이블이 있을 때 발생. 한 번만 부트스트랩 후 migrate 사용:
  ```bash
  npm run db:bootstrap
  npm run db:migrate
  ```
- `npm run db:generate` — 스키마 변경 후 새 마이그레이션 SQL 생성.
- `npm run db:studio` — Drizzle Studio로 DB 조회.
- `npm run db:seed-example` — 예시 상품 1개(상세 이미지, 구매 안내, 취급 주의, 구매평 1개 포함) 시드. 한 번만 실행해도 됨.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
