import { Model, Types } from "mongoose";
import { AuthenticatedRequest } from "../src/modules/auth/auth.guard";
import { UserRole } from "../src/modules/auth/user.schema";
import { CustomerDocument } from "../src/modules/customer/customer.schema";
import { CustomerService } from "../src/modules/customer/customer.service";
import { OrderDocument } from "../src/modules/order/order.schema";

describe("CustomerService branch access", () => {
  it("limits branch managers to customers with orders at assigned branches", async () => {
    const restaurantId = new Types.ObjectId();
    const assignedBranchId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const distinct = jest.fn().mockResolvedValue([customerId]);
    const limit = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    const sort = jest.fn().mockReturnValue({ limit });
    const find = jest.fn().mockReturnValue({ sort });
    const service = new CustomerService(
      { find } as unknown as Model<CustomerDocument>,
      { distinct } as unknown as Model<OrderDocument>,
    );
    const user = {
      role: UserRole.BRANCH_MANAGER,
      restaurantId: restaurantId.toString(),
      branchIds: [assignedBranchId.toString()],
    } as AuthenticatedRequest["user"];

    await service.list(user);

    expect(distinct).toHaveBeenCalledWith("customerId", {
      restaurantId,
      branchId: { $in: [assignedBranchId] },
    });
    expect(find).toHaveBeenCalledWith({
      restaurantId,
      _id: { $in: [customerId] },
    });
  });
});
