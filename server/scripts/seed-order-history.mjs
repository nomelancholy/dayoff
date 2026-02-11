/**
 * 특정 유저에게 주문 이력(orders + order_items) 시드
 * - Order History에서 구매평 쓰기 확인용
 * 사용: node scripts/seed-order-history.mjs (server 폴더에서, DATABASE_URL 필요)
 *
 * 대상 유저: starmekey@gmail.com (id: bba6bdfb-ecef-4c95-b80b-59c8b68e478a)
 */
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const TARGET_USER_ID = 'bba6bdfb-ecef-4c95-b80b-59c8b68e478a';

function orderNumber() {
  return 'ORD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

async function run() {
  await client.connect();

  const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [TARGET_USER_ID]);
  if (!userCheck.rows[0]) {
    console.error('대상 유저가 없습니다. id:', TARGET_USER_ID);
    await client.end();
    process.exit(1);
  }

  const productsRes = await client.query(
    'SELECT id, name, price FROM products WHERE is_active = true ORDER BY created_at ASC LIMIT 5'
  );
  const products = productsRes.rows;
  if (products.length === 0) {
    console.error('상품이 없습니다. 먼저 seed-example-product.mjs 를 실행하세요.');
    await client.end();
    process.exit(1);
  }

  const orderNum1 = orderNumber();
  const order1Res = await client.query(
    `INSERT INTO orders (user_id, order_number, status, subtotal, shipping_fee, discount_amount, total, created_at, updated_at)
     VALUES ($1, $2, 'delivered', $3, 3000, 0, $4, now() - interval '3 days', now() - interval '3 days') RETURNING id`,
    [
      TARGET_USER_ID,
      orderNum1,
      products.slice(0, 2).reduce((sum, p) => sum + p.price * (p.price > 30000 ? 1 : 2), 0),
      products.slice(0, 2).reduce((sum, p) => sum + p.price * (p.price > 30000 ? 1 : 2), 0) + 3000,
    ]
  );
  const order1Id = order1Res.rows[0].id;

  for (let i = 0; i < Math.min(2, products.length); i++) {
    const p = products[i];
    const qty = p.price > 30000 ? 1 : 2;
    const lineTotal = p.price * qty;
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, option_label, price, quantity, line_total)
       VALUES ($1, $2, $3, NULL, $4, $5, $6)`,
      [order1Id, p.id, p.name, p.price, qty, lineTotal]
    );
  }

  const orderNum2 = orderNumber();
  const order2Res = await client.query(
    `INSERT INTO orders (user_id, order_number, status, subtotal, shipping_fee, discount_amount, total, created_at, updated_at)
     VALUES ($1, $2, 'delivered', $3, 0, 0, $3, now() - interval '1 day', now() - interval '1 day') RETURNING id`,
    [TARGET_USER_ID, orderNum2, products[0].price]
  );
  const order2Id = order2Res.rows[0].id;

  await client.query(
    `INSERT INTO order_items (order_id, product_id, product_name, option_label, price, quantity, line_total)
     VALUES ($1, $2, $3, NULL, $4, 1, $4)`,
    [order2Id, products[0].id, products[0].name, products[0].price]
  );

  if (products.length >= 3) {
    const orderNum3 = orderNumber();
    const order3Res = await client.query(
      `INSERT INTO orders (user_id, order_number, status, subtotal, shipping_fee, discount_amount, total, created_at, updated_at)
       VALUES ($1, $2, 'paid', $3, 3000, 0, $4, now(), now()) RETURNING id`,
      [TARGET_USER_ID, orderNum3, products[2].price, products[2].price + 3000]
    );
    const order3Id = order3Res.rows[0].id;
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, option_label, price, quantity, line_total)
       VALUES ($1, $2, $3, NULL, $4, 1, $4)`,
      [order3Id, products[2].id, products[2].name, products[2].price]
    );
  }

  console.log('시드 완료. 주문 이력이 추가되었습니다.');
  console.log('유저 ID:', TARGET_USER_ID);
  console.log('주문 수: 2~3건 (상품 수에 따라)');
  console.log('확인: 로그인 후 My Account > ORDER HISTORY');
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
