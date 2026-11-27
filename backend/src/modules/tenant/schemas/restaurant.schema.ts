import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type RestaurantDocument = HydratedDocument<Restaurant>;

export enum RestaurantStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  PENDING = "pending",
}

@Schema({ timestamps: true, collection: "restaurants" })
export class Restaurant {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 80 })
  slug!: string;

  @Prop({ trim: true })
  logo?: string;

  @Prop({ trim: true, lowercase: true, maxlength: 254 })
  email?: string;

  @Prop({ trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ required: true, trim: true, maxlength: 30 })
  restaurantWhatsappNumber!: string;

  @Prop({ trim: true })
  phoneNumberId?: string;

  @Prop({ required: true, enum: RestaurantStatus, default: RestaurantStatus.PENDING })
  status!: RestaurantStatus;

  @Prop({ required: true, default: "free", trim: true })
  subscriptionPlan!: string;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);
RestaurantSchema.index({ status: 1, createdAt: -1 });
RestaurantSchema.index(
  { phoneNumberId: 1 },
  { unique: true, partialFilterExpression: { phoneNumberId: { $type: "string" } } },
);
