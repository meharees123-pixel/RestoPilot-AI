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
import { Customer, CustomerDocument } from "../customer/customer.schema";
import { MenuItem, MenuItemDocument } from "../menu/schemas/menu-item.schema";
import { CreateOrderDto } from "./order.dto";
import { OrderCounter, OrderCounterDocument } from "./order-counter.schema";
import { Order, OrderDocument, OrderStatus } from "./order.schema";

const transitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
    @InjectModel(OrderCounter.name) private readonly counters: Model<OrderCounterDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
    @InjectModel(MenuItem.name) private readonly menuItems: Model<MenuItemDocument>,
  ) {}

  async list(user: AuthenticatedRequest["user"]): Promise<OrderDocument[]> {
    const filter: Record<string, unknown> = {
      restaurantId: new Types.ObjectId(user.restaurantId!),
    };
    if (user.role === UserRole.BRANCH_MANAGER) {
      filter.branchId = { $in: user.branchIds.map((id) => new Types.ObjectId(id)) };
    }
    return this.orders.find(filter).sort({ createdAt: -1 }).limit(100).exec();
  }

  async create(user: AuthenticatedRequest["user"], dto: CreateOrderDto): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(dto.branchId) || !Types.ObjectId.isValid(dto.customerId)) {
      throw new BadRequestException("Invalid branchId or customerId");
    }
    const restaurantId = new Types.ObjectId(user.restaurantId!);
    const branchId = new Types.ObjectId(dto.branchId);
    const customerId = new Types.ObjectId(dto.customerId);

    if (user.role === UserRole.BRANCH_MANAGER && !user.branchIds.includes(dto.branchId)) {
      throw new ForbiddenException("Branch is not assigned to this user");
    }

    const [branch, customer] = await Promise.all([
      this.branches.exists({ _id: branchId, restaurantId }),
      this.customers.exists({ _id: customerId, restaurantId }),
    ]);
    if (!branch || !customer) throw new NotFoundException("Branch or customer was not found");

    const quantities = new Map<string, number>();
    for (const line of dto.items) {
      if (!Types.ObjectId.isValid(line.menuItemId)) {
        throw new BadRequestException("Invalid menuItemId");
      }
      quantities.set(line.menuItemId, (quantities.get(line.menuItemId) ?? 0) + line.quantity);
    }
    if ([...quantities.values()].some((quantity) => quantity > 99)) {
      throw new BadRequestException("Combined item quantity cannot exceed 99");
    }

    const itemIds = [...quantities.keys()].map((id) => new Types.ObjectId(id));
    const availableItems = await this.menuItems.find({
      restaurantId,
      branchId,
      _id: { $in: itemIds },
      isAvailable: true,
    }).exec();
    if (availableItems.length !== itemIds.length) {
      throw new BadRequestException("One or more items are unavailable in this branch");
    }

    const lines = availableItems.map((item) => {
      const quantity = quantities.get(item.id)!;
      const unitCents = this.toCents((item.salePrice ?? item.price).toString());
      const lineCents = unitCents * quantity;
      return {
        menuItemId: item._id,
        name: item.name,
        quantity,
        unitPrice: Types.Decimal128.fromString(this.fromCents(unitCents)),
        total: Types.Decimal128.fromString(this.fromCents(lineCents)),
      };
    });
    const subtotalCents = lines.reduce(
      (total, line) => total + this.toCents(line.total.toString()),
      0,
    );
    const orderNumber = await this.nextOrderNumber(restaurantId);
    const zero = Types.Decimal128.fromString("0.00");

    return this.orders.create({
      restaurantId,
      branchId,
      customerId,
      orderNumber,
      items: lines,
      subtotal: Types.Decimal128.fromString(this.fromCents(subtotalCents)),
      deliveryCharge: zero,
      discount: zero,
      tax: zero,
      grandTotal: Types.Decimal128.fromString(this.fromCents(subtotalCents)),
      paymentMethod: dto.paymentMethod,
      deliveryType: dto.deliveryType,
      notes: dto.notes,
      status: OrderStatus.PENDING,
    });
  }

  async updateStatus(
    user: AuthenticatedRequest["user"],
    id: string,
    nextStatus: OrderStatus,
  ): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Invalid order id");
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(user.restaurantId!),
    };
    if (user.role === UserRole.BRANCH_MANAGER) {
      filter.branchId = { $in: user.branchIds.map((branchId) => new Types.ObjectId(branchId)) };
    }

    const order = await this.orders.findOne(filter).exec();
    if (!order) throw new NotFoundException("Order was not found");
    if (!transitions[order.status].includes(nextStatus)) {
      throw new ConflictException(`Cannot move order from ${order.status} to ${nextStatus}`);
    }
    const updated = await this.orders.findOneAndUpdate(
      { ...filter, status: order.status },
      { $set: { status: nextStatus } },
      { new: true, runValidators: true },
    );
    if (!updated) throw new ConflictException("Order status changed concurrently; reload and retry");
    return updated;
  }

  private async nextOrderNumber(restaurantId: Types.ObjectId): Promise<string> {
    let counter;
    try {
      counter = await this.counters.findOneAndUpdate(
        { restaurantId },
        { $inc: { sequence: 1 }, $setOnInsert: { restaurantId } },
        { new: true, upsert: true },
      ).exec();
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) {
        throw error;
      }
      counter = await this.counters.findOneAndUpdate(
        { restaurantId },
        { $inc: { sequence: 1 } },
        { new: true },
      ).exec();
    }
    if (!counter) throw new Error("Unable to allocate order number");
    return `FF-${counter.sequence.toString().padStart(8, "0")}`;
  }

  private toCents(amount: string): number {
    const [whole, fraction = ""] = amount.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  }

  private fromCents(cents: number): string {
    return `${Math.floor(cents / 100)}.${(cents % 100).toString().padStart(2, "0")}`;
  }
}
