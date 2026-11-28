import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  RESTAURANT_OWNER = "RESTAURANT_OWNER",
  RESTAURANT_MANAGER = "RESTAURANT_MANAGER",
  BRANCH_MANAGER = "BRANCH_MANAGER",
}

export enum UserStatus {
  ACTIVE = "active",
  INVITED = "invited",
  DISABLED = "disabled",
}

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, trim: true, maxlength: 80 })
  firstName!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  lastName!: string;

  @Prop({ required: true, trim: true, match: /^\+[1-9]\d{7,14}$/ })
  phoneNumber!: string;

  @Prop({ lowercase: true, trim: true, maxlength: 254 })
  email?: string;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ select: false })
  mfaSecret?: string;

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop({ required: true, enum: UserRole })
  role!: UserRole;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  restaurantId!: Types.ObjectId | null;

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  branchIds!: Types.ObjectId[];

  @Prop({ required: true, enum: UserStatus, default: UserStatus.INVITED })
  status!: UserStatus;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  @Prop({ required: true, default: false })
  isWhatsappVerified!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index(
  { phoneNumber: 1 },
  { unique: true, partialFilterExpression: { phoneNumber: { $type: "string" } } },
);
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
UserSchema.index({ restaurantId: 1, role: 1, status: 1 });
