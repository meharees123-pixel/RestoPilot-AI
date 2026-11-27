import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  OWNER = "owner",
  MANAGER = "manager",
  BRANCH_MANAGER = "branch_manager",
  CUSTOMER = "customer",
}

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, lowercase: true, trim: true, maxlength: 254 })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop({ required: true, enum: UserRole })
  role!: UserRole;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  restaurantId!: Types.ObjectId | null;

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  branchIds!: Types.ObjectId[];

  @Prop({ required: true, default: true })
  isActive!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ restaurantId: 1, role: 1, isActive: 1 });
