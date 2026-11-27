import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Customer, CustomerDocument } from "./customer.schema";
import { CreateCustomerDto } from "./customer.dto";

@Injectable()
export class CustomerService {
  constructor(@InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>) {}

  list(restaurantId: string): Promise<CustomerDocument[]> {
    return this.customers.find({ restaurantId: new Types.ObjectId(restaurantId) })
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
