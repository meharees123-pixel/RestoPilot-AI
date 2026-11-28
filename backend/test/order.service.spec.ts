import { Model, Types } from "mongoose";
import { AuthenticatedRequest } from "../src/modules/auth/auth.guard";
import { UserRole } from "../src/modules/auth/user.schema";
import { BranchDocument } from "../src/modules/branch/schemas/branch.schema";
import { CustomerDocument } from "../src/modules/customer/customer.schema";
import { MenuItemDocument } from "../src/modules/menu/schemas/menu-item.schema";
import { CreateOrderDto } from "../src/modules/order/order.dto";
import { OrderCounterDocument } from "../src/modules/order/order-counter.schema";
import { OrderDocument, OrderStatus } from "../src/modules/order/order.schema";
import { OrderService } from "../src/modules/order/order.service";

describe("OrderService", () => {
  const restaurantId = "64a1a1a1a1a1a1a1a1a1a1a1";
  const branchId = "64b2b2b2b2b2b2b2b2b2b2b2";
  const customerId = "64c3c3c3c3c3c3c3c3c3c3c3";
  const itemId = "64d4d4d4d4d4d4d4d4d4d4d4";

  it("calculates totals from stored menu prices and tenant-scopes lookups", async () => {
    const execMenu = jest.fn().mockResolvedValue([
      {
        id: itemId,
        _id: new Types.ObjectId(itemId),
        name: "Burger",
        price: Types.Decimal128.fromString("12.50"),
        salePrice: Types.Decimal128.fromString("10.00"),
      },
    ]);
    const menuFind = jest.fn().mockReturnValue({ exec: execMenu });
    const branches = { exists: jest.fn().mockResolvedValue(true) };
    const customers = { exists: jest.fn().mockResolvedValue(true) };
    const counters = {
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ sequence: 7 }),
      }),
    };
    const orders = { create: jest.fn().mockImplementation(async (order) => order) };
    const service = new OrderService(
      orders as unknown as Model<OrderDocument>,
      counters as unknown as Model<OrderCounterDocument>,
      branches as unknown as Model<BranchDocument>,
      customers as unknown as Model<CustomerDocument>,
      { find: menuFind } as unknown as Model<MenuItemDocument>,
    );
    const user = {
      sub: "64e5e5e5e5e5e5e5e5e5e5e5",
      role: UserRole.RESTAURANT_MANAGER,
      restaurantId,
      branchIds: [],
    } as AuthenticatedRequest["user"];
    const dto = {
      branchId,
      customerId,
      items: [{ menuItemId: itemId, quantity: 1 }, { menuItemId: itemId, quantity: 2 }],
      paymentMethod: "cash",
      deliveryType: "pickup",
    } as CreateOrderDto;

    const result = await service.create(user, dto);

    expect(menuFind).toHaveBeenCalledWith(expect.objectContaining({
      restaurantId: new Types.ObjectId(restaurantId),
      branchId: new Types.ObjectId(branchId),
      isAvailable: true,
    }));
    expect(result.orderNumber).toBe("FF-00000007");
    expect(result.items[0].quantity).toBe(3);
    expect(result.grandTotal.toString()).toBe("30.00");
  });

  it("rejects terminal order-state changes", async () => {
    const order = {
      status: OrderStatus.DELIVERED,
    };
    const orders = { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(order) }) };
    const service = new OrderService(
      orders as unknown as Model<OrderDocument>,
      {} as Model<OrderCounterDocument>,
      {} as Model<BranchDocument>,
      {} as Model<CustomerDocument>,
      {} as Model<MenuItemDocument>,
    );

    await expect(
      service.updateStatus({
        sub: customerId,
        role: UserRole.RESTAURANT_MANAGER,
        restaurantId,
        branchIds: [],
      }, "64f6f6f6f6f6f6f6f6f6f6f6", OrderStatus.CANCELLED),
    ).rejects.toThrow("Cannot move order");
  });
});
