import { ConfigService } from '@nestjs/config';
import { eq, sql } from 'drizzle-orm';
import {
  createE2eContext,
  E2E_DATABASE_URL,
  E2eContext,
} from './support/e2e-app';
import * as schema from '../src/db/schema';
import { NaverOrderApiClient } from '../src/shop/naver-order-api.client';
import { NaverOrderSyncService } from '../src/shop/naver-order-sync.service';
import { payProductId } from '../src/shop/naver-order.service';

(E2E_DATABASE_URL ? describe : describe.skip)(
  'Naver inventory sync with PostgreSQL',
  () => {
    let ctx: E2eContext,
      cfg: ConfigService,
      api: NaverOrderApiClient,
      sync: NaverOrderSyncService;
    let detail: any,
      changes: jest.SpyInstance,
      details: jest.SpyInstance,
      product: any;
    beforeAll(async () => {
      ctx = await createE2eContext();
      cfg = ctx.app.get(ConfigService);
      api = ctx.app.get(NaverOrderApiClient);
      sync = ctx.app.get(NaverOrderSyncService);
      changes = jest.spyOn(api, 'changes');
      details = jest.spyOn(api, 'details');
    });
    afterAll(async () => {
      await ctx?.close();
    });
    beforeEach(async () => {
      await ctx.resetDatabase();
      await ctx.db.execute(
        sql`truncate naver_order_inventory, naver_order_sync_state`,
      );
      product = await ctx.createProduct({ stockQuantity: 5 });
      const start = new Date(Date.now() - 180000).toISOString();
      for (const [k, v] of Object.entries({
        NAVER_ORDER_API_MODE: 'production',
        NAVER_ORDER_MODE: 'production',
        NAVER_ORDER_API_CLIENT_ID: 'test-app',
        NAVER_ORDER_MERCHANT_ID: 'np_test',
        NAVER_ORDER_SYNC_ENABLED: 'true',
        NAVER_ORDER_INVENTORY_ENABLED: 'true',
        NAVER_ORDER_SYNC_START_AT: start,
      }))
        cfg.set(k, v);
      detail = {
        order: {
          orderId: 'o1',
          paymentDate: new Date(Date.now() - 120000).toISOString(),
        },
        productOrder: {
          mallId: 'np_test',
          productOrderId: 'po1',
          productId: payProductId(product.id),
          orderIntegrationVersion: 'V21',
          productOrderStatus: 'PAYED',
          initialQuantity: 3,
          remainQuantity: 3,
        },
        completedClaims: [],
      };
      changes.mockReset().mockImplementation(async () => ({
        count: 1,
        lastChangeStatuses: [
          {
            productOrderId: 'po1',
            lastChangedDate: new Date(Date.now() - 60000).toISOString(),
          },
        ],
      }));
      details.mockReset().mockImplementation(async () => [detail]);
    });
    const stock = async () =>
      (await ctx.db.query.products.findFirst({
        where: eq(schema.products.id, product.id),
      }))!.stockQuantity;
    it('deducts once across repeated calls, then restores partial and full cancellations once', async () => {
      await sync.run();
      await sync.run();
      expect(await stock()).toBe(2);
      detail.completedClaims = [
        {
          claimId: 'c1',
          claimType: 'CANCEL',
          claimStatus: 'CANCEL_DONE',
          requestQuantity: 1,
        },
      ];
      detail.productOrder.remainQuantity = 2;
      await sync.run();
      await sync.run();
      expect(await stock()).toBe(3);
      detail.productOrder.productOrderStatus = 'CANCELED';
      detail.productOrder.remainQuantity = 0;
      await sync.run();
      await sync.run();
      expect(await stock()).toBe(5);
    });
    it('does not mutate live stock in sandbox and rejects sandbox inventory activation', async () => {
      cfg.set('NAVER_ORDER_API_MODE', 'sandbox');
      cfg.set('NAVER_ORDER_INVENTORY_ENABLED', 'false');
      await sync.run();
      expect(await stock()).toBe(5);
      const rows = await ctx.db.select().from(schema.naverOrderInventory);
      expect(rows[0].consumed).toBe(3);
      expect(rows[0].appliedConsumed).toBe(0);
      cfg.set('NAVER_ORDER_INVENTORY_ENABLED', 'true');
      await expect(sync.run()).rejects.toThrow('SANDBOX_INVENTORY_FORBIDDEN');
      expect(await stock()).toBe(5);
    });
    it('rolls back stock, ledger and cursor if a later page fails', async () => {
      changes
        .mockReset()
        .mockResolvedValueOnce({
          lastChangeStatuses: [
            {
              productOrderId: 'po1',
              lastChangedDate: new Date(Date.now() - 60000).toISOString(),
            },
          ],
          more: {
            moreFrom: new Date(Date.now() - 60000).toISOString(),
            moreSequence: 'next',
          },
        })
        .mockRejectedValueOnce(new Error('failure'));
      await expect(sync.run()).rejects.toThrow('SYNC_INTERNAL_ERROR');
      expect(await stock()).toBe(5);
      expect(
        await ctx.db.select().from(schema.naverOrderInventory),
      ).toHaveLength(0);
    });
    it('serializes workers on different service instances', async () => {
      const other = new NaverOrderSyncService(ctx.db, api);
      let release!: () => void, entered!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const reached = new Promise<void>((resolve) => {
        entered = resolve;
      });
      details.mockImplementationOnce(async () => {
        entered();
        await blocked;
        return [detail];
      });
      const first = sync.run();
      await reached;
      try {
        expect(await other.run()).toEqual({ skipped: 'already-running' });
      } finally {
        release();
      }
      await first;
      expect(await stock()).toBe(2);
    });
    it('does not deduct or restore manually handled payments before cutover', async () => {
      detail.order.paymentDate = new Date(Date.now() - 3600000).toISOString();
      await sync.run();
      expect(await stock()).toBe(5);
      detail.productOrder.productOrderStatus = 'CANCELED';
      detail.productOrder.remainQuantity = 0;
      await sync.run();
      expect(await stock()).toBe(5);
    });
    it('retains returns for inspection without automatic stock recovery', async () => {
      await sync.run();
      detail.productOrder.productOrderStatus = 'RETURNED';
      detail.productOrder.remainQuantity = 0;
      detail.completedClaims = [
        {
          claimId: 'r1',
          claimType: 'RETURN',
          claimStatus: 'RETURN_DONE',
          requestQuantity: 3,
        },
      ];
      await sync.run();
      expect(await stock()).toBe(2);
      expect(
        (await ctx.db.select().from(schema.naverOrderInventory))[0]
          .manualReview,
      ).toBe(true);
    });
    it('rejects unmapped products and runtime changes to the cutover policy', async () => {
      detail.productOrder.productId = 'unknown';
      await expect(sync.run()).rejects.toThrow('UNMAPPED_PRODUCT');
      expect(await stock()).toBe(5);
      detail.productOrder.productId = payProductId(product.id);
      await sync.run();
      cfg.set('NAVER_ORDER_INVENTORY_ENABLED', 'false');
      await expect(sync.run()).rejects.toThrow('SYNC_CONFIGURATION_CHANGED');
      expect(await stock()).toBe(2);
    });
    it('consumes every page and advances only after the last page', async () => {
      const at = new Date(Date.now() - 60000).toISOString();
      changes
        .mockReset()
        .mockResolvedValueOnce({
          lastChangeStatuses: [{ productOrderId: 'po1', lastChangedDate: at }],
          more: { moreFrom: at, moreSequence: 'po2' },
        })
        .mockResolvedValueOnce({
          lastChangeStatuses: [{ productOrderId: 'po2', lastChangedDate: at }],
        });
      details.mockImplementation(async (ids) =>
        ids.map((id) => ({
          ...detail,
          productOrder: { ...detail.productOrder, productOrderId: id },
        })),
      );
      const result = await sync.run();
      expect(result).toMatchObject({ processed: 2, stockChanges: 2 });
      expect(changes.mock.calls[1][2]).toBe('po2');
      expect(await stock()).toBe(-1);
      expect(
        (await ctx.db.select().from(schema.naverOrderSyncState))[0]
          .lastSuccessAt,
      ).not.toBeNull();
    });
    it('rejects a repeated pagination cursor without persisting any stock changes', async () => {
      const at = new Date(Date.now() - 60000).toISOString();
      changes
        .mockReset()
        .mockResolvedValue({
          lastChangeStatuses: [{ productOrderId: 'po1', lastChangedDate: at }],
          more: { moreFrom: at, moreSequence: 'same' },
        });
      await expect(sync.run()).rejects.toThrow('CURSOR_NOT_ADVANCING');
      expect(await stock()).toBe(5);
      expect(
        await ctx.db.select().from(schema.naverOrderInventory),
      ).toHaveLength(0);
    });
    it('restricts status and manual sync to admins', async () => {
      await ctx.http().get('/shop/admin/naver-order/sync').expect(401);
      const user = await ctx.createUser();
      await ctx
        .http()
        .post('/shop/admin/naver-order/sync')
        .set(user.auth)
        .expect(403);
      const admin = await ctx.createAdmin();
      await ctx
        .http()
        .get('/shop/admin/naver-order/sync')
        .set(admin.auth)
        .expect(200);
    });
  },
);
