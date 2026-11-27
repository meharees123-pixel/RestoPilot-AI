import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type MenuItemDocument = HydratedDocument<MenuItem>;

@Schema({ timestamps: true, collection: "menu_items" })
export class MenuItem {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  categoryId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ trim: true, maxlength: 2000 })
  description?: string;

  @Prop({ trim: true })
  image?: string;

  @Prop({ required: true, type: MongooseSchema.Types.Decimal128, min: 0 })
  price!: Types.Decimal128;

  @Prop({ type: MongooseSchema.Types.Decimal128, min: 0 })
  salePrice?: Types.Decimal128;

  @Prop({ required: true, default: true })
  isAvailable!: boolean;

  @Prop()
  availableFrom?: string;

  @Prop()
  availableTo?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ min: 0 })
  preparationTime?: number;
}

export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);
MenuItemSchema.index({ restaurantId: 1, branchId: 1, name: 1 }, { unique: true });
MenuItemSchema.index({ restaurantId: 1, branchId: 1, categoryId: 1, isAvailable: 1 });
MenuItemSchema.index({ name: "text", description: "text", tags: "text" });
