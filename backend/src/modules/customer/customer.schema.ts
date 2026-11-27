import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ timestamps: true, collection: "customers" })
export class Customer {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ trim: true, maxlength: 120 })
  name?: string;

  @Prop({ required: true, trim: true, maxlength: 30 })
  whatsappNumber!: string;

  @Prop({ default: 0, min: 0 })
  totalOrders!: number;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: "0.00" })
  totalSpent!: Types.Decimal128;

  @Prop({ default: 0, min: 0 })
  loyaltyPoints!: number;

  @Prop()
  lastOrderDate?: Date;

  @Prop({ type: [String], default: [] })
  tags!: string[];
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ restaurantId: 1, whatsappNumber: 1 }, { unique: true });
CustomerSchema.index({ restaurantId: 1, lastOrderDate: -1 });
