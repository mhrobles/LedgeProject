import { z } from 'zod';
import { SourceOrder } from '../domain.js';

const sourceLineSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string().min(1),
  unitPrice: z.number().finite().nonnegative(),
  quantity: z.number().int().positive(),
  discount: z.number().min(0).max(1),
  discontinued: z.string().nullable()
});

const sourceOrderSchema = z.object({
  orderId: z.number().int().positive(),
  customerId: z.string().min(1),
  customerCompanyName: z.string().nullable(),
  customerCountry: z.string().nullable(),
  employeeId: z.number().int().nullable(),
  orderDate: z.string().min(1),
  requiredDate: z.string().nullable(),
  shippedDate: z.string().nullable(),
  shipVia: z.number().int().nullable(),
  freight: z.number().finite().nonnegative(),
  shipName: z.string().nullable(),
  shipAddress: z.string().nullable(),
  shipCity: z.string().nullable(),
  shipRegion: z.string().nullable(),
  shipPostalCode: z.string().nullable(),
  shipCountry: z.string().nullable(),
  shipperCompanyName: z.string().nullable(),
  lines: z.array(sourceLineSchema).min(1)
});

export function validateSourceOrders(input: SourceOrder[]): SourceOrder[] {
  return input.map((order) => sourceOrderSchema.parse(order));
}
