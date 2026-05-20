import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SourceOrder } from '../domain.js';

interface NorthwindJoinedRow {
  orderId: number;
  customerId: string;
  customerCompanyName: string | null;
  customerCountry: string | null;
  employeeId: number | null;
  orderDate: string;
  requiredDate: string | null;
  shippedDate: string | null;
  shipVia: number | null;
  freight: number;
  shipName: string | null;
  shipAddress: string | null;
  shipCity: string | null;
  shipRegion: string | null;
  shipPostalCode: string | null;
  shipCountry: string | null;
  shipperCompanyName: string | null;
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  discontinued: string | null;
}

const NORTHWIND_JOIN_SQL = `
  select
    o.OrderID as orderId,
    o.CustomerID as customerId,
    c.CompanyName as customerCompanyName,
    c.Country as customerCountry,
    o.EmployeeID as employeeId,
    o.OrderDate as orderDate,
    o.RequiredDate as requiredDate,
    o.ShippedDate as shippedDate,
    o.ShipVia as shipVia,
    coalesce(o.Freight, 0) as freight,
    o.ShipName as shipName,
    o.ShipAddress as shipAddress,
    o.ShipCity as shipCity,
    o.ShipRegion as shipRegion,
    o.ShipPostalCode as shipPostalCode,
    coalesce(o.ShipCountry, c.Country, 'USA') as shipCountry,
    s.CompanyName as shipperCompanyName,
    od.ProductID as productId,
    coalesce(p.ProductName, 'Unknown product') as productName,
    od.UnitPrice as unitPrice,
    od.Quantity as quantity,
    od.Discount as discount,
    p.Discontinued as discontinued
  from Orders o
  inner join [Order Details] od on od.OrderID = o.OrderID
  left join Customers c on c.CustomerID = o.CustomerID
  left join Products p on p.ProductID = od.ProductID
  left join Shippers s on s.ShipperID = o.ShipVia
  order by o.OrderID asc, od.ProductID asc
`;

export async function loadNorthwindOrders(sourcePath: string): Promise<SourceOrder[]> {
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    database.exec('pragma query_only = true');
    const rows = database.prepare(NORTHWIND_JOIN_SQL).all() as unknown as NorthwindJoinedRow[];
    const grouped = new Map<number, SourceOrder>();

    for (const row of rows) {
      const current = grouped.get(row.orderId);
      const nextLine = {
        productId: row.productId,
        productName: row.productName,
        unitPrice: Number(row.unitPrice),
        quantity: Number(row.quantity),
        discount: Number(row.discount),
        discontinued: row.discontinued
      };

      if (current) {
        current.lines.push(nextLine);
        continue;
      }

      grouped.set(row.orderId, {
        orderId: row.orderId,
        customerId: row.customerId,
        customerCompanyName: row.customerCompanyName,
        customerCountry: row.customerCountry,
        employeeId: row.employeeId,
        orderDate: row.orderDate,
        requiredDate: row.requiredDate,
        shippedDate: row.shippedDate,
        shipVia: row.shipVia,
        freight: Number(row.freight),
        shipName: row.shipName,
        shipAddress: row.shipAddress,
        shipCity: row.shipCity,
        shipRegion: row.shipRegion,
        shipPostalCode: row.shipPostalCode,
        shipCountry: row.shipCountry,
        shipperCompanyName: row.shipperCompanyName,
        lines: [nextLine]
      });
    }

    return Array.from(grouped.values());
  } finally {
    database.close();
  }
}

export function checksumOfFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
