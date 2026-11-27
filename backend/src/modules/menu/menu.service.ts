import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuthenticatedRequest } from "../auth/auth.guard";
import { UserRole } from "../auth/user.schema";
import { Branch, BranchDocument } from "../branch/schemas/branch.schema";
import { Category, CategoryDocument } from "./schemas/category.schema";
import { MenuItem, MenuItemDocument } from "./schemas/menu-item.schema";
import { CreateCategoryDto, CreateMenuItemDto } from "./menu.dto";

@Injectable()
export class MenuService {
  constructor(
    @InjectModel(Category.name) private readonly categories: Model<CategoryDocument>,
    @InjectModel(MenuItem.name) private readonly items: Model<MenuItemDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
  ) {}

  async listCategories(restaurantId: string): Promise<CategoryDocument[]> {
    return this.categories.find({ restaurantId: new Types.ObjectId(restaurantId) })
      .sort({ displayOrder: 1, name: 1 }).exec();
  }

  async createCategory(restaurantId: string, dto: CreateCategoryDto): Promise<CategoryDocument> {
    try {
      return await this.categories.create({
        ...dto,
        restaurantId: new Types.ObjectId(restaurantId),
      });
    } catch (error) {
      if (this.isDuplicateKey(error)) throw new ConflictException("Category name already exists");
      throw error;
    }
  }

  async listItems(user: AuthenticatedRequest["user"], branchId?: string): Promise<MenuItemDocument[]> {
    const filter: Record<string, unknown> = {
      restaurantId: new Types.ObjectId(user.restaurantId!),
    };
    if (user.role === UserRole.BRANCH_MANAGER) {
      const allowed = user.branchIds;
      if (branchId && !allowed.includes(branchId)) throw new ForbiddenException();
      filter.branchId = branchId
        ? new Types.ObjectId(branchId)
        : { $in: allowed.map((id) => new Types.ObjectId(id)) };
    } else if (branchId) {
      if (!Types.ObjectId.isValid(branchId)) throw new BadRequestException("Invalid branchId");
      filter.branchId = new Types.ObjectId(branchId);
    }
    return this.items.find(filter).sort({ name: 1 }).exec();
  }

  async createItem(
    user: AuthenticatedRequest["user"],
    dto: CreateMenuItemDto,
  ): Promise<MenuItemDocument> {
    if (
      !/^[\da-f]{24}$/i.test(dto.branchId) ||
      !/^[\da-f]{24}$/i.test(dto.categoryId) ||
      !Types.ObjectId.isValid(dto.branchId) ||
      !Types.ObjectId.isValid(dto.categoryId)
    ) {
      throw new BadRequestException("Invalid branchId or categoryId");
    }

    const restaurantId = new Types.ObjectId(user.restaurantId!);
    const branchId = new Types.ObjectId(dto.branchId);
    const categoryId = new Types.ObjectId(dto.categoryId);
    if (
      user.role === UserRole.BRANCH_MANAGER &&
      !user.branchIds.includes(dto.branchId)
    ) {
      throw new ForbiddenException("Branch is not assigned to this user");
    }

    const [branch, category] = await Promise.all([
      this.branches.exists({ _id: branchId, restaurantId }),
      this.categories.exists({ _id: categoryId, restaurantId }),
    ]);
    if (!branch || !category) {
      throw new NotFoundException("Branch or category was not found for this restaurant");
    }

    const priceCents = this.toCents(dto.price);
    if (dto.salePrice !== undefined && this.toCents(dto.salePrice) > priceCents) {
      throw new BadRequestException("salePrice cannot be greater than price");
    }

    try {
      return await this.items.create({
        ...dto,
        restaurantId,
        branchId,
        categoryId,
        price: Types.Decimal128.fromString(dto.price),
        salePrice: dto.salePrice ? Types.Decimal128.fromString(dto.salePrice) : undefined,
      });
    } catch (error) {
      if (this.isDuplicateKey(error)) throw new ConflictException("Menu item already exists in this branch");
      throw error;
    }
  }

  async setAvailability(
    user: AuthenticatedRequest["user"],
    id: string,
    isAvailable: boolean,
  ): Promise<MenuItemDocument> {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(user.restaurantId!),
    };
    if (user.role === UserRole.BRANCH_MANAGER) {
      filter.branchId = { $in: user.branchIds.map((branchId) => new Types.ObjectId(branchId)) };
    }

    const item = await this.items.findOneAndUpdate(
      filter,
      { $set: { isAvailable } },
      { new: true, runValidators: true },
    );
    if (!item) throw new NotFoundException("Menu item was not found");
    return item;
  }

  private toCents(amount: string): number {
    const [whole, fraction = ""] = amount.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  }

  private isDuplicateKey(error: unknown): error is { code: number } {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
  }
}
