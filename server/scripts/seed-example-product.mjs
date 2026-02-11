/**
 * 예시 상품 1개 + 구매평 1개 시드
 * - 상품: 상세 이미지, 구매 전 안내사항, 취급 및 구매 주의사항 포함
 * - 구매평: 사진 첨부 1장
 * 사용: node scripts/seed-example-product.mjs (server 폴더에서, DATABASE_URL 필요)
 */
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const EXAMPLE = {
  category: { slug: 'all', name: 'All' },
  product: {
    slug: 'example-handcrafted-vase',
    name: 'Example Handcrafted Vase',
    description: '손으로 빚은 도자기 화병 예시 상품입니다.',
    price: 45000,
    purchaseNotice: `전 과정 손으로 빚어 만드는 공정의 특성상 같은 제품이라도 약간의 차이가 있을 수 있습니다.
본 제품은 환불 불가 상품입니다. (하자 있을 경우 7일 이내 교환 가능)`,
    handlingNotice: `• 한 개 한 개 손으로 빚어 만드는 제품 특성상 형태, 채색의 느낌이 사진과 다를 수 있습니다.
• 수작업으로 만들어진 도자기는 안전하며 잘 관리해 주시는 만큼 오랫동안 사용하실 수 있습니다.
• 급격한 온도 변화나 강한 충격에 노출되면 크랙 및 파손될 수 있습니다.
• 도자기 세척 시 스크래치를 주의하여 부드러운 스펀지를 이용해 주세요.
• 유약이 입혀진 표면이라도 착색이 될 수 있습니다.`,
  },
  mainImageUrls: [
    'https://picsum.photos/800/800?random=1',
    'https://picsum.photos/800/800?random=2',
  ],
  detailImageUrls: [
    'https://picsum.photos/1200/800?random=3',
    'https://picsum.photos/1200/600?random=4',
  ],
  review: {
    body: '받아보니 생각보다 훨씬 예쁘고 질도 좋아요. 선물로도 추천합니다!',
    imageUrl: 'https://picsum.photos/400/400?random=5',
  },
};

async function run() {
  await client.connect();

  let categoryId;
  const catRes = await client.query(
    "SELECT id FROM product_categories WHERE slug = $1 LIMIT 1",
    [EXAMPLE.category.slug]
  );
  if (catRes.rows[0]) {
    categoryId = catRes.rows[0].id;
  } else {
    const ins = await client.query(
      `INSERT INTO product_categories (slug, name, sort_order) VALUES ($1, $2, 0) RETURNING id`,
      [EXAMPLE.category.slug, EXAMPLE.category.name]
    );
    categoryId = ins.rows[0].id;
  }

  const productRes = await client.query(
    `INSERT INTO products (category_id, slug, name, description, price, is_active, purchase_notice, handling_notice)
     VALUES ($1, $2, $3, $4, $5, true, $6, $7) RETURNING id`,
    [
      categoryId,
      EXAMPLE.product.slug,
      EXAMPLE.product.name,
      EXAMPLE.product.description,
      EXAMPLE.product.price,
      EXAMPLE.product.purchaseNotice,
      EXAMPLE.product.handlingNotice,
    ]
  );
  const productId = productRes.rows[0].id;

  for (let i = 0; i < EXAMPLE.mainImageUrls.length; i++) {
    await client.query(
      `INSERT INTO product_images (product_id, url, alt, sort_order) VALUES ($1, $2, $3, $4)`,
      [productId, EXAMPLE.mainImageUrls[i], EXAMPLE.product.name + ' ' + (i + 1), i + 1]
    );
  }

  for (let i = 0; i < EXAMPLE.detailImageUrls.length; i++) {
    await client.query(
      `INSERT INTO product_detail_images (product_id, url, alt, sort_order) VALUES ($1, $2, $3, $4)`,
      [productId, EXAMPLE.detailImageUrls[i], '상세 ' + (i + 1), i + 1]
    );
  }

  let userId = null;
  const userRes = await client.query('SELECT id FROM users LIMIT 1');
  if (userRes.rows[0]) {
    userId = userRes.rows[0].id;
  } else {
    const hashed = await bcrypt.hash('password1', 10);
    const userIns = await client.query(
      `INSERT INTO users (email, password, full_name, provider, role) VALUES ($1, $2, $3, 'email', 'member') RETURNING id`,
      ['reviewer@example.com', hashed, '구매평 작성자']
    );
    userId = userIns.rows[0].id;
  }

  const reviewRes = await client.query(
    `INSERT INTO product_reviews (product_id, user_id, body, rating, updated_at) VALUES ($1, $2, $3, 5, now()) RETURNING id`,
    [productId, userId, EXAMPLE.review.body]
  );
  const reviewId = reviewRes.rows[0].id;

  await client.query(
    `INSERT INTO product_review_images (review_id, url, sort_order) VALUES ($1, $2, 1)`,
    [reviewId, EXAMPLE.review.imageUrl]
  );

  console.log('시드 완료.');
  console.log('상품 ID:', productId);
  console.log('프론트에서 확인: /shop/' + productId);
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
