import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type OrderDocument = HydratedDocument<Order>;

export enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PREPARING = "preparing",
  READY = "ready",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
}

export enum DeliveryType {
  PICKUP = "pickup",
  DELIVERY = "delivery",
  DINE_IN = "dine_in",
}

@Schema({ _id: false })
export class OrderLine {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  menuItemId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, min: 1, max: 99 })
  quantity!: number;

  @Prop({ required: true, type: MongooseSchema.Types.Decimal128 })
  unitPrice!: Types.Decimal128;

  @Prop({ required: true, type: MongooseSchema.Types.Decimal128 })
  total!: Types.Decimal128;
}

export const OrderLineSchema = SchemaFactory.createForClass(OrderLine);

@Schema({ timestamps: true, collection: "orders" })
export class Order {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  customerId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  orderNumber!: string;

  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.PENDING, index: true })
  status!: OrderStatus;

  @Prop({ type: [OrderLineSchema], required: true, validate: (lines: OrderLine[]) =>
    lines.length > 0 })
  items!: OrderLine[];

  @Prop({ required: true, type: MongooseSchema.Types.Decimal128 })
  subtotal!: Types.Decimal128;

  @Prop({ required: true, type: MongooseSchema.Types.Decimal128, default: "0.00" })
  deliveryCharge!: Types.Decimal128;

  @Prop({ required: true, type: MongooseSchema.Types.Decimal128, default: "0.00" })
  discount!: Types.Decimal128;

  @Prop({ required: true, type: MongooseSchema.Types.Decimal128, default: "0.00" })
  tax!: Types.Decimal128;

  @Prop({ required: true, type: MongooseSchema.Types.Decimal128 })
  grandTotal!: Types.Decimal128;

  @Prop({ required: true, enum: ["cash", "card", "online"] })
  paymentMethod!: "cash" | "card" | "online";

  @Prop({ required: true, enum: DeliveryType })
  deliveryType!: DeliveryType;

  @Prop({ trim: true, maxlength: 1000 })
  notes?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ restaurantId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ restaurantId: 1, branchId: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
