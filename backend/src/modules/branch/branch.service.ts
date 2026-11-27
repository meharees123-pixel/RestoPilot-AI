import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuthenticatedRequest } from "../auth/auth.guard";
import { UserRole } from "../auth/user.schema";
import { Branch, BranchDocument, BranchStatus } from "./schemas/branch.schema";
import { CreateBranchDto } from "./branch.dto";

@Injectable()
export class BranchService {
  constructor(@InjectModel(Branch.name) private readonly branches: Model<BranchDocument>) {}

  async list(user: AuthenticatedRequest["user"]): Promise<BranchDocument[]> {
    const filter: Record<string, unknown> = { restaurantId: new Types.ObjectId(user.restaurantId!) };
    if (user.role === UserRole.BRANCH_MANAGER) {
      filter._id = { $in: user.branchIds.map((id) => new Types.ObjectId(id)) };
    }
    return this.branches.find(filter).sort({ name: 1 }).exec();
  }

  async create(user: AuthenticatedRequest["user"], dto: CreateBranchDto): Promise<BranchDocument> {
    if (user.role === UserRole.BRANCH_MANAGER) {
      throw new ForbiddenException("Branch managers cannot create branches");
    }
    if ((dto.latitude === undefined) !== (dto.longitude === undefined)) {
      throw new BadRequestException("latitude and longitude must be provided together");
    }

    const branch = new this.branches({
      ...dto,
      restaurantId: new Types.ObjectId(user.restaurantId!),
      ...(dto.latitude !== undefined && dto.longitude !== undefined
        ? { location: { type: "Point", coordinates: [dto.longitude, dto.latitude] } }
        : {}),
    });
    try {
      return await branch.save();
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        throw new ConflictException("Branch name already exists in this restaurant");
      }
      throw error;
    }
  }

  async updateStatus(
    user: AuthenticatedRequest["user"],
    id: string,
    status: BranchStatus,
  ): Promise<BranchDocument> {
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(user.restaurantId!),
    };
    if (user.role === UserRole.BRANCH_MANAGER) {
      filter._id = { $in: user.branchIds.map((branchId) => new Types.ObjectId(branchId)) };
    }

    const branch = await this.branches.findOneAndUpdate(filter, { $set: { status } }, { new: true });
    if (!branch) throw new NotFoundException("Branch was not found");
    return branch;
  }
}
