import { Model, Types } from "mongoose";
import { AuthenticatedRequest } from "../src/modules/auth/auth.guard";
import { UserRole } from "../src/modules/auth/user.schema";
import { CategoryDocument } from "../src/modules/menu/schemas/category.schema";
import { MenuItemDocument } from "../src/modules/menu/schemas/menu-item.schema";
import { BranchDocument } from "../src/modules/branch/schemas/branch.schema";
import { MenuService } from "../src/modules/menu/menu.service";

describe("MenuService tenant scoping", () => {
  const restaurantId = "64a1a1a1a1a1a1a1a1a1a1a1";
  const assignedBranchId = "64b2b2b2b2b2b2b2b2b2b2b2";

  it("limits branch-manager item queries to assigned branches and their tenant", async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ exec });
    const find = jest.fn().mockReturnValue({ sort });
    const service = new MenuService(
      {} as Model<CategoryDocument>,
      { find } as unknown as Model<MenuItemDocument>,
      {} as Model<BranchDocument>,
    );
    const user = {
      sub: "64c3c3c3c3c3c3c3c3c3c3c3",
      role: UserRole.BRANCH_MANAGER,
      restaurantId,
      branchIds: [assignedBranchId],
    } as AuthenticatedRequest["user"];

    await service.listItems(user);

    expect(find).toHaveBeenCalledWith({
      restaurantId: new Types.ObjectId(restaurantId),
      branchId: { $in: [new Types.ObjectId(assignedBranchId)] },
    });
  });

  it("rejects a branch outside the manager's assignments", async () => {
    const service = new MenuService(
      {} as Model<CategoryDocument>,
      {} as Model<MenuItemDocument>,
      {} as Model<BranchDocument>,
    );
    const user = {
      sub: "64c3c3c3c3c3c3c3c3c3c3c3",
      role: UserRole.BRANCH_MANAGER,
      restaurantId,
      branchIds: [assignedBranchId],
    } as AuthenticatedRequest["user"];

    await expect(
      service.listItems(user, "64d4d4d4d4d4d4d4d4d4d4d4"),
    ).rejects.toThrow();
  });
});
