import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuthService } from "../auth/auth.service";
import { User, UserDocument, UserRole, UserStatus } from "../auth/user.schema";
import { Restaurant, RestaurantDocument, RestaurantStatus } from "../tenant/schemas/restaurant.schema";
import { AccessAudit, AccessAuditDocument } from "../audit/access-audit.schema";
import { CreateRestaurantDto } from "./platform.dto";

@Injectable()
export class PlatformService {
  constructor(
    @InjectModel(Restaurant.name) private readonly restaurants: Model<RestaurantDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(AccessAudit.name) private readonly audits: Model<AccessAuditDocument>,
    private readonly auth: AuthService,
  ) {}

  async overview() {
    const [restaurants, activeRestaurants, users] = await Promise.all([
      this.restaurants.countDocuments(),
      this.restaurants.countDocuments({ status: RestaurantStatus.ACTIVE }),
      this.users.countDocuments(),
    ]);
    return { restaurants, activeRestaurants, users };
  }

  listRestaurants(): Promise<RestaurantDocument[]> {
    return this.restaurants.find().sort({ createdAt: -1 }).exec();
  }

  listUsers(): Promise<UserDocument[]> {
    return this.users.find().sort({ createdAt: -1 }).limit(500).exec();
  }

  listAccessAudits(): Promise<AccessAuditDocument[]> {
    return this.audits.find().sort({ occurredAt: -1 }).limit(100).exec();
  }

  async createRestaurant(dto: CreateRestaurantDto) {
    let restaurant: RestaurantDocument | undefined;
    try {
      restaurant = await this.restaurants.create({
        name: dto.name,
        slug: dto.slug.toLowerCase(),
        restaurantWhatsappNumber: dto.restaurantWhatsappNumber,
        status: RestaurantStatus.ACTIVE,
        subscriptionPlan: "free",
      });
      const owner = await this.users.create({
        firstName: dto.ownerFirstName,
        lastName: dto.ownerLastName,
        phoneNumber: dto.ownerPhoneNumber,
        ...(dto.ownerEmail ? { email: dto.ownerEmail.toLowerCase() } : {}),
        role: UserRole.RESTAURANT_OWNER,
        restaurantId: restaurant._id,
        branchIds: [],
        status: UserStatus.INVITED,
        isWhatsappVerified: false,
      });
      return { restaurant, owner };
    } catch (error) {
      if (restaurant) await this.restaurants.deleteOne({ _id: restaurant._id });
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException("The restaurant slug or owner identity is already in use");
      }
      throw error;
    }
  }

  async inviteUser(userId: string) {
    const user = await this.users.findOne({
      _id: userId,
      role: { $in: [UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_MANAGER, UserRole.BRANCH_MANAGER] },
      status: { $in: [UserStatus.ACTIVE, UserStatus.INVITED] },
    });
    if (!user) throw new NotFoundException("Restaurant user was not found");
    return this.auth.requestOtp(user.phoneNumber);
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
  }
}
