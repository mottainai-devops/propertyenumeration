import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";
import { customAuthRouter } from "./customAuth";

export const appRouter = router({
  system: systemRouter,
  
  // Use custom authentication instead of Manus OAuth
  auth: customAuthRouter,

  // ============================================================================
  // BUILDINGS ROUTER (Replaces polygons)
  // ============================================================================
  buildings: router({
    list: protectedProcedure.query(async () => {
      return await db.listBuildings();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getBuildingById(input.id);
      }),

    getByBuildingId: protectedProcedure
      .input(z.object({ buildingId: z.string() }))
      .query(async ({ input }) => {
        return await db.getBuildingByBuildingId(input.buildingId);
      }),

    create: protectedProcedure
      .input(z.object({
        buildingId: z.string(),
        businessName: z.string().optional(),
        custPhone: z.string().optional(),
        customerEmail: z.string().optional(),
        address: z.string().optional(),
        zone: z.string().optional(),
        socioEconomicGroup: z.string().optional(),
        geometry: z.string(), // GeoJSON
        centerLat: z.string(),
        centerLon: z.string(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createBuilding({
          ...input,
          lastUpdated: new Date(),
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        businessName: z.string().optional(),
        custPhone: z.string().optional(),
        customerEmail: z.string().optional(),
        address: z.string().optional(),
        zone: z.string().optional(),
        socioEconomicGroup: z.string().optional(),
        geometry: z.string().optional(),
        centerLat: z.string().optional(),
        centerLon: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateBuilding(id, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteBuilding(input.id);
        return { success: true };
      }),

    withCustomers: protectedProcedure.query(async () => {
      return await db.getBuildingsWithCustomers();
    }),
  }),

  // ============================================================================
  // PICKUPS ROUTER (Replaces customers/properties)
  // ============================================================================
  pickups: router({
    list: protectedProcedure
      .input(z.object({
        buildingId: z.string().optional(),
        companyId: z.string().optional(),
        userId: z.string().optional(),
        synced: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.listPickups(input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPickupById(input.id);
      }),

    getByBuilding: protectedProcedure
      .input(z.object({ buildingId: z.string() }))
      .query(async ({ input }) => {
        return await db.getPickupsByBuilding(input.buildingId);
      }),

    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return await db.searchPickups(input.query);
      }),

    create: protectedProcedure
      .input(z.object({
        formId: z.string(),
        supervisorId: z.string(),
        customerType: z.string(),
        binType: z.string(),
        wheelieBinType: z.string().optional(),
        binQuantity: z.number(),
        buildingId: z.string(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        pickUpDate: z.string(),
        firstPhoto: z.string(),
        secondPhoto: z.string(),
        incidentReport: z.string().optional(),
        companyId: z.number().optional(),
        companyName: z.string().optional(),
        lotCode: z.string().optional(),
        lotName: z.string().optional(),
        socioClass: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createPickup({
          ...input,
          userId: ctx.user?.id,
          synced: 1,
        });

        // Update building customer labels
        await db.updateBuildingCustomerLabels(input.buildingId);

        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        customerEmail: z.string().optional(),
        customerAddress: z.string().optional(),
        customerType: z.string().optional(),
        socioClass: z.string().optional(),
        binType: z.string().optional(),
        wheelieBinType: z.string().optional(),
        binQuantity: z.number().optional(),
        pickUpDate: z.string().optional(),
        incidentReport: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updatePickup(id, updates);

        // Get the pickup to update building labels
        const pickup = await db.getPickupById(id);
        if (pickup && pickup.buildingId) {
          await db.updateBuildingCustomerLabels(pickup.buildingId);
        }

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const pickup = await db.getPickupById(input.id);
        await db.deletePickup(input.id);

        // Update building labels after deletion
        if (pickup && pickup.buildingId) {
          await db.updateBuildingCustomerLabels(pickup.buildingId);
        }

        return { success: true };
      }),

    createBulk: protectedProcedure
      .input(z.object({
        pickups: z.array(z.object({
          formId: z.string(),
          supervisorId: z.string(),
          customerType: z.string(),
          binType: z.string(),
          wheelieBinType: z.string().optional(),
          binQuantity: z.number(),
          buildingId: z.string(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          pickUpDate: z.string(),
          firstPhoto: z.string(),
          secondPhoto: z.string(),
          incidentReport: z.string().optional(),
          companyId: z.number().optional(),
          companyName: z.string().optional(),
          lotCode: z.string().optional(),
          lotName: z.string().optional(),
          socioClass: z.string().optional(),
          userId: z.number(),
        }))
      }))
      .mutation(async ({ input }) => {
        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const pickup of input.pickups) {
          try {
            await db.createPickup({
              ...pickup,
              synced: 1,
            });
            await db.updateBuildingCustomerLabels(pickup.buildingId);
            success++;
          } catch (error) {
            failed++;
            errors.push(`Row ${pickup.formId}: ${error}`);
          }
        }

        return { success, failed, errors };
      }),
  }),

  // ============================================================================
  // COMPANIES & OPERATIONAL LOTS (Keep existing)
  // ============================================================================
  companies: router({
    list: protectedProcedure.query(async () => {
      return await db.listCompanies();
    }),
  }),

  lots: router({
    list: protectedProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.listOperationalLots(input?.companyId);
      }),
  }),

  // ============================================================================
  // VALIDATION LOGS
  // ============================================================================
  validationLogs: router({
    list: protectedProcedure.query(async () => {
      return await db.listValidationLogs();
    }),

    create: protectedProcedure
      .input(z.object({
        pickupId: z.number(),
        status: z.enum(["approved", "rejected"]),
        comments: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createValidationLog({
          pickupId: input.pickupId,
          validatedBy: ctx.user!.id,
          status: input.status,
          comments: input.comments,
        });
        return { id };
      }),
  }),

  // ============================================================================
  // DASHBOARD
  // ============================================================================
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
