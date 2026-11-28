import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuthenticatedRequest } from "../auth/auth.guard";
import { UserRole } from "../auth/user.schema";
import { Customer, CustomerDocument } from "./customer.schema";
import { CreateCustomerDto } from "./customer.dto";
import { Order, OrderDocument } from "../order/order.schema";

@Injectable()
export class CustomerService {
  constructor(
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
  ) {}

  async list(user: AuthenticatedRequest["user"]): Promise<CustomerDocument[]> {
    const restaurantId = new Types.ObjectId(user.restaurantId!);
    const filter: Record<string, unknown> = { restaurantId };
    if (user.role === UserRole.BRANCH_MANAGER) {
      const customerIds = await this.orders.distinct("customerId", {
        restaurantId,
        branchId: { $in: user.branchIds.map((id) => new Types.ObjectId(id)) },
      });
      filter._id = { $in: customerIds };
    }
    return this.customers.find(filter)
      .sort({ lastOrderDate: -1, createdAt: -1 }).limit(100).exec();
  }

  async create(restaurantId: string, dto: CreateCustomerDto): Promise<CustomerDocument> {
    try {
      return await this.customers.create({
        ...dto,
        restaurantId: new Types.ObjectId(restaurantId),
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        throw new ConflictException("Customer already exists in this restaurant");
      }
      throw error;
    }
  }
}
