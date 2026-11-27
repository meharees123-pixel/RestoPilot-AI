import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type OrderCounterDocument = HydratedDocument<OrderCounter>;

@Schema({ collection: "order_counters" })
export class OrderCounter {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true, min: 0, default: 0 })
  sequence!: number;
}

export const OrderCounterSchema = SchemaFactory.createForClass(OrderCounter);
OrderCounterSchema.index({ restaurantId: 1 }, { unique: true });
